import { useEffect, useRef, useState } from "react";
import {
  Send,
  Pin,
  PinOff,
  Trash2,
  Plus,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  User,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Btn, Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "./ui";
import { formatDateTime, inputCls, labelCls } from "./helpers";

/* ── Teamchat ─────────────────────────────────────────────────────────────── */

export function AdminMessages() {
  const utils = trpc.useUtils();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const messages = trpc.team.listMessages.useQuery(
    { afterId: 0 },
    { refetchInterval: 4000 },
  );
  const send = trpc.team.sendMessage.useMutation({
    onSuccess: () => utils.team.listMessages.invalidate(),
  });
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const submit = () => {
    const text = body.trim();
    if (!text || send.isPending) return;
    setBody("");
    send.mutate({ body: text });
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Teamchat"
        description="Internmeldinger mellom ansatte — kun synlig for dere."
      />
      <Card className="flex min-h-0 flex-1 flex-col !p-0 overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.isLoading && <LoadingRows rows={3} />}
          {messages.data?.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Ingen meldinger ennå — si hei til teamet! 👋
              </p>
            </div>
          )}
          {messages.data?.map((m) => {
            const mine = m.senderId === me.data?.userId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] sm:max-w-[65%]", mine && "text-right")}>
                  {!mine && (
                    <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{m.senderName}</p>
                  )}
                  <div
                    className={cn(
                      "inline-block rounded-lg px-4 py-2.5 text-left text-sm leading-relaxed shadow-sm",
                      mine
                        ? "rounded-br-md bg-primary text-white"
                        : "rounded-bl-md border border-border bg-card text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-border bg-night/[0.02] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Skriv en melding til teamet … (Enter for å sende)"
              rows={1}
              className={cn(inputCls, "min-h-[44px] resize-none")}
            />
            <Btn onClick={submit} disabled={!body.trim() || send.isPending} className="h-11 w-11 !rounded-xl !px-0">
              <Send className="h-4 w-4" />
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Notattavle ───────────────────────────────────────────────────────────── */

type NoteColor = "sun" | "sky" | "leaf" | "rose";
const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; label: string }> = {
  sun: { bg: "bg-warning/10", border: "border-warning/30", label: "Sol" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", label: "Himmel" },
  leaf: { bg: "bg-success/5", border: "border-success/30", label: "Blad" },
  rose: { bg: "bg-destructive/5", border: "border-destructive/30", label: "Rose" },
};

export function AdminNotes() {
  const utils = trpc.useUtils();
  const notes = trpc.team.listNotes.useQuery();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("sun");
  const [pinned, setPinned] = useState(false);

  const invalidate = () => utils.team.listNotes.invalidate();
  const create = trpc.team.createNote.useMutation({
    onSuccess: () => {
      setOpen(false); setTitle(""); setBody(""); setPinned(false);
      invalidate();
    },
  });
  const update = trpc.team.updateNote.useMutation({ onSuccess: invalidate });
  const remove = trpc.team.deleteNote.useMutation({ onSuccess: invalidate });

  return (
    <div>
      <PageHeader
        title="Notattavle"
        description="Felles notater for teamet — fest de viktigste øverst."
        actions={
          <Btn onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> Nytt notat
          </Btn>
        }
      />

      {open && (
        <Card className="mb-6 border-primary/30">
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Tittel</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks. Husk å sjekke juletrafikken" />
            </div>
            <div>
              <label className={labelCls}>Notat</label>
              <textarea className={cn(inputCls, "min-h-[110px]")} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Skriv det teamet må huske …" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={NOTE_COLORS[c].label}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      NOTE_COLORS[c].bg,
                      color === c ? "scale-110 border-night" : "border-transparent",
                    )}
                  />
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 accent-primary" />
                Fest øverst
              </label>
              <div className="ml-auto flex gap-2">
                <Btn tone="ghost" onClick={() => setOpen(false)}>Avbryt</Btn>
                <Btn
                  onClick={() => create.mutate({ title, body, color, pinned })}
                  disabled={!title.trim() || !body.trim() || create.isPending}
                >
                  Lagre notat
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {notes.isLoading && <LoadingRows />}
      {notes.isError && <ErrorState />}
      {notes.data?.length === 0 && (
        <EmptyState title="Ingen notater ennå" hint="Legg ut det første notatet for teamet." />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {notes.data?.map((n) => {
          const c = NOTE_COLORS[(n.color as NoteColor)] ?? NOTE_COLORS.sun;
          const mine = n.authorId === me.data?.userId || me.data?.role === "OWNER";
          return (
            <div
              key={n.id}
              className={cn(
                "group relative rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md",
                c.bg, c.border,
                n.pinned && "ring-2 ring-night/10",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-display text-xl font-semibold leading-snug text-foreground">{n.title}</h3>
                {n.pinned && <Pin className="h-4 w-4 shrink-0 rotate-45 text-muted-foreground" />}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{n.body}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3 w-3" /> {n.authorName} · {formatDateTime(n.updatedAt)}
                </span>
                {mine && (
                  <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={n.pinned ? "Løsne" : "Fest"}
                      onClick={() => update.mutate({ id: n.id, pinned: !n.pinned })}
                      className="rounded-lg p-1.5 hover:bg-night/10"
                    >
                      {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Slett"
                      onClick={() => remove.mutate({ id: n.id })}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Problemmeldinger ─────────────────────────────────────────────────────── */

const SEVERITY = {
  low: { label: "Lav", tone: "neutral" as const },
  medium: { label: "Middels", tone: "info" as const },
  high: { label: "Høy", tone: "warning" as const },
  critical: { label: "Kritisk", tone: "danger" as const },
};

const PROBLEM_STATUS = {
  open: { label: "Åpen", tone: "danger" as const, icon: AlertTriangle },
  in_progress: { label: "Under arbeid", tone: "warning" as const, icon: Loader2 },
  resolved: { label: "Løst", tone: "success" as const, icon: CheckCircle2 },
};

export function AdminProblems() {
  const utils = trpc.useUtils();
  const problems = trpc.team.listProblems.useQuery();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<keyof typeof SEVERITY>("medium");

  const invalidate = () => utils.team.listProblems.invalidate();
  const create = trpc.team.createProblem.useMutation({
    onSuccess: () => { setOpen(false); setTitle(""); setDescription(""); invalidate(); },
  });
  const update = trpc.team.updateProblem.useMutation({ onSuccess: invalidate });

  const canWrite = me.data?.role !== "READ_ONLY";
  const active = problems.data?.items.filter((p) => p.status !== "resolved") ?? [];
  const resolved = problems.data?.items.filter((p) => p.status === "resolved") ?? [];

  return (
    <div>
      <PageHeader
        title="Problemmeldinger"
        description="Meld fra om feil og problemer — og følg dem til de er løst."
        actions={
          canWrite ? (
            <Btn tone="danger" onClick={() => setOpen((v) => !v)}>
              <AlertTriangle className="h-4 w-4" /> Meld problem
            </Btn>
          ) : undefined
        }
      />

      {open && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5/40">
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Hva er problemet?</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kort og tydelig tittel" />
            </div>
            <div>
              <label className={labelCls}>Beskrivelse</label>
              <textarea className={cn(inputCls, "min-h-[110px]")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hva skjedde, hvor, og hva bør gjøres?" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {(Object.keys(SEVERITY) as (keyof typeof SEVERITY)[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                      severity === s ? "bg-night text-white" : "bg-muted text-foreground/60 hover:bg-night/10",
                    )}
                  >
                    {SEVERITY[s].label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <Btn tone="ghost" onClick={() => setOpen(false)}>Avbryt</Btn>
                <Btn tone="danger" onClick={() => create.mutate({ title, description, severity })}
                  disabled={!title.trim() || !description.trim() || create.isPending}>
                  Send melding
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {problems.isLoading && <LoadingRows />}
      {problems.isError && <ErrorState />}
      {problems.data?.items.length === 0 && (
        <EmptyState title="Ingen problemer meldt" hint="Alt ser ut til å gå på skinner. 🎉" />
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((p) => {
            const st = PROBLEM_STATUS[p.status as keyof typeof PROBLEM_STATUS] ?? PROBLEM_STATUS.open;
            const sev = SEVERITY[p.severity as keyof typeof SEVERITY] ?? SEVERITY.medium;
            return (
              <Card key={p.id} className="!p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    p.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
                  )}>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{p.title}</h3>
                      <Pill tone={sev.tone}>{sev.label}</Pill>
                      <Pill tone={st.tone}>
                        <st.icon className="h-3 w-3" /> {st.label}
                      </Pill>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/75">{p.description}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Meldt av {p.reporterName} · {formatDateTime(p.createdAt)}
                      {p.assignedToId && problems.data?.assignees.find((a) => a.id === p.assignedToId) && (
                        <> · Ansvarlig: {problems.data.assignees.find((a) => a.id === p.assignedToId)!.name}</>
                      )}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {p.status === "open" && (
                        <Btn tone="night" className="!px-3 !py-2 text-xs"
                          onClick={() => update.mutate({ id: p.id, status: "in_progress", assignedToId: me.data?.userId })}>
                          Ta saken
                        </Btn>
                      )}
                      <Btn tone="success" className="!px-3 !py-2 text-xs"
                        onClick={() => update.mutate({ id: p.id, status: "resolved" })}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Løst
                      </Btn>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
            Vis {resolved.length} løste {resolved.length === 1 ? "sak" : "saker"}
          </summary>
          <div className="mt-3 space-y-2 opacity-70">
            {resolved.map((p) => (
              <Card key={p.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <p className="flex-1 text-sm font-semibold text-foreground line-through decoration-night/30">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Løst {formatDateTime(p.resolvedAt)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
