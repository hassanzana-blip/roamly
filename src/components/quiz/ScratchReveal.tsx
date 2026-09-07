import { useEffect, useRef, useState } from "react";

/**
 * Skrapelodd-overlay: et canvas-lag dekker innholdet, og brukeren skraper
 * det bort med fingeren/musa. Når nok av flaten er fjernet, falmer laget
 * bort og innholdet avsløres. Ved prefers-reduced-motion vises innholdet
 * direkte uten skraping.
 */
export default function ScratchReveal({
  children,
  hint = "Skrap frem reisen din ✦",
  threshold = 0.42,
  onRevealed,
}: {
  children: React.ReactNode;
  hint?: string;
  threshold?: number;
  onRevealed?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const [reduced, setReduced] = useState(false);
  const scratching = useRef(false);
  const moves = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) setDone(true);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Metallisk skrapelag i navy med merkevare-gradient
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, "#16324f");
      g.addColorStop(0.5, "#102640");
      g.addColorStop(1, "#1b3a5c");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Sveip av blå glans
      const shine = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
      shine.addColorStop(0, "rgba(36,87,245,0)");
      shine.addColorStop(0.5, "rgba(36,87,245,0.22)");
      shine.addColorStop(1, "rgba(36,87,245,0)");
      ctx.fillStyle = shine;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Hint-tekst
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `600 ${Math.round(13 * dpr)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${3 * dpr}px`;
      ctx.fillText(hint.toUpperCase(), canvas.width / 2, canvas.height / 2);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [reduced, hint]);

  useEffect(() => {
    if (done) onRevealed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    const x = (clientX - r.left) * dpr;
    const y = (clientY - r.top) * dpr;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 30 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Sjekk andel fjernet — uthult hvert 8. strøk, stikkprøve hvert 16. piksel
    moves.current += 1;
    if (moves.current % 8 === 0) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let cleared = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 16 * 4) {
        total += 1;
        if (data[i] < 40) cleared += 1;
      }
      if (cleared / total > threshold) setDone(true);
    }
  };

  if (reduced) return <>{children}</>;

  return (
    <div ref={containerRef} className="relative">
      <div aria-hidden={!done}>{children}</div>
      {/* Tastatur-/skjermleseralternativ til skraping */}
      {!done && (
        <button
          type="button"
          onClick={() => setDone(true)}
          className="absolute bottom-3 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full bg-white/95 px-5 text-[13px] font-bold text-night shadow focus-visible:outline-2 focus-visible:outline-ring"
        >
          Vis
        </button>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full touch-none select-none rounded-[inherit] transition-opacity duration-700 ${
          done ? "pointer-events-none opacity-0" : "cursor-crosshair opacity-100"
        }`}
        onPointerDown={(e) => {
          scratching.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          scratchAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (scratching.current) scratchAt(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          scratching.current = false;
        }}
        onPointerCancel={() => {
          scratching.current = false;
        }}
      />
    </div>
  );
}
