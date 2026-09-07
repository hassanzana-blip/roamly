import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";

/**
 * Viser gjenopprettingskoder ÉN gang med kopier/last ned.
 * Brukes ved MFA-oppsett (AdminLogin) og kontoaktivering (AdminActivate).
 */
export function RecoveryCodes({ codes, filename = "gjenopprettingskoder.txt" }: { codes: string[]; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* utklippstavle utilgjengelig */
    }
  };
  const download = () => {
    const blob = new Blob([`HelloSky – gjenopprettingskoder\nHver kode kan brukes én gang.\n\n${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Lagre disse kodene et trygt sted (passordhvelv). Hver kode kan brukes <strong className="text-foreground">én gang</strong> hvis du mister
        autentikator-appen. Kodene vises kun nå.
      </p>
      <ol className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground" aria-label="Gjenopprettingskoder">
        {codes.map((c) => (
          <li key={c} className="select-all rounded-lg bg-muted px-3 py-2 text-center tracking-wider">{c}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-foreground/40">
          {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Kopiert" : "Kopier"}
        </button>
        <button type="button" onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-foreground/40">
          <Download className="h-4 w-4" aria-hidden="true" /> Last ned .txt
        </button>
      </div>
    </div>
  );
}
