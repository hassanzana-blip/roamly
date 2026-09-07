import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Camera, Heart, Plane, RotateCcw, Sparkles } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ScratchReveal from "@/components/quiz/ScratchReveal";
import BoardingPass from "@/components/quiz/BoardingPass";
import { QUESTIONS, scoreQuiz, type QuizAnswers } from "@/content/quiz";
import { searchHref } from "@/content/discover";
import { PAGE_META, usePageMeta } from "@/lib/seo";

type Phase = "intro" | number | "result";

const slide = {
  initial: { opacity: 0, x: 48, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -48, filter: "blur(6px)" },
};

export default function Quiz() {
  usePageMeta(PAGE_META.quiz);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [revealed, setRevealed] = useState(false);

  const step = typeof phase === "number" ? phase : null;
  const result = useMemo(
    () => (phase === "result" ? scoreQuiz(answers) : null),
    [phase, answers],
  );

  const choose = (key: keyof QuizAnswers, value: string) => {
    const next = { ...answers, [key]: value } as QuizAnswers;
    setAnswers(next);
    // Liten pause slik at valget markeres visuelt før neste steg
    setTimeout(() => {
      if (step !== null && step < QUESTIONS.length - 1) setPhase(step + 1);
      else setPhase("result");
    }, 380);
  };

  const restart = () => {
    setAnswers({});
    setPhase("intro");
    setRevealed(false);
    setNames(["", ""]);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-night text-white">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-24 outline-none sm:px-6 sm:pt-28">
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait">
            {/* ── Intro ─────────────────────────────────────────── */}
            {phase === "intro" && (
              <motion.section
                key="intro"
                {...slide}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col items-center justify-center py-10 text-center"
              >
                <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Reisequizen · 5 spørsmål · 30 sekunder
                </p>
                <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">
                  Vet du ikke hvor du vil dra?
                  <span className="italic block" style={{ fontWeight: 400 }}>
                    Vi skraper det frem.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">
                  Svar på fem kjappe spørsmål om stemning, vær og hvem du reiser
                  med — så matcher vi deg med reisemålet ditt og lager et
                  boardingkort du kan sende til noen du er glad i.
                </p>
                <button
                  type="button"
                  onClick={() => setPhase(0)}
                  className="mt-10 inline-flex items-center gap-2.5 rounded-lg bg-card px-9 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary hover:text-white active:scale-[0.98]"
                >
                  Start quizen <ArrowRight className="h-5 w-5" />
                </button>
                <p className="font-mono-label mt-5 text-[9px] text-white/40">
                  Ingen innlogging · ingenting lagres
                </p>
              </motion.section>
            )}

            {/* ── Spørsmål ──────────────────────────────────────── */}
            {step !== null && (
              <motion.section
                key={`q-${step}`}
                {...slide}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col py-6"
              >
                {/* Fremdrift */}
                <div className="mb-8 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => (step === 0 ? setPhase("intro") : setPhase(step - 1))}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/60 hover:text-white"
                    aria-label="Forrige spørsmål"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="h-px flex-1 bg-white/15">
                    <motion.div
                      className="h-px bg-card"
                      initial={false}
                      animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="font-mono-label text-[10px] text-white/60">
                    {step + 1} av {QUESTIONS.length}
                  </p>
                </div>

                <h2 className="font-display max-w-2xl text-4xl leading-[1.0] sm:text-6xl">
                  {QUESTIONS[step].title}
                </h2>

                <div className="mt-9 grid gap-4 sm:grid-cols-2">
                  {QUESTIONS[step].options.map((o) => {
                    const selected = answers[QUESTIONS[step].key] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => choose(QUESTIONS[step].key, o.id)}
                        aria-pressed={selected}
                        className={`group relative overflow-hidden rounded-xl text-left transition-[border-color,box-shadow,background-color] duration-base ${
                          selected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-night"
                            : "hover:-translate-y-1"
                        }`}
                      >
                        <div className="relative aspect-[16/10] sm:aspect-[16/9]">
                          <img
                            src={o.image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-night/10 transition-opacity group-hover:from-night/80" />
                          <div className="absolute inset-x-0 bottom-0 p-5">
                            <p className="font-display text-2xl sm:text-3xl">{o.label}</p>
                            <p className="mt-1 text-sm text-white/75">{o.sub}</p>
                          </div>
                          {selected && (
                            <motion.span
                              layoutId="quiz-check"
                              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-card text-foreground"
                            >
                              ✦
                            </motion.span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* ── Resultat ──────────────────────────────────────── */}
            {phase === "result" && result && (
              <motion.section
                key="result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col py-6"
              >
                <p className="font-mono-label text-[10px] text-white/60">
                  {result.isCouple ? "Vi to drar til …" : "Reisemålet ditt er …"}
                </p>
                <h2 className="font-display mt-3 text-5xl leading-[0.95] sm:text-7xl">
                  {result.top.city}
                  <span className="italic text-white/70" style={{ fontWeight: 400 }}>
                    , {result.top.country}
                  </span>
                </h2>

                {/* Navn på kortet — personliggjør boardingpasset */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono-label mb-1.5 block text-[9px] text-white/50">
                      {result.isCouple ? "Ditt navn" : "Navn på kortet (valgfritt)"}
                    </span>
                    <input
                      value={names[0]}
                      onChange={(e) => setNames([e.target.value, names[1]])}
                      placeholder={result.isCouple ? "Deg" : "Den reisende"}
                      maxLength={24}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-white/60"
                    />
                  </label>
                  {result.isCouple && (
                    <label className="block">
                      <span className="font-mono-label mb-1.5 block text-[9px] text-white/50">
                        Den du inviterer
                      </span>
                      <input
                        value={names[1]}
                        onChange={(e) => setNames([names[0], e.target.value])}
                        placeholder="Hen/han"
                        maxLength={24}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-white/60"
                      />
                    </label>
                  )}
                </div>

                {/* Skrapeloddet over boardingkortet */}
                <div className="mt-6">
                  <ScratchReveal
                    hint="Skrap frem boardingkortet ✦"
                    onRevealed={() => setRevealed(true)}
                  >
                    <BoardingPass destination={result.top} isCouple={result.isCouple} names={names} />
                  </ScratchReveal>
                </div>

                {/* Romantisk idé */}
                {result.isCouple && revealed && (
                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="font-display mt-6 flex items-start gap-3 text-lg italic text-white/85"
                    style={{ fontWeight: 400 }}
                  >
                    <Heart className="mt-1 h-5 w-5 shrink-0 text-primary" fill="currentColor" />
                    {result.top.romance}
                  </motion.p>
                )}

                {/* Handlinger */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to={searchHref(result.top.iata)}
                    className="inline-flex items-center gap-2 rounded-lg bg-card px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary hover:text-white"
                  >
                    <Plane className="h-4 w-4" /> Søk ekte fly til {result.top.city}
                  </Link>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3.5 text-sm text-white/75">
                    <Camera className="h-4 w-4" />
                    Ta en skjermdump og send den til {result.isCouple ? "hen/ham" : "vennene"}
                  </span>
                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3.5 text-sm font-medium text-white/75 transition-colors hover:border-white/60 hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" /> Ta quizen på nytt
                  </button>
                </div>

                {/* Alternativer */}
                <div className="mt-12 border-t border-white/10 pt-8">
                  <p className="font-mono-label text-[10px] text-white/50">
                    To andre som passer deg
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {result.alternatives.map((alt) => (
                      <Link
                        key={alt.id}
                        to={searchHref(alt.iata)}
                        className="group relative overflow-hidden rounded-xl"
                      >
                        <div className="relative aspect-[16/8]">
                          <img
                            src={alt.image}
                            alt={alt.city}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                            <div>
                              <p className="font-display text-2xl">{alt.city}</p>
                              <p className="text-sm text-white/70">{alt.tagline}</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-white/70 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </MotionConfig>
      </main>

      <SiteFooter />
    </div>
  );
}
