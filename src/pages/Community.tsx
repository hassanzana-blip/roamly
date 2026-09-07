import { useState } from "react";
import { Link } from "react-router";
import {
  Heart,
  HelpCircle,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

type FeedPost = RouterOutputs["community"]["feed"]["posts"][number];

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
    >
      {initials}
    </span>
  );
}

function timeAgo(iso: string | Date): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "nå";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function CommentThread({ post }: { post: FeedPost }) {
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const comments = trpc.community.comments.useQuery({ postId: post.id });
  const [text, setText] = useState("");
  const add = trpc.community.createComment.useMutation({
    onSuccess: () => {
      setText("");
      utils.community.comments.invalidate({ postId: post.id });
      utils.community.feed.invalidate();
    },
  });
  const del = trpc.community.deleteComment.useMutation({
    onSuccess: () => {
      utils.community.comments.invalidate({ postId: post.id });
      utils.community.feed.invalidate();
    },
  });

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {comments.data?.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar url={c.avatarUrl} name={c.author} size={24} />
          <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3.5 py-2.5">
            <p className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="font-semibold">{c.author}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">{c.body}</p>
          </div>
          {c.mine && (
            <button
              onClick={() => del.mutate({ id: c.id })}
              aria-label="Slett kommentaren din"
              className="self-start p-1 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Icon icon={Trash2} size={16} />
            </button>
          )}
        </div>
      ))}
      {comments.data?.length === 0 && (
        <p className="text-[12px] text-muted-foreground">Ingen svar ennå – bli den første!</p>
      )}
      {customer ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate({ postId: post.id, body: text.trim() });
          }}
        >
          <Avatar url={customer.avatarUrl ?? null} name={customer.firstName} size={24} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv et svar …"
            maxLength={1000}
            className="min-h-10 flex-1 rounded-lg border border-border bg-background px-4 text-[13px] outline-none focus:border-foreground/30"
          />
          <button
            type="submit"
            disabled={!text.trim() || add.isPending}
            aria-label="Send svar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night text-white transition-colors hover:opacity-90 disabled:opacity-40"
          >
            <Icon icon={Send} size={16} />
          </button>
        </form>
      ) : (
        <Link to="/logg-inn" className="block text-[12px] font-semibold text-[hsl(var(--skyline))]">
          Logg inn for å svare →
        </Link>
      )}
    </div>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const like = trpc.community.toggleLike.useMutation({
    onSuccess: () => utils.community.feed.invalidate(),
  });
  const del = trpc.community.deletePost.useMutation({
    onSuccess: () => utils.community.feed.invalidate(),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar url={post.avatarUrl} name={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[14px] font-semibold">{post.author}</p>
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                post.kind === "question"
                  ? "bg-warning/10 text-warning dark:bg-amber-400/15 dark:text-amber-300"
                  : "bg-accent text-accent-foreground",
              )}
            >
              <Icon icon={post.kind === "question" ? HelpCircle : Sparkles} size={16} />
              {post.kind === "question" ? "Spørsmål" : "Reisetips"}
            </span>
            {post.routeTag && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Icon icon={MapPin} size={16} /> {post.routeTag}
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{post.body}</p>
        </div>
        {post.mine && (
          <button
            onClick={() => del.mutate({ id: post.id })}
            aria-label="Slett innlegget ditt"
            className="p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Icon icon={Trash2} size={16} />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
        <button
          onClick={() => customer && like.mutate({ postId: post.id })}
          aria-pressed={post.likedByMe}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
            post.likedByMe
              ? "bg-coral/10 text-coral"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon icon={Heart} size={16} className={post.likedByMe ? "fill-coral" : ""} />
          {post.likes > 0 ? post.likes : "Liker"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
            open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon icon={MessageCircle} size={16} />
          {post.commentCount > 0 ? `${post.commentCount} svar` : "Svar"}
        </button>
      </div>
      {open && <CommentThread post={post} />}
    </article>
  );
}

export default function Community() {
  usePageMeta(PAGE_META.community);
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<"all" | "question" | "story">("all");
  const [postKind, setPostKind] = useState<"story" | "question">("story");
  const [body, setBody] = useState("");
  const [routeTag, setRouteTag] = useState("");
  const feed = trpc.community.feed.useQuery({ kind });
  const create = trpc.community.createPost.useMutation({
    onSuccess: () => {
      setBody("");
      setRouteTag("");
      utils.community.feed.invalidate();
    },
  });

  const routeValid = /^[A-Za-z]{3}[–-][A-Za-z]{3}$/.test(routeTag.trim());

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title="Samfunn" />

        {/* Intro */}
        <div className="mb-5 rounded-xl bg-night p-5 text-white">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <Icon icon={Users} size={16} /> HelloSky-samfunnet
          </p>
          <h1 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
            Reisende hjelper reisende
          </h1>
          <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/70">
            Del reisetips, spør om ruter og visum, og hjelp andre som drar hjem til familien.
            Alle innlegg kommer fra ekte HelloSky-kunder.
          </p>
        </div>

        {/* Skriveramme */}
        {customer ? (
          <form
            className="mb-5 rounded-xl border border-border bg-card p-4 shadow-soft"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim().length >= 2)
                create.mutate({
                  kind: postKind,
                  body: body.trim(),
                  ...(routeValid ? { routeTag: routeTag.trim().toUpperCase().replace("-", "–") } : {}),
                });
            }}
          >
            <div className="flex items-start gap-3">
              <Avatar url={customer.avatarUrl ?? null} name={customer.firstName} />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex gap-1.5">
                  {(
                    [
                      { id: "story", label: "Reisetips", icon: Sparkles },
                      { id: "question", label: "Spørsmål", icon: HelpCircle },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setPostKind(k.id)}
                      aria-pressed={postKind === k.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        postKind === k.id
                          ? "border-night bg-night text-white"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon icon={k.icon} size={16} /> {k.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={
                    postKind === "question"
                      ? "Spør om hva som helst – visum, bagasje, beste tid å reise …"
                      : "Del et tips fra reisen din – flyplass, bagasje, lokale triks …"
                  }
                  className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-foreground/30"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={routeTag}
                    onChange={(e) => setRouteTag(e.target.value)}
                    placeholder="Rute? f.eks. OSL–EBL"
                    maxLength={7}
                    className={cn(
                      "min-h-10 w-36 rounded-full border bg-background px-4 text-[12px] font-semibold uppercase outline-none",
                      routeTag && !routeValid ? "border-coral" : "border-border focus:border-foreground/30",
                    )}
                  />
                  {create.isError && (
                    <span className="text-[12px] font-medium text-destructive">{humanMessage(create.error)}</span>
                  )}
                  <button
                    type="submit"
                    disabled={body.trim().length < 2 || create.isPending}
                    className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-40"
                  >
                    <Icon icon={Send} size={16} />
                    {create.isPending ? "Publiserer …" : "Publiser"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <Link
            to="/logg-inn"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-foreground/20"
          >
            <span className="text-[14px] font-semibold">Logg inn for å dele tips og stille spørsmål</span>
            <span className="shrink-0 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground">
              Logg inn
            </span>
          </Link>
        )}

        {/* Filter */}
        <div className="mb-4 flex gap-1.5">
          {(
            [
              { id: "all", label: "Alt" },
              { id: "question", label: "Spørsmål" },
              { id: "story", label: "Reisetips" },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={cn(
                "min-h-9 rounded-lg border px-4 text-[13px] font-semibold transition-colors",
                kind === k.id
                  ? "border-primary bg-primary text-night"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {feed.isLoading &&
            [0, 1, 2].map((i) => <div key={i} className="shimmer h-32 rounded-xl" />)}
          {feed.data?.posts.map((p) => <PostCard key={p.id} post={p} />)}
          {feed.data && feed.data.posts.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-soft">
              <Icon icon={Users} size={24} className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-display text-xl">Her blir det snart livlig</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                Bli den første til å dele et reisetips eller stille et spørsmål.
              </p>
            </div>
          )}
        </div>
      </AppShell>
    </div>
  );
}
