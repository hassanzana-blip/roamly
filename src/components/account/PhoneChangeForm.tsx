import { useRef, useState } from "react";
import { Phone } from "lucide-react";
import Icon from "@/components/app/Icon";
import { detailsOf, humanMessage } from "@/lib/apiError";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary";
const buttonCls = "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

type Props = {
  currentPhone: string | null;
  hasPassword: boolean;
  requestCode: (input: { phone: string; password?: string }) => Promise<unknown>;
  confirmCode: (input: { phone: string; code: string }) => Promise<unknown>;
  onReauthenticate: () => void;
};

/** A phone number is a sign-in method: never save it with the name form. */
export default function PhoneChangeForm({ currentPhone, hasPassword, requestCode, confirmCode, onReauthenticate }: Props) {
  const [step, setStep] = useState<"idle" | "number" | "code" | "done">("idle");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const busy = useRef(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const begin = () => {
    setStep("number");
    setPassword("");
    setCode("");
    setError(null);
    setReauth(false);
    requestAnimationFrame(() => numberRef.current?.focus());
  };

  const submit = async () => {
    if (busy.current || reauth) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setReauth(false);
    try {
      if (step === "number") {
        await requestCode({ phone: phone.trim(), ...(hasPassword ? { password } : {}) });
        setPassword("");
        setCode("");
        setStep("code");
        requestAnimationFrame(() => codeRef.current?.focus());
      } else if (step === "code") {
        await confirmCode({ phone: phone.trim(), code });
        setCode("");
        setStep("done");
      }
    } catch (e) {
      setPassword("");
      const needsLogin = detailsOf(e).reason === "reauth_required";
      setReauth(needsLogin);
      setError(needsLogin ? "Logg inn på nytt for å bekrefte at det er deg. Gå deretter tilbake og legg til nummeret." : humanMessage(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="phone-heading" className="mb-6 rounded-xl border border-border bg-card p-5 shadow-soft">
      <h2 id="phone-heading" className="mb-2 flex items-center gap-2 font-display text-xl"><Icon icon={Phone} size={20} /> Telefonnummer</h2>
      <p className="text-sm">{currentPhone || "Ingen telefon lagt til"}</p>
      <p id="phone-help" className="mt-2 text-sm text-muted-foreground">Nummeret brukes til innlogging med SMS. Et nytt nummer må bekreftes før det lagres.</p>
      {step === "idle" || step === "done" ? (
        <>
          {step === "done" && <p role="status" className="mt-3 text-sm font-medium text-success">Telefonnummeret er bekreftet og lagret. Andre enheter er logget ut.</p>}
          <button type="button" onClick={begin} className={`${buttonCls} mt-4 border border-border`}>{currentPhone ? "Endre telefonnummer" : "Legg til telefonnummer"}</button>
        </>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-busy={pending}>
          {step === "number" ? (
            <>
              <div>
                <label htmlFor="new-phone" className="mb-1.5 block text-sm font-medium">Nytt telefonnummer</label>
                <input ref={numberRef} id="new-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+47 912 34 567" minLength={3} maxLength={20} required disabled={pending} aria-describedby="phone-help" className={inputCls} />
              </div>
              {hasPassword ? (
                <div>
                  <label htmlFor="phone-password" className="mb-1.5 block text-sm font-medium">Bekreft med passord</label>
                  <input id="phone-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} required disabled={pending} className={inputCls} />
                </div>
              ) : <p className="text-sm text-muted-foreground">Du må ha logget inn de siste 10 minuttene for å endre nummeret.</p>}
            </>
          ) : (
            <>
              <p role="status" className="text-sm">Se etter en SMS på <strong>{phone}</strong>. Hvis nummeret kan legges til, får du en kode som er gyldig i 10 minutter. Nummeret er ikke endret ennå.</p>
              <div>
                <label htmlFor="phone-code" className="mb-1.5 block text-sm font-medium">SMS-kode</label>
                <input ref={codeRef} id="phone-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required disabled={pending} aria-describedby="code-help" className={inputCls} />
                <p id="code-help" className="mt-1 text-xs text-muted-foreground">Skriv de seks sifrene fra SMS-en. Del aldri koden med andre.</p>
              </div>
              <button type="button" disabled={pending} onClick={begin} className={`${buttonCls} underline underline-offset-4`}>Endre nummer eller be om ny kode</button>
            </>
          )}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {reauth ? <button type="button" onClick={onReauthenticate} className={`${buttonCls} w-full bg-night text-white`}>Logg inn på nytt</button> : (
            <button type="submit" disabled={pending || (step === "code" && code.length !== 6)} className={`${buttonCls} w-full bg-night text-white`}>{pending ? "Venter …" : step === "number" ? "Send SMS-kode" : "Bekreft og lagre nummer"}</button>
          )}
          <button type="button" disabled={pending} onClick={() => { setStep("idle"); setPassword(""); setCode(""); setError(null); }} className={`${buttonCls} w-full border border-border`}>Avbryt telefonendring</button>
        </form>
      )}
    </section>
  );
}
