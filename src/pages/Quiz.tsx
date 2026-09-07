import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Camera, Dices, Heart, Plane, RotateCcw, Sparkles, Users, Wallet, type LucideIcon } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ScratchReveal from "@/components/quiz/ScratchReveal";
import BoardingPass from "@/components/quiz/BoardingPass";
import QuestionFlow from "./quiz/QuestionFlow";
import { QUIZ_DESTINATIONS, scoreQuiz, type QuizAnswers, type QuizDestination } from "@/content/quiz";
import { searchHref } from "@/content/discover";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useTravelProfile } from "@/lib/useAccount";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { saveMatchKeys, rememberName, rememberedName } from "@/lib/matchKeys";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";

/**
 * ReiseMatch — HelloSkys signaturprodukt. Én mørk scene, seks moduser:
 * Finn min reise · Par-match · Venne-match · Overrask meg · Helgerulett ·
 * Budsjettutfordring. Ingen priser påstås her; alt ender i et ekte søk.
 */

type Mode = "finn" | "par" | "venner" | "overrask" | "helg" | "budsjett";
const MODES: { id: Mode; icon: LucideIcon; title: string; sub: string; kicker: string }[] = [
  { id: "finn", icon: Sparkles, title: "Finn min reise", sub: "Fem spørsmål, ett reisemål. Skrap frem boardingkortet.", kicker: "30 sekunder" },
  { id: "par", icon: Heart, title: "Par-match", sub: "Dere svarer hver for dere. Vi viser hva dere er enige om — og tre steder som passer begge.", kicker: "To lenker, ett svar" },
  { id: "venner", icon: Users, title: "Venne-match", sub: "Et rom for gjengen: alle svarer, stemmer og sier når de ikke kan. Budsjett holdes privat.", kicker: "Hvor skal vi?" },
  { id: "overrask", icon: Dices, title: "Overrask meg", sub: "Ett reisemål, valgt for deg. Snurr igjen så mange ganger du vil.", kicker: "Rulett" },
  { id: "helg", icon: Plane, title: "Helgerulett", sub: "Fredag ut, søndag hjem. Vi trekker byen og setter datoene.", kicker: "Neste fredag" },
  { id: "budsjett", icon: Wallet, title: "Budsjettutfordring", sub: "Si hva du vil bruke per person, så viser vi hvor det typisk rekker.", kicker: "Ærlig om pris" },
];

const slide = {
  initial: { opacity: 0, x: 48, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -48, filter: "blur(6px)" },
};

const darkInput = "w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-white/60";
const primaryBtn = "inline-flex min-h-12 items-center gap-2 rounded-lg bg-card px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary hover:text-white";
const ghostBtn = "inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-medium text-white/75 transition-colors hover:border-white/60 hover:text-white";

function Shell({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-night text-white">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-24 outline-none sm:px-6 sm:pt-28">
        {back && (
          <Link to={back} className="mb-6 inline-flex min-h-11 w-fit items-center gap-2 text-sm text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" /> Alle moduser</Link>
        )}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Hub ────────────────────────────────────────────────────────────────── */
function Hub() {
  return (
    <Shell>
      <motion.section key="hub" {...slide} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="py-6">
        <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85"><Sparkles className="h-3.5 w-3.5" /> ReiseMatch</p>
        <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">
          Vet du ikke hvor?
          <span className="block italic" style={{ fontWeight: 400 }}>Vi finner det ut sammen.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">Velg en modus. Alt du får er inspirasjon med ekte søk bak — vi finner aldri på priser eller tilgjengelighet.</p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <li key={m.id}>
              <Link to={`/quiz/${m.id}`} className="group flex min-h-[172px] flex-col justify-between rounded-2xl border border-white/15 bg-white/5 p-5 transition-colors hover:border-white/40 hover:bg-white/10">
                <span className="flex items-center justify-between"><m.icon className="h-6 w-6 text-primary" /><span className="font-mono-label text-[9px] uppercase tracking-[0.18em] text-white/50">{m.kicker}</span></span>
                <span><span className="font-display block text-[26px] leading-tight">{m.title}</span><span className="mt-1.5 block text-[13px] leading-relaxed text-white/65">{m.sub}</span></span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="font-mono-label mt-8 text-[9px] text-white/40">Finn min reise, Overrask meg, Helgerulett og Budsjett lagrer ingenting. Par- og Venne-match lagrer svarene i 30 dager, bare for dem med lenken.</p>
      </motion.section>
    </Shell>
  );
}

/* ── Finn min reise (solo) ──────────────────────────────────────────────── */
function SoloResult({ answers, onRestart }: { answers: QuizAnswers; onRestart: () => void }) {
  const result = useMemo(() => scoreQuiz(answers), [answers]);
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [revealed, setRevealed] = useState(false);
  return (
    <motion.section key="result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 flex-col py-6">
      <p className="font-mono-label text-[10px] text-white/60">{result.isCouple ? "Vi to drar til …" : "Reisemålet ditt er …"}</p>
      <h2 className="font-display mt-3 text-5xl leading-[0.95] sm:text-7xl">{result.top.city}<span className="italic text-white/70" style={{ fontWeight: 400 }}>, {result.top.country}</span></h2>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="font-mono-label mb-1.5 block text-[9px] text-white/50">{result.isCouple ? "Ditt navn" : "Navn på kortet (valgfritt)"}</span><input value={names[0]} onChange={(e) => setNames([e.target.value, names[1]])} placeholder={result.isCouple ? "Deg" : "Den reisende"} maxLength={24} className={darkInput} /></label>
        {result.isCouple && <label className="block"><span className="font-mono-label mb-1.5 block text-[9px] text-white/50">Den du inviterer</span><input value={names[1]} onChange={(e) => setNames([names[0], e.target.value])} placeholder="Hen/han" maxLength={24} className={darkInput} /></label>}
      </div>
      <div className="mt-6"><ScratchReveal hint="Skrap frem boardingkortet ✦" onRevealed={() => setRevealed(true)}><BoardingPass destination={result.top} isCouple={result.isCouple} names={names} /></ScratchReveal></div>
      {result.isCouple && revealed && (
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="font-display mt-6 flex items-start gap-3 text-lg italic text-white/85" style={{ fontWeight: 400 }}><Heart className="mt-1 h-5 w-5 shrink-0 text-primary" fill="currentColor" />{result.top.romance}</motion.p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to={searchHref(result.top.iata)} className={primaryBtn}><Plane className="h-4 w-4" /> Søk ekte fly til {result.top.city}</Link>
        {result.isCouple && <Link to="/quiz/par" className={ghostBtn}><Heart className="h-4 w-4" /> Gjør det til en Par-match</Link>}
        <span className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm text-white/75"><Camera className="h-4 w-4" /> Ta en skjermdump og send den</span>
        <button type="button" onClick={onRestart} className={ghostBtn}><RotateCcw className="h-4 w-4" /> På nytt</button>
      </div>
      <div className="mt-12 border-t border-white/10 pt-8">
        <p className="font-mono-label text-[10px] text-white/50">To andre som passer deg</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {result.alternatives.map((alt) => (
            <Link key={alt.id} to={searchHref(alt.iata)} className="group relative overflow-hidden rounded-xl">
              <div className="relative aspect-[16/8]">
                <img src={alt.image} alt={alt.city} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5"><div><p className="font-display text-2xl">{alt.city}</p><p className="text-sm text-white/70">{alt.tagline}</p></div><ArrowRight className="h-5 w-5 text-white/70 transition-transform group-hover:translate-x-1" /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function SoloMode() {
  const [phase, setPhase] = useState<"intro" | "questions" | "result">("intro");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  return (
    <Shell back="/quiz">
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.section key="intro" {...slide} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85"><Sparkles className="h-3.5 w-3.5" /> Finn min reise · 5 spørsmål · 30 sekunder</p>
            <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">Vet du ikke hvor du vil dra?<span className="block italic" style={{ fontWeight: 400 }}>Vi skraper det frem.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">Svar på fem kjappe spørsmål om stemning, vær og hvem du reiser med — så matcher vi deg med reisemålet ditt og lager et boardingkort du kan sende til noen du er glad i.</p>
            <button type="button" onClick={() => setPhase("questions")} className={cn(primaryBtn, "mt-10 px-9 py-4 text-base active:scale-[0.98]")}>Start <ArrowRight className="h-5 w-5" /></button>
            <p className="font-mono-label mt-5 text-[9px] text-white/40">Ingen innlogging · ingenting lagres</p>
          </motion.section>
        )}
        {phase === "questions" && <QuestionFlow key="q" onDone={(a) => { setAnswers(a); setPhase("result"); }} onExit={() => setPhase("intro")} />}
        {phase === "result" && <SoloResult key="r" answers={answers} onRestart={() => { setAnswers({}); setPhase("intro"); }} />}
      </AnimatePresence>
    </Shell>
  );
}

/* ── Par- og Venne-match: start ─────────────────────────────────────────── */
function GroupStart({ mode }: { mode: "par" | "venner" }) {
  const navigate = useNavigate();
  const couple = mode === "par";
  const [phase, setPhase] = useState<"intro" | "questions">("intro");
  const [name, setName] = useState(rememberedName);
  const [title, setTitle] = useState("");
  const [shareBudget, setShareBudget] = useState(false);
  const create = trpc.match.create.useMutation({
    onSuccess: (r) => {
      saveMatchKeys(r.token, { participantKey: r.participantKey, ownerKey: r.ownerKey, name });
      rememberName(name);
      navigate(`/m/${r.token}`, { replace: true });
    },
  });
  const canStart = name.trim().length > 0;
  return (
    <Shell back="/quiz">
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.section key="intro" {...slide} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="py-6">
            <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85">{couple ? <Heart className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />} {couple ? "Par-match" : "Venne-match"}</p>
            <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">{couple ? "Dere svarer hver for dere." : "Hvor skal vi, egentlig?"}<span className="block italic" style={{ fontWeight: 400 }}>{couple ? "Så viser vi hva dere er enige om." : "Alle svarer. Ingen taper."}</span></h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">
              {couple
                ? "Du svarer nå og får en lenke. Den andre svarer uten å se svarene dine. Vi viser bare det dere er enige om — og tre reisemål som passer begge. Budsjett holdes privat med mindre begge sier ja."
                : "Du lager rommet og får en lenke til gjengen. Hver enkelt svarer for seg, sier når de ikke kan, og stemmer på forslagene. Budsjett er privat for hver enkelt til alle har delt."}
            </p>
            <div className="mt-8 grid max-w-xl gap-3">
              <label className="block"><span className="font-mono-label mb-1.5 block text-[9px] text-white/50">Navnet ditt</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Slik de andre ser deg" maxLength={40} className={darkInput} /></label>
              {!couple && <label className="block"><span className="font-mono-label mb-1.5 block text-[9px] text-white/50">Hva heter turen? (valgfritt)</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sommerturen 2027" maxLength={80} className={darkInput} /></label>}
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/15 px-4 text-sm">
                <span>Del budsjettsvaret mitt med de andre</span>
                <input type="checkbox" checked={shareBudget} onChange={(e) => setShareBudget(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
              </label>
            </div>
            <button type="button" disabled={!canStart} onClick={() => setPhase("questions")} className={cn(primaryBtn, "mt-8 disabled:opacity-40")}>Svar på spørsmålene <ArrowRight className="h-4 w-4" /></button>
            {create.isError && <p role="alert" className="mt-3 text-sm text-primary">{humanMessage(create.error)}</p>}
          </motion.section>
        )}
        {phase === "questions" && (
          <QuestionFlow
            key="q"
            skip={["company"]}
            onDone={(answers) => create.mutate({ mode: couple ? "couple" : "friends", title: title || undefined, name: name.trim(), answers: { ...answers, company: couple ? "date" : "friends" }, shareBudget })}
            onExit={() => setPhase("intro")}
          />
        )}
      </AnimatePresence>
      {create.isPending && <p className="font-mono-label mt-4 text-[10px] text-white/60">Lager lenken …</p>}
    </Shell>
  );
}

/* ── Overrask meg ───────────────────────────────────────────────────────── */
const TASTE_TO_TAGS: Record<string, (d: QuizDestination) => boolean> = {
  beach: (d) => d.sights.includes("beach"),
  food: (d) => d.sights.includes("food"),
  nature: (d) => d.sights.includes("nature"),
  culture: (d) => d.sights.includes("landmarks"),
  city: (d) => d.mood.includes("city"),
  calm: (d) => d.mood.includes("relax"),
  adventure: (d) => d.mood.includes("adventure"),
  romantic: (d) => d.mood.includes("romance"),
  family: (d) => d.company.includes("family"),
  nightlife: (d) => d.mood.includes("city"),
  luxury: (d) => d.budget.includes("high"),
};

function pickWeighted(taste: Partial<Record<string, number>>, exclude?: string): QuizDestination {
  const pool = QUIZ_DESTINATIONS.filter((d) => d.id !== exclude);
  const weights = pool.map((d) => 1 + Object.entries(taste).reduce((w, [k, v]) => (v && v >= 60 && TASTE_TO_TAGS[k]?.(d) ? w + v / 50 : w), 0));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function SurpriseMode() {
  const { profile } = useTravelProfile();
  const [pick, setPick] = useState<QuizDestination | null>(null);
  const [spin, setSpin] = useState(0);
  const roll = () => {
    setPick(null);
    setTimeout(() => {
      setPick(pickWeighted((profile?.taste ?? {}) as Partial<Record<string, number>>, pick?.id));
      setSpin((s) => s + 1);
    }, 260);
  };
  return (
    <Shell back="/quiz">
      <section className="py-6">
        <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85"><Dices className="h-3.5 w-3.5" /> Overrask meg</p>
        <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">Ett reisemål.<span className="block italic" style={{ fontWeight: 400 }}>{profile && Object.keys(profile.taste).length ? "Vektet etter smaksprofilen din." : "Helt tilfeldig — eller nesten."}</span></h1>
        {!pick ? (
          <button type="button" onClick={roll} className={cn(primaryBtn, "mt-10 px-9 py-4 text-base")}><Dices className="h-5 w-5" /> Snurr</button>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={spin} initial={{ opacity: 0, y: 24, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mt-8 max-w-2xl">
              <BoardingPass destination={pick} isCouple={false} names={["", ""]} />
              <p className="font-display mt-5 text-lg italic text-white/85" style={{ fontWeight: 400 }}>{pick.tagline} — {pick.romance}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={searchHref(pick.iata)} className={primaryBtn}><Plane className="h-4 w-4" /> Søk ekte fly til {pick.city}</Link>
                <button type="button" onClick={roll} className={ghostBtn}><RotateCcw className="h-4 w-4" /> Snurr igjen</button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
        {!profile && <p className="font-mono-label mt-8 text-[9px] text-white/40">Logg inn og fyll ut reiseprofilen, så treffer ruletten bedre.</p>}
      </section>
    </Shell>
  );
}

/* ── Helgerulett ────────────────────────────────────────────────────────── */
const WEEKEND_IDS = ["london", "paris", "barcelona", "lisboa", "rome", "athens", "malaga", "warszawa", "istanbul"];
function nextFriday(): number {
  const d = new Date(Date.now() + 10 * 86_400_000);
  return 10 + ((5 - d.getUTCDay() + 7) % 7);
}
function WeekendMode() {
  // Helgen regnes én gang per sidevisning — rene render.
  const [depart] = useState(() => new Date(Date.now() + nextFriday() * 86_400_000));
  const cities = useMemo(() => QUIZ_DESTINATIONS.filter((d) => WEEKEND_IDS.includes(d.id)), []);
  const [pick, setPick] = useState<QuizDestination | null>(null);
  const [n, setN] = useState(0);
  const roll = () => { setPick(cities[Math.floor(Math.random() * cities.length)]); setN((x) => x + 1); };
  const home = new Date(depart.getTime() + 2 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Shell back="/quiz">
      <section className="py-6">
        <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85"><Plane className="h-3.5 w-3.5" /> Helgerulett</p>
        <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">Ut {fmt(depart)}.<span className="block italic" style={{ fontWeight: 400 }}>Hjem {fmt(home)}.</span></h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">Vi trekker byen. Du sjekker den ekte prisen med ett trykk — datoene er allerede satt.</p>
        {!pick ? (
          <button type="button" onClick={roll} className={cn(primaryBtn, "mt-10 px-9 py-4 text-base")}><Dices className="h-5 w-5" /> Trekk en by</button>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={n} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="mt-8 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl"><img src={pick.image} alt={pick.city} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-night/85 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6"><p className="font-display text-4xl sm:text-5xl">{pick.city}</p><p className="text-white/75">{pick.country} · {pick.tagline}</p></div></div>
              <div className="flex flex-col justify-end gap-3">
                <Link to={`/sok?from=OSL&to=${pick.iata}&depart=${depart.toISOString().slice(0, 10)}&ret=${home.toISOString().slice(0, 10)}&adults=1&children=0&infants=0&cabin=economy`} className={primaryBtn}><Plane className="h-4 w-4" /> Se ekte pris</Link>
                <button type="button" onClick={roll} className={ghostBtn}><RotateCcw className="h-4 w-4" /> Trekk på nytt</button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </Shell>
  );
}

/* ── Budsjettutfordring ─────────────────────────────────────────────────── */
function BudgetCard({ d }: { d: QuizDestination }) {
  const price = useRoutePrice("OSL", d.iata);
  return (
    <Link to={searchHref(d.iata)} className="group relative overflow-hidden rounded-xl">
      <div className="relative aspect-[16/9]">
        <img src={d.image} alt={d.city} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
        <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div><p className="font-display text-2xl">{d.city}</p><p className="text-sm text-white/70">{d.country}</p></div>
          {price ? <span className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground">{price}</span> : <ArrowRight className="h-5 w-5 text-white/70" />}
        </div>
      </div>
    </Link>
  );
}
function BudgetMode() {
  const [kr, setKr] = useState("5000");
  const n = Number(kr);
  const bucket = n < 3500 ? "low" : n < 7000 ? "mid" : "high";
  const list = QUIZ_DESTINATIONS.filter((d) => d.budget.includes(bucket) || (bucket === "high" && d.budget.includes("mid")));
  return (
    <Shell back="/quiz">
      <section className="py-6">
        <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85"><Wallet className="h-3.5 w-3.5" /> Budsjettutfordring</p>
        <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">Hva vil du bruke?<span className="block italic" style={{ fontWeight: 400 }}>Per person, tur/retur fra Oslo.</span></h1>
        <div className="mt-8 flex max-w-md items-center gap-3">
          <input type="range" min={1500} max={15000} step={250} value={n} onChange={(e) => setKr(e.target.value)} className="h-11 flex-1 accent-[hsl(var(--primary))]" aria-label="Budsjett per person" />
          <span className="w-28 text-right font-mono text-2xl tabular">{n.toLocaleString("nb-NO")} kr</span>
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/60">Utvalget bygger på typisk prisnivå for reisemålet, ikke dagens pris. Der vi har en veiledende «fra»-pris vises den; den ekte prisen ser du i søket.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((d) => <BudgetCard key={d.id} d={d} />)}</div>
      </section>
    </Shell>
  );
}

export default function Quiz() {
  usePageMeta(PAGE_META.quiz);
  const { mode } = useParams<{ mode?: Mode }>();
  switch (mode) {
    case "finn": return <SoloMode />;
    case "par": return <GroupStart mode="par" />;
    case "venner": return <GroupStart mode="venner" />;
    case "overrask": return <SurpriseMode />;
    case "helg": return <WeekendMode />;
    case "budsjett": return <BudgetMode />;
    default: return <Hub />;
  }
}
