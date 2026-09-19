import { useState } from "react";
import { Link } from "react-router";
import { Bookmark, Ellipsis, Heart, Lock, MapPin, MessageCircle, Trash2 } from "lucide-react";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ALL_DESTINATIONS, imageSrcSet } from "@/content/discover";
import { humanMessage } from "@/lib/apiError";
import { formatDateShort } from "@/lib/format";
import { useSavedDestinations } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { cn } from "@/lib/utils";

export type FeedPost = RouterOutputs["social"]["posts"]["feed"]["posts"][number];
export type FeedPoll = RouterOutputs["social"]["posts"]["feed"]["polls"][number];

/** Første bokstav i en lavendel sirkel – vi viser aldri andres e-post eller bilde vi ikke har fått. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-lavender font-display font-bold text-foreground", size === "md" ? "size-[84px] text-[34px] sm:size-14 sm:text-[24px]" : "size-9 text-[15px]", className)} aria-hidden="true">
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function ActionButton({ icon, label, active, onClick, count, className }: { icon: typeof Heart; label: string; active?: boolean; onClick: () => void; count?: number; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg pr-1 text-[16px] text-foreground hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring sm:gap-2.5 sm:text-[18px]", className)}>
      <Icon icon={icon} size={24} strokeWidth={1.75} className={cn("sm:size-7", active && "fill-current text-like")} />
      <span>{label}{count ? ` · ${count}` : ""}</span>
    </button>
  );
}

function Comments({ postId }: { postId: number }) {
  const t = useT();
  const utils = trpc.useUtils();
  const list = trpc.social.posts.comments.useQuery({ postId }, { retry: false });
  const add = trpc.social.posts.comment.useMutation({ onSuccess: () => { utils.social.posts.comments.invalidate({ postId }); utils.social.posts.feed.invalidate(); setBody(""); } });
  const remove = trpc.social.posts.removeComment.useMutation({ onSuccess: () => { utils.social.posts.comments.invalidate({ postId }); utils.social.posts.feed.invalidate(); } });
  const [body, setBody] = useState("");
  return (
    <div className="mt-3 rounded-2xl bg-muted/60 p-4">
      {list.isLoading ? (
        <div className="shimmer h-10 rounded-lg" />
      ) : list.data?.length ? (
        <ul className="space-y-3">
          {list.data.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar name={c.author.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px]"><span className="font-semibold">{c.author.name}</span> <span className="text-muted-foreground">· {formatDateShort(String(c.createdAt))}</span></p>
                <p className="whitespace-pre-line text-[15px]">{c.body}</p>
              </div>
              {c.canRemove && (
                <button type="button" onClick={() => remove.mutate({ id: c.id })} aria-label={t("doc.remove")} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-destructive"><Icon icon={Trash2} size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted-foreground">{t("fr.comment.none")}</p>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate({ postId, body: body.trim() });
        }}
      >
        <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} placeholder={t("fr.comment.write")} aria-label={t("fr.comment.write")} className="bg-card" />
        <Button type="submit" variant="dark" disabled={!body.trim()} loading={add.isPending}>{t("fr.comment.send")}</Button>
      </form>
      {add.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(add.error)}</p>}
    </div>
  );
}

export function PostCard({ post, showGroupLink }: { post: FeedPost; showGroupLink?: boolean }) {
  const t = useT();
  const utils = trpc.useUtils();
  const like = trpc.social.posts.toggleLike.useMutation({ onSuccess: () => utils.social.posts.feed.invalidate() });
  const remove = trpc.social.posts.remove.useMutation({ onSuccess: () => utils.social.posts.feed.invalidate() });
  const report = trpc.social.report.useMutation();
  const { ids: saved, toggle: toggleSaved } = useSavedDestinations();
  const [open, setOpen] = useState(false);
  const d = post.destination;
  const isSaved = d ? saved.has(d.id) : false;
  const audience = post.audience === "group" ? (post.groupName ? `${post.groupName} · ${t("fr.onlygroup")}` : t("fr.onlygroup")) : t("fr.onlyfriends");

  return (
    <article className="border-b border-border pb-6">
      <header className="flex items-center gap-4">
        <Avatar name={post.author.name} />
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-bold leading-tight">{post.author.name}</p>
          <p className="truncate text-[17px] text-muted-foreground">
            {showGroupLink && post.groupId ? <Link to={`/profil/venner/grupper/${post.groupId}`} className="hover:underline">{audience}</Link> : audience}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t("fr.more")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={Ellipsis} size={28} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!post.mine && (
              <DropdownMenuItem onSelect={() => report.mutate({ targetType: "social_post", targetId: post.id, reason: "inappropriate" })}>
                {report.isSuccess ? t("fr.reported") : t("fr.report")}
              </DropdownMenuItem>
            )}
            {post.canRemove && <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate({ id: post.id })}>{t("fr.remove")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <p className="mt-4 whitespace-pre-line text-[24px] leading-snug text-foreground sm:text-[22px]">{post.body}</p>
      {d?.image && (
        <Link to={`/reisemal/${d.id}`} className="mt-4 block overflow-hidden rounded-2xl bg-muted">
          <img src={d.image} srcSet={imageSrcSet(d.image)} sizes="(max-width: 640px) 100vw, 680px" alt={d.imageAlt} className="aspect-[3/2] w-full object-cover" loading="lazy" decoding="async" />
        </Link>
      )}
      {d && (
        <p className="mt-3 flex items-center gap-2.5 text-[17px] text-muted-foreground"><Icon icon={MapPin} size={24} className="text-foreground" /> {d.city}, {d.country}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-3 sm:gap-5">
          <ActionButton icon={Heart} label={t("fr.like")} active={post.likedByMe} count={post.likes} onClick={() => like.mutate({ id: post.id })} />
          <ActionButton icon={MessageCircle} label={t("fr.comments")} active={open} count={post.commentCount} onClick={() => setOpen((o) => !o)} />
        </div>
        {d && <ActionButton icon={Bookmark} label={isSaved ? t("fr.saved") : t("fr.save")} active={isSaved} onClick={() => toggleSaved(d.id)} />}
      </div>
      {open && <Comments postId={post.id} />}
      {remove.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(remove.error)}</p>}
    </article>
  );
}

export function PollCard({ poll, canClose }: { poll: FeedPoll; canClose?: boolean }) {
  const t = useT();
  const utils = trpc.useUtils();
  const vote = trpc.social.polls.vote.useMutation({ onSuccess: () => { utils.social.posts.feed.invalidate(); utils.social.groups.get.invalidate(); } });
  const close = trpc.social.polls.close.useMutation({ onSuccess: () => { utils.social.posts.feed.invalidate(); utils.social.groups.get.invalidate(); } });
  const [choice, setChoice] = useState<number | null>(poll.myOptionId);
  const voted = poll.myOptionId !== null;
  return (
    <section className="border-b border-border pb-6" aria-labelledby={`poll-${poll.id}`}>
      <p className="flex items-center gap-3 text-[17px] text-muted-foreground"><Icon icon={Lock} size={24} className="text-foreground" /> {poll.groupName} · {t("fr.privategroup")}</p>
      <h2 id={`poll-${poll.id}`} className="t-h1 mt-2">{poll.question}</h2>
      <div role="radiogroup" aria-label={poll.question} className="mt-4 space-y-3">
        {poll.options.map((o) => {
          const selected = choice === o.id;
          const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(o.id)}
              className={cn("press flex min-h-[72px] w-full items-center gap-5 rounded-2xl px-5 text-left text-[22px] transition-colors focus-visible:outline-2 focus-visible:outline-ring", selected ? "bg-sky-soft ring-2 ring-primary" : "bg-sky-soft hover:bg-mint")}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2", selected ? "border-primary" : "border-foreground")} aria-hidden="true">{selected && <span className="size-4 rounded-full bg-primary" />}</span>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {voted && <span className="shrink-0 text-[15px] text-muted-foreground">{t("fr.poll.votes", { count: o.votes })}{poll.totalVotes ? ` · ${pct} %` : ""}</span>}
            </button>
          );
        })}
      </div>
      <Button size="xl" className="mt-4 w-full rounded-full" disabled={choice === null || choice === poll.myOptionId} loading={vote.isPending} onClick={() => choice !== null && vote.mutate({ pollId: poll.id, optionId: choice })}>
        {voted ? t("fr.poll.voted") : t("fr.poll.vote")}
      </Button>
      <p className="mt-2 text-center text-[15px] text-muted-foreground">{t("fr.poll.only")}</p>
      {canClose && (
        <div className="mt-2 text-center">
          <button type="button" onClick={() => close.mutate({ pollId: poll.id })} className="text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:underline">{t("fr.poll.close")}</button>
        </div>
      )}
      {vote.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(vote.error)}</p>}
    </section>
  );
}

/** Nytt innlegg: tekst, valgfritt reisemål, og hvem som ser det. */
export function Composer({ groups, fixedGroupId, onPosted }: { groups: { id: number; name: string }[]; fixedGroupId?: number; onPosted?: () => void }) {
  const t = useT();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(Boolean(fixedGroupId));
  const [body, setBody] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [audience, setAudience] = useState<string>(fixedGroupId ? `g:${fixedGroupId}` : "friends");
  const create = trpc.social.posts.create.useMutation({
    onSuccess: () => {
      utils.social.posts.feed.invalidate();
      setBody("");
      setDestinationId("");
      if (!fixedGroupId) setOpen(false);
      onPosted?.();
    },
  });
  const sorted = [...ALL_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city, "nb"));
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="press flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left text-[16px] text-muted-foreground hover:border-foreground/30">
        <Icon icon={MessageCircle} size={20} /> {t("fr.compose.ph")}
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const groupId = audience.startsWith("g:") ? Number(audience.slice(2)) : undefined;
        create.mutate({ audience: groupId ? "group" : "friends", groupId, destinationId: destinationId || undefined, body: body.trim() });
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} placeholder={t("fr.compose.ph")} aria-label={t("fr.compose")} autoFocus />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="post-dest" label={t("fr.compose.dest")}>
          <select id="post-dest" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
            <option value="">–</option>
            {sorted.map((d) => (
              <option key={d.id} value={d.id}>{d.city}, {d.country}</option>
            ))}
          </select>
        </FormField>
        {!fixedGroupId && (
          <FormField id="post-aud" label={t("fr.compose.audience")}>
            <select id="post-aud" value={audience} onChange={(e) => setAudience(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="friends">{t("fr.onlyfriends")}</option>
              {groups.map((g) => (
                <option key={g.id} value={`g:${g.id}`}>{g.name}</option>
              ))}
            </select>
          </FormField>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {!fixedGroupId && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.back")}</Button>}
        <Button type="submit" disabled={!body.trim()} loading={create.isPending}>{t("fr.compose.post")}</Button>
      </div>
      {create.isError && <p role="alert" className="text-[13px] text-destructive">{humanMessage(create.error)}</p>}
    </form>
  );
}

/** Ny avstemning i en gruppe: spørsmål og 2–6 alternativer, hvert med valgfritt reisemål. */
export function PollComposer({ groupId, onCreated }: { groupId: number; onCreated?: () => void }) {
  const t = useT();
  const utils = trpc.useUtils();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<{ label: string; destinationId: string }[]>([{ label: "", destinationId: "" }, { label: "", destinationId: "" }]);
  const create = trpc.social.polls.create.useMutation({ onSuccess: () => { utils.social.groups.get.invalidate({ id: groupId }); utils.social.posts.feed.invalidate(); setQuestion(""); setOptions([{ label: "", destinationId: "" }, { label: "", destinationId: "" }]); onCreated?.(); } });
  const sorted = [...ALL_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city, "nb"));
  const valid = question.trim().length > 0 && options.filter((o) => o.label.trim()).length >= 2;
  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ groupId, question: question.trim(), options: options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), destinationId: o.destinationId || undefined })) });
      }}
    >
      <FormField id="poll-q" label={t("fr.poll.q")}>
        <Input id="poll-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={120} placeholder={t("fr.poll.qph")} />
      </FormField>
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <select
            aria-label={`${t("fr.poll.option", { n: i + 1 })} – ${t("fr.compose.dest")}`}
            value={o.destinationId}
            onChange={(e) => {
              const d = ALL_DESTINATIONS.find((x) => x.id === e.target.value);
              setOptions((prev) => prev.map((x, j) => (j === i ? { destinationId: e.target.value, label: d ? d.city : x.label } : x)));
            }}
            className="h-11 w-2/5 rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="">–</option>
            {sorted.map((d) => (
              <option key={d.id} value={d.id}>{d.city}</option>
            ))}
          </select>
          <Input aria-label={t("fr.poll.option", { n: i + 1 })} value={o.label} maxLength={60} placeholder={t("fr.poll.option", { n: i + 1 })} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        {options.length < 6 ? <Button type="button" variant="ghost" onClick={() => setOptions((p) => [...p, { label: "", destinationId: "" }])}>{t("fr.poll.addoption")}</Button> : <span />}
        <Button type="submit" disabled={!valid} loading={create.isPending}>{t("fr.poll.create")}</Button>
      </div>
      {create.isError && <p role="alert" className="text-[13px] text-destructive">{humanMessage(create.error)}</p>}
    </form>
  );
}
