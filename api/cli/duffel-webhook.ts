import "dotenv/config";

/**
 * Registrerer Duffel-webhook mot denne installasjonen.
 *
 * Bruk:
 *   APP_BASE_URL=https://ditt-domene.no npm run duffel:webhook
 *
 * Duffel tillater én webhook per modus (test/live). Hemmeligheten som
 * returneres vises KUN én gang — legg den inn som DUFFEL_WEBHOOK_SECRET
 * i Railway-variabler umiddelbart.
 */
async function main() {
  const apiKey = process.env.DUFFEL_API_KEY;
  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  if (!apiKey) {
    console.error("Mangler DUFFEL_API_KEY.");
    process.exit(1);
  }
  if (!baseUrl.startsWith("https://")) {
    console.error("APP_BASE_URL må være en https-URL (Duffel godtar ikke http eller localhost).");
    process.exit(1);
  }

  const res = await fetch("https://api.duffel.com/air/webhooks", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        url: `${baseUrl}/api/webhooks/duffel`,
        events: ["order.created", "order.updated", "order.airline_initiated_change_detected"],
      },
    }),
  });
  const body = (await res.json()) as {
    data?: { id?: string; secret?: string; url?: string; active?: boolean };
    errors?: { message?: string }[];
  };
  if (!res.ok) {
    console.error("Duffel svarte med feil:", body.errors?.[0]?.message ?? res.status);
    process.exit(1);
  }
  console.log("Webhook opprettet:");
  console.log(`  ID:     ${body.data?.id}`);
  console.log(`  URL:    ${body.data?.url}`);
  console.log(`  Aktiv:  ${body.data?.active}`);
  console.log(`\nLEGG DETTE I RAILWAY-VARIABLER NÅ (vises aldri igjen):`);
  console.log(`  DUFFEL_WEBHOOK_SECRET=${body.data?.secret}`);
}

main().catch((err) => {
  console.error("Webhook-registrering feilet:", err);
  process.exit(1);
});
