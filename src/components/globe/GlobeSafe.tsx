import { Component, lazy, Suspense, useMemo, type ReactNode } from "react";

const Globe = lazy(() => import("./Globe"));

// ─── Static fallback ────────────────────────────────────────────────────────
// Shown when WebGL is unavailable or the 3D bundle fails: a quiet night disc
// with hand-drawn route arcs in the same visual language.

function StaticGlobe({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative aspect-square w-[130vmin] max-w-[820px]">
          <div
            className="absolute inset-0 rounded-full opacity-80"
            style={{
              background:
                "radial-gradient(circle at 32% 28%, #223e86 0%, #12264e 45%, #0a1730 78%)",
              boxShadow: "0 0 120px 30px rgba(115,149,215,0.14)",
            }}
          />
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
            <g stroke="#afd2eb" strokeWidth="0.8" fill="none" opacity="0.5">
              <path d="M90 210 Q 180 60 300 130" />
              <path d="M110 250 Q 220 120 330 210" />
              <path d="M80 180 Q 200 160 290 250" />
              <path d="M120 150 Q 230 80 320 160" />
            </g>
            <g fill="#2E5BFF">
              <circle cx="90" cy="210" r="3" />
              <circle cx="300" cy="130" r="3" />
              <circle cx="330" cy="210" r="3" />
              <circle cx="290" cy="250" r="3" />
            </g>
            <g fill="#afd2eb" opacity="0.8">
              <circle cx="110" cy="250" r="2" />
              <circle cx="80" cy="180" r="2" />
              <circle cx="120" cy="150" r="2" />
              <circle cx="320" cy="160" r="2" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <StaticGlobe className="absolute inset-0" /> : this.props.children;
  }
}

export default function GlobeSafe({ className = "" }: { className?: string }) {
  const supported = useMemo(webglAvailable, []);
  if (!supported) return <StaticGlobe className={className} />;
  return (
    <GlobeBoundary>
      <Suspense fallback={<StaticGlobe className={className} />}>
        <Globe className={className} />
      </Suspense>
    </GlobeBoundary>
  );
}
