import { env } from "./env";
import { AppError } from "./errors";
import { log } from "./logger";

// ─── SMS (engangskoder) ──────────────────────────────────────────────────────
// SMS_PROVIDER=twilio → Twilio REST via fetch (ingen SDK-avhengighet).
// SMS_PROVIDER=none   → i produksjon: fail-closed (OTA-071). Ellers logges KUN
//                       at en melding ble «sendt» til et maskert nummer — aldri
//                       innholdet (som inneholder koden).

export type SmsResult = { sent: boolean; provider: "twilio" | "none"; providerMessageId?: string };

/** +4791234567 → +47*****567 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  const keepPrefix = phone.startsWith("+") ? 3 : 0;
  return `${phone.slice(0, keepPrefix)}${"*".repeat(Math.max(0, phone.length - keepPrefix - 3))}${phone.slice(-3)}`;
}

async function sendViaTwilio(to: string, text: string): Promise<SmsResult> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if (!sid || !token || !from) {
    throw new AppError("VALIDATION", { message: "SMS-innlogging er ikke tilgjengelig akkurat nå." });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = new URLSearchParams({ To: to, From: from, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
      log.error({ status: res.status, twilioCode: errBody.code, to: maskPhone(to) }, "[sms] Twilio avviste meldingen");
      throw new AppError("SUPPLIER_UNAVAILABLE", {
        message: "Kunne ikke sende SMS akkurat nå. Prøv igjen om litt.",
        retryable: true,
      });
    }
    const data = (await res.json()) as { sid?: string };
    log.info({ to: maskPhone(to), providerMessageId: data.sid }, "[sms] sendt");
    return { sent: true, provider: "twilio", providerMessageId: data.sid };
  } catch (err) {
    if (err instanceof AppError) throw err;
    log.error({ err: (err as Error)?.name, to: maskPhone(to) }, "[sms] Twilio-kall feilet");
    throw new AppError("SUPPLIER_UNAVAILABLE", {
      message: "Kunne ikke sende SMS akkurat nå. Prøv igjen om litt.",
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send en SMS. `text` logges ALDRI (den inneholder typisk en engangskode).
 */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  if (env.SMS_PROVIDER === "twilio") return sendViaTwilio(to, text);
  if (env.isProdEnv) {
    // Fail-closed: aldri «late som» at en kode ble sendt i produksjon.
    throw new AppError("VALIDATION", { message: "SMS-innlogging er ikke tilgjengelig." });
  }
  log.info({ to: maskPhone(to) }, "[sms] (dev) OTP sent to masked phone");
  return { sent: false, provider: "none" };
}
