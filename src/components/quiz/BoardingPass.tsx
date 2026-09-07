import type { QuizDestination } from "@/content/quiz";
import { departDate } from "@/content/discover";

/** Deterministisk strekkode generert fra destinasjonen – dekorativ. */
function Barcode({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let state = h || 7;
  for (let i = 0; i < 34; i++) {
    state = (state * 1103515245 + 12345) >>> 0;
    const w = 1 + ((state >> 8) % 4);
    const gap = 1 + ((state >> 13) % 2);
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <svg viewBox={`0 0 ${x} 44`} className="h-11 w-full text-foreground" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={44} fill="currentColor" />
      ))}
    </svg>
  );
}

function formatPassDate(iso: string): string {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

/**
 * Inspirasjons-boardingkort – laget for skjermdump og deling.
 * "Vi to ✦ Paris" for par, ellers den reisendes selskap.
 * Tydelig merket som inspirasjon, ikke en ekte billett.
 */
export default function BoardingPass({
  destination: d,
  isCouple,
  names,
}: {
  destination: QuizDestination;
  isCouple: boolean;
  names: [string, string];
}) {
  const date = departDate(35);
  const passengerLine = isCouple
    ? names[0].trim() && names[1].trim()
      ? `${names[0].trim()} & ${names[1].trim()}`
      : "Vi to"
    : names[0].trim() || "1 reisende";

  return (
    <div className="overflow-hidden rounded-xl bg-[#f7f4ec] text-foreground shadow-2xl shadow-night/40">
      <div className="grid sm:grid-cols-[1.65fr_1fr]">
        {/* Hoveddel */}
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="font-mono-label text-[10px] text-foreground/55">hellosky ✦ boarding pass</p>
            <span className="font-mono-label rounded-md bg-night px-2.5 py-1 text-[9px] text-white">
              {isCouple ? "vi to" : "oppdag"}
            </span>
          </div>

          <p className="font-display mt-6 text-5xl leading-[0.95] sm:text-6xl">{d.city}</p>
          <p className="font-mono-label mt-2 text-[10px] text-foreground/55">
            {d.country} · {d.tagline}
          </p>

          <div className="mt-7 flex items-center gap-5">
            <div>
              <p className="font-mono text-3xl font-medium tracking-tight">OSL</p>
              <p className="font-mono-label mt-1 text-[9px] text-muted-foreground">Oslo</p>
            </div>
            <svg viewBox="0 0 120 12" className="h-3 flex-1 text-foreground/45" aria-hidden="true">
              <line x1="0" y1="6" x2="104" y2="6" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 5" />
              <path d="M104 1l12 5-12 5z" fill="currentColor" />
            </svg>
            <div className="text-right">
              <p className="font-mono text-3xl font-medium tracking-tight">{d.iata}</p>
              <p className="font-mono-label mt-1 text-[9px] text-muted-foreground">{d.city}</p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-dashed border-night/20 pt-5">
            <div>
              <p className="font-mono-label text-[9px] text-foreground/45">Reisende</p>
              <p className="mt-1 truncate text-sm font-semibold">{passengerLine}</p>
            </div>
            <div>
              <p className="font-mono-label text-[9px] text-foreground/45">Dato</p>
              <p className="mt-1 text-sm font-semibold">{formatPassDate(date)}</p>
            </div>
            <div>
              <p className="font-mono-label text-[9px] text-foreground/45">Flight</p>
              <p className="mt-1 text-sm font-semibold">HS {d.iata.charCodeAt(0) + d.iata.charCodeAt(2)}</p>
            </div>
          </div>
        </div>

        {/* Stub med perforering */}
        <div className="relative border-t-2 border-dashed border-night/25 bg-[#fdfaf3] p-6 sm:border-l-2 sm:border-t-0">
          <p className="font-mono-label text-[9px] text-foreground/45">Sete</p>
          <p className="font-display mt-1 text-2xl">{isCouple ? "2A · 2B" : "1A"}</p>
          <p className="font-mono-label mt-4 text-[9px] text-foreground/45">Vindu, selvfølgelig</p>
          <div className="mt-5">
            <Barcode seed={d.iata + d.city} />
          </div>
          <p className="font-mono-label mt-3 text-[8px] leading-relaxed text-foreground/40">
            Inspirasjonskort fra hellosky – ikke en billett. Ekte priser og seter
            finner du i søket.
          </p>
        </div>
      </div>
    </div>
  );
}
