import { useState } from "react";
import { Link, useParams } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, Copy, Heart, Link2, Plane, Send, ThumbsDown, ThumbsUp, Users, X } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import BoardingPass from "@/components/quiz/BoardingPass";
import QuestionFlow from "./quiz/QuestionFlow";
import { WhatsAppIcon } from "@/components/WhatsAppFab";
import { QUESTIONS, QUIZ_DESTINATIONS } from "@/content/quiz";
import { searchHref } from "@/content/discover";
import { matchKeysFor, rememberName, rememberedName, saveMatchKeys } from "@/lib/matchKeys";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { isShareToken } from "@contracts/shareTokens";

/**
 * /m/:token – rommet for Par- og Venne-match. Uten deltakernøkkel: bli med
 * (navn + svar). Med nøkkel: enighet, kandidater, stemmer, kommentarer og
 * «vi drar hit». Aldri andres rå svar.
 */

const darkInput = "w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-white/60";
const primaryBtn = "inline-flex min-h-12 items-center gap-2 rounded-lg bg-card px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary hover:text-white disabled:opacity-40";
const ghostBtn = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-medium text-white/75 transition-colors hover:border-white/60 hover:text-white";

function labelFor(dim: string, value: string): string {
  const q = QUESTIONS.find((x) => x.key === dim);
  return q?.options.find((o) => o.id === value)?.label ?? value;
}

export default function MatchSession() {
  const { token = "" } = useParams<{ token: string }>();
  usePageMeta({ title: "ReiseMatch", description: "Finn ut hvor dere skal – sammen.", canonicalPath: `/m/${token}`, noindex: true });
  const [keys, setKeys] = useState(() => matchKeysFor(token));
  const utils = trpc.useUtils();
  const q = trpc.match.get.useQuery({ token, participantKey: keys.participantKey, ownerKey: keys.ownerKey }, { enabled: isShareToken(token), retry: false, refetchInterval: 20_000 });
  const invalidate = () => utils.match.get.invalidate({ token, participantKey: keys.participantKey, ownerKey: keys.ownerKey });
  const join = trpc.match.join.useMutation({ onSuccess: (r, vars) => { saveMatchKeys(token, { participantKey: r.participantKey, name: vars.name }); rememberName(vars.name); setKeys(matchKeysFor(token)); invalidate(); } });
  const vote = trpc.match.vote.useMutation({ onSuccess: invalidate });
  const comment = trpc.match.comment.useMutation({ onSuccess: () => { setBody(""); invalidate(); } });
  const decide = trpc.match.decide.useMutation({ onSuccess: invalidate });

  const [phase, setPhase] = useState<"intro" | "questions">("intro");
  const [name, setName] = useState(rememberedName);
  const [shareBudget, setShareBudget] = useState(false);
  const [unavailable, setUnavailable] = useState<{ from: string; to: string }[]>([]);
  const [uFrom, setUFrom] = useState("");
  const [uTo, setUTo] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  const s = q.data;
  const isMember = Boolean(s?.participants.some((p) => p.isYou));
  const couple = s?.mode === "couple";

  const copy = async () => {
    if (!s) return;
    try { await navigator.clipboard.writeText(s.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignorer */ }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-night text-white">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-24 outline-none sm:px-6 sm:pt-28">
        <MotionConfig reducedMotion="user">
          {q.isError && (
            <section className="py-10"><h1 className="font-display text-4xl">Fant ikke matchen.</h1><p className="mt-3 text-white/70">{humanMessage(q.error)}</p><Link to="/quiz" className={cn(primaryBtn, "mt-6")}>Lag en ny</Link></section>
          )}
          {s && !isMember && (
            <AnimatePresence mode="wait">
              {phase === "intro" ? (
                <motion.section key="join" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="py-6">
                  <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85">{couple ? <Heart className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />} {couple ? "Par-match" : "Venne-match"} · {s.title}</p>
                  <h1 className="font-display mt-7 max-w-3xl text-5xl leading-[0.98] sm:text-7xl">{s.participants[0]?.name ?? "Noen"} vil vite hvor dere skal.<span className="block italic" style={{ fontWeight: 400 }}>Svar for deg selv – vi viser bare det dere er enige om.</span></h1>
                  {s.participants.length >= s.maxParticipants ? (
                    <p className="mt-6 text-white/70">{couple ? "Begge har allerede svart i denne matchen." : "Rommet er fullt."}</p>
                  ) : (
                    <div className="mt-8 grid max-w-xl gap-3">
                      <label className="block"><span className="font-mono-label mb-1.5 block text-[9px] text-white/50">Navnet ditt</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Slik de andre ser deg" className={darkInput} /></label>
                      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/15 px-4 text-sm"><span>Del budsjettsvaret mitt</span><input type="checkbox" checked={shareBudget} onChange={(e) => setShareBudget(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" /></label>
                      {!couple && (
                        <div className="rounded-xl border border-white/15 p-4">
                          <p className="text-sm font-semibold">Når kan du ikke? (valgfritt)</p>
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <label className="block"><span className="font-mono-label mb-1 block text-[9px] text-white/50">Fra</span><input type="date" value={uFrom} onChange={(e) => setUFrom(e.target.value)} className={cn(darkInput, "min-w-[150px]")} /></label>
                            <label className="block"><span className="font-mono-label mb-1 block text-[9px] text-white/50">Til</span><input type="date" value={uTo} onChange={(e) => setUTo(e.target.value)} className={cn(darkInput, "min-w-[150px]")} /></label>
                            <button type="button" disabled={!uFrom || !uTo || uTo < uFrom || unavailable.length >= 12} onClick={() => { setUnavailable((u) => [...u, { from: uFrom, to: uTo }]); setUFrom(""); setUTo(""); }} className={cn(ghostBtn, "disabled:opacity-40")}>Legg til</button>
                          </div>
                          {unavailable.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{unavailable.map((r, i) => <li key={i} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[12px]">{r.from} – {r.to}<button type="button" onClick={() => setUnavailable((u) => u.filter((_, j) => j !== i))} aria-label="Fjern"><X className="h-3.5 w-3.5" /></button></li>)}</ul>}
                        </div>
                      )}
                      <button type="button" disabled={!name.trim()} onClick={() => setPhase("questions")} className={cn(primaryBtn, "w-fit")}>Svar på spørsmålene</button>
                      {join.isError && <p role="alert" className="text-sm text-primary">{humanMessage(join.error)}</p>}
                    </div>
                  )}
                </motion.section>
              ) : (
                <QuestionFlow key="q" skip={["company"]} onDone={(answers) => join.mutate({ token, name: name.trim(), answers: { ...answers, company: couple ? "date" : "friends" }, shareBudget, unavailable: unavailable.length ? unavailable : undefined })} onExit={() => setPhase("intro")} />
              )}
            </AnimatePresence>
          )}

          {s && isMember && (
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="py-6">
              <p className="font-mono-label inline-flex items-center gap-2.5 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-[10px] text-white/85">{couple ? <Heart className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />} {couple ? "Par-match" : "Venne-match"}</p>
              <h1 className="font-display mt-6 text-4xl leading-[0.98] sm:text-6xl">{s.title}</h1>

              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Deltakere">
                {s.participants.map((p) => <li key={p.id} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-[13px]", p.isYou ? "border-primary text-primary" : "border-white/20 text-white/80")}>{p.name}{p.isYou ? " (deg)" : ""}{p.sharedBudget ? " · budsjett delt" : ""}</li>)}
                {s.participants.length < s.maxParticipants && <li className="inline-flex min-h-9 items-center rounded-md border border-dashed border-white/25 px-3 text-[13px] text-white/50">{couple ? "Venter på den andre" : `Plass til ${s.maxParticipants - s.participants.length} til`}</li>}
              </ul>

              {/* Del lenken */}
              <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-4">
                <Link2 className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/75">{s.shareUrl}</span>
                <button type="button" onClick={copy} className={ghostBtn}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Kopiert" : "Kopier"}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${couple ? "Hvor skal vi? Svar her, så ser vi hva vi er enige om:" : `Bli med i «${s.title}» – svar her:`} ${s.shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
              </div>

              {!s.ready && couple && <p className="mt-8 max-w-xl text-base text-white/70">Send lenken. Når den andre har svart, dukker resultatet opp her – automatisk.</p>}

              {s.ready && (
                <>
                  <div className="mt-10">
                    <p className="font-mono-label text-[10px] text-white/50">{couple ? "Dere er enige om" : "Gruppen er enig om"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(s.agreement).length === 0 && <span className="text-white/70">Ikke så mye ennå – men se kandidatene, de passer alle.</span>}
                      {Object.entries(s.agreement).map(([dim, v]) => <span key={dim} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-card px-3.5 text-[14px] font-semibold text-primary-foreground"><Check className="h-4 w-4" /> {labelFor(dim, v as string)}</span>)}
                    </div>
                    {!s.includeBudget && <p className="mt-2 text-[12px] text-white/50">Budsjett vises når alle har delt det.</p>}
                  </div>

                  {s.decided && (
                    <div className="mt-8 rounded-2xl border border-primary/50 bg-primary/10 p-5">
                      <p className="font-mono-label text-[10px] text-primary">Avgjort</p>
                      <p className="font-display mt-1 text-3xl">Vi drar til {s.decided.city}.</p>
                      <div className="mt-3 flex flex-wrap gap-2"><Link to={searchHref(s.decided.iata)} className={primaryBtn}><Plane className="h-4 w-4" /> Søk ekte fly</Link>{s.isOwner && <button type="button" onClick={() => decide.mutate({ token, ownerKey: keys.ownerKey, destinationId: null })} className={ghostBtn}>Angre</button>}</div>
                    </div>
                  )}

                  <div className="mt-8">
                    <p className="font-mono-label text-[10px] text-white/50">{couple ? "Tre steder som passer dere begge" : "Kandidater der ingen taper"}</p>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {s.results.map((r) => {
                        const mine = s.myVotes.find((v) => v.destinationId === r.destination.id)?.value ?? 0;
                        return (
                          <li key={r.destination.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            <div className="relative aspect-[16/9]"><img src={r.destination.image} alt={r.destination.city} loading="lazy" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-night/85 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4"><p className="font-display text-2xl">{r.destination.city}</p><p className="text-[13px] text-white/70">{r.destination.country} · {r.destination.tagline}</p></div></div>
                            <div className="p-4">
                              <p className="text-[12px] text-white/60">{r.inTopThree === s.participants.length ? "Blant topp tre hos alle" : `Blant topp tre hos ${r.inTopThree} av ${s.participants.length}`}</p>
                              {!couple && (
                                <div className="mt-3 flex items-center gap-2">
                                  <button type="button" onClick={() => vote.mutate({ token, participantKey: keys.participantKey!, destinationId: r.destination.id, value: mine === 1 ? 0 : 1 })} aria-pressed={mine === 1} className={cn(ghostBtn, "min-h-10", mine === 1 && "border-primary text-primary")}><ThumbsUp className="h-4 w-4" /> {r.votes.up}</button>
                                  <button type="button" onClick={() => vote.mutate({ token, participantKey: keys.participantKey!, destinationId: r.destination.id, value: mine === -1 ? 0 : -1 })} aria-pressed={mine === -1} className={cn(ghostBtn, "min-h-10", mine === -1 && "border-white text-white")}><ThumbsDown className="h-4 w-4" /> {r.votes.down}</button>
                                  {r.votes.names.length > 0 && <span className="text-[11px] text-white/50">{r.votes.names.join(", ")}</span>}
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link to={searchHref(r.destination.iata)} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-primary"><Plane className="h-4 w-4" /> Søk ekte fly</Link>
                                {!couple && s.isOwner && !s.decided && <button type="button" onClick={() => decide.mutate({ token, ownerKey: keys.ownerKey, destinationId: r.destination.id })} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:text-white"><Check className="h-4 w-4" /> Vi drar hit</button>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {couple && s.results[0] && (
                    <div className="mt-10 max-w-2xl">
                      <BoardingPass destination={QUIZ_DESTINATIONS.find((d) => d.id === s.results[0].destination.id)!} isCouple names={[s.participants[0]?.name ?? "", s.participants[1]?.name ?? ""]} />
                      <p className="font-display mt-4 flex items-start gap-3 text-lg italic text-white/85" style={{ fontWeight: 400 }}><Heart className="mt-1 h-5 w-5 shrink-0 text-primary" fill="currentColor" />{s.results[0].destination.romance}</p>
                    </div>
                  )}

                  {!couple && s.unavailable.length > 0 && (
                    <div className="mt-8">
                      <p className="font-mono-label text-[10px] text-white/50">Datoer å styre unna</p>
                      <ul className="mt-2 flex flex-wrap gap-2">{s.unavailable.map((u, i) => <li key={i} className="rounded-md bg-white/10 px-2.5 py-1 text-[12px]">{u.name}: {u.from} – {u.to}</li>)}</ul>
                    </div>
                  )}

                  {!couple && (
                    <div className="mt-8">
                      <p className="font-mono-label text-[10px] text-white/50">Kommentarer</p>
                      <ul className="mt-2 space-y-2">{s.comments.map((c) => <li key={c.id} className="rounded-lg bg-white/5 px-3.5 py-2.5 text-[14px]"><span className="font-semibold">{c.name}</span> <span className="text-white/80">{c.body}</span></li>)}</ul>
                      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) comment.mutate({ token, participantKey: keys.participantKey!, body: body.trim() }); }} className="mt-3 flex gap-2">
                        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Skriv til gjengen …" className={darkInput} />
                        <button type="submit" disabled={!body.trim() || comment.isPending} className={cn(primaryBtn, "shrink-0 px-4")} aria-label="Send"><Send className="h-4 w-4" /></button>
                      </form>
                    </div>
                  )}
                </>
              )}
              {(vote.isError || comment.isError || decide.isError) && <p role="alert" className="mt-4 text-sm text-primary">{humanMessage(vote.error ?? comment.error ?? decide.error)}</p>}
              <p className="font-mono-label mt-10 text-[9px] text-white/40">Svarene lagres i 30 dager og vises bare for dem med lenken. Ingen rå svar deles – bare enigheten.</p>
            </motion.section>
          )}
        </MotionConfig>
      </main>
      <SiteFooter />
    </div>
  );
}
