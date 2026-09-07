import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { QUESTIONS, type QuizAnswers } from "@/content/quiz";

const slide = {
  initial: { opacity: 0, x: 48, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -48, filter: "blur(6px)" },
};

/**
 * De fem spørsmålene — samme flyt i alle moduser. Hvert valg går videre av
 * seg selv etter en kort pause, slik at valget rekker å vises.
 * `skip` lar oss hoppe over spørsmål som ikke gir mening i en modus
 * (f.eks. «hvem reiser du med» i Par-match, der svaret er gitt).
 */
export default function QuestionFlow({
  initial = {},
  skip = [],
  onDone,
  onExit,
}: {
  initial?: QuizAnswers;
  skip?: (keyof QuizAnswers)[];
  onDone: (answers: QuizAnswers) => void;
  onExit: () => void;
}) {
  const questions = QUESTIONS.filter((q) => !skip.includes(q.key));
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(initial);
  const q = questions[step];

  const choose = (value: string) => {
    const next = { ...answers, [q.key]: value } as QuizAnswers;
    setAnswers(next);
    setTimeout(() => {
      if (step < questions.length - 1) setStep(step + 1);
      else onDone(next);
    }, 380);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.section key={`q-${step}`} {...slide} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 flex-col py-6">
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onExit() : setStep(step - 1))}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/60 hover:text-white"
            aria-label="Forrige spørsmål"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-px flex-1 bg-white/15">
            <motion.div className="h-px bg-card" initial={false} animate={{ width: `${((step + 1) / questions.length) * 100}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="font-mono-label text-[10px] text-white/60">{step + 1} av {questions.length}</p>
        </div>

        <h2 className="font-display max-w-2xl text-4xl leading-[1.0] sm:text-6xl">{q.title}</h2>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          {q.options.map((o) => {
            const selected = answers[q.key] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                aria-pressed={selected}
                className={`group relative overflow-hidden rounded-xl text-left transition-[border-color,box-shadow,background-color,transform] duration-base ${selected ? "ring-2 ring-white ring-offset-2 ring-offset-night" : "hover:-translate-y-1"}`}
              >
                <div className="relative aspect-[16/10] sm:aspect-[16/9]">
                  <img src={o.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-night/10 transition-opacity group-hover:from-night/80" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="font-display text-2xl sm:text-3xl">{o.label}</p>
                    <p className="mt-1 text-sm text-white/75">{o.sub}</p>
                  </div>
                  {selected && (
                    <motion.span layoutId="quiz-check" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-card text-foreground">✦</motion.span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
