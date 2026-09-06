import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";

/**
 * Cinematisk video-hero — levende hav bak søkefeltet.
 *
 * Tilgjengelighet og ytelse:
 * - videoen er dekorativ (aria-hidden), lydløs, loopet, playsInline
 * - poster vises umiddelbart; video strømmes med faststart
 * - prefers-reduced-motion → statisk poster, ingen videoavspilling
 * - mobil får samme erfaring, men kompakt høyde slik at skjemaet
 *   aldri dyttes under brettet
 */
export default function VideoHero({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* Pause video når hero ikke er synlig — sparer batteri og båndbredde */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reducedMotion]);

  return (
    <section className="relative overflow-hidden">
      {/* Bakgrunn: levende hav (eller poster ved redusert bevegelse) */}
      <div className="absolute inset-0" aria-hidden="true">
        {reducedMotion ? (
          <img
            src="/videos/hero-ocean-poster.jpg"
            alt=""
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
        ) : (
          <video
            ref={videoRef}
            className={`h-full w-full object-cover transition-opacity duration-1000 ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
            src="/videos/hero-ocean.mp4"
            poster="/videos/hero-ocean-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
          />
        )}
        {/* Lesbarhet: lys vask øverst (navy-tekst) → ivory mot skjemaet */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/25 to-background" />
      </div>

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-40 pt-24 sm:px-6 sm:pb-44 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-night backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Personlig reisehjelp · alle dager 06–24
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
            className="font-display mt-5 text-[11.5vw] leading-[0.98] tracking-tight text-night sm:text-6xl md:text-7xl"
          >
            Hele verden.
            <br />
            <span className="text-primary">Nærmere.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
            className="mt-5 max-w-xl text-base leading-relaxed text-night/75 sm:text-lg"
          >
            Sammenlign priser fra hundrevis av flyselskaper, book trygt på
            under to minutter — og få hjelp av ekte mennesker hele veien.
          </motion.p>
        </div>
      </MotionConfig>

      {/* Søkeskjemaet svever over bunnen av videoen */}
      <div className="absolute inset-x-0 bottom-0 translate-y-1/2 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
    </section>
  );
}
