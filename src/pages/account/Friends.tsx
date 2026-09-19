import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Check, ChevronLeft, ChevronRight, Copy, MessageCircle, Share, Users, UserRound, UserRoundPlus, X } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { EmptyState, ErrorState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { LinkTabs } from "@/components/minside/LinkTabs";
import { Avatar, Composer, PollCard, PostCard, type FeedPost } from "@/components/minside/Social";
import { ALL_DESTINATIONS, imageSrcSet } from "@/content/discover";
import { copyText } from "@/lib/clipboard";
import { formatDateShort } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

type Tab = "foryou" | "groups" | "find";
const TAB_PARAM: Record<string, Tab> = { deg: "foryou", grupper: "groups", finn: "find" };
const PARAM_OF: Record<Tab, string> = { foryou: "deg", groups: "grupper", find: "finn" };

/**
 * Venner (godkjent design, ref 3).
 *
 * Tre faner: det vennene og gruppene dine deler, gruppene, og hvordan du
 * finner venner. Alt er privat: innlegg vises bare for venner eller
 * gruppemedlemmer, og serveren avgjør hva du får se, ikke klienten.
 */

function ForYou({ groups }: { groups: { id: number; name: string }[] }) {
  const t = useT();
  const utils = trpc.useUtils();
  const feed = trpc.social.posts.feed.useQuery({}, { retry: false, staleTime: 15_000 });
  const [older, setOlder] = useState<FeedPost[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setOlder([]);
    setNextBefore(undefined);
  }, [feed.data]);
  const cursor = nextBefore === undefined ? feed.data?.nextBefore ?? null : nextBefore;

  if (feed.isLoading) return <div className="space-y-4" aria-busy="true"><div className="shimmer h-20 rounded-2xl" /><div className="shimmer aspect-[3/2] rounded-2xl" /><div className="shimmer h-20 rounded-2xl" /></div>;
  if (feed.isError || !feed.data) return <ErrorState body={feed.error ? humanMessage(feed.error) : undefined} onRetry={() => feed.refetch()} />;
  const posts = [...feed.data.posts, ...older];
  const empty = posts.length === 0 && feed.data.polls.length === 0;

  return (
    <div className="space-y-6">
      <Composer groups={groups} />
      {empty ? (
        <EmptyState icon={Users} title={t("fr.feed.empty.title")} body={t("fr.feed.empty.body")} action={<Button asChild variant="dark" className="mt-2"><Link to="/profil/venner?fane=finn">{t("fr.addfriend")}</Link></Button>} />
      ) : (
        <>
          {posts.map((p, i) => (
            <div key={p.id} className="space-y-6">
              <PostCard post={p} showGroupLink />
              {i === 0 && feed.data.polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
            </div>
          ))}
          {posts.length === 0 && feed.data.polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
          {cursor && (
            <div className="text-center">
              <Button
                variant="outline"
                loading={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  try {
                    const page = await utils.social.posts.feed.fetch({ before: cursor });
                    setOlder((o) => [...o, ...page.posts]);
                    setNextBefore(page.nextBefore);
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {t("fr.feed.more")}
              </Button>
            </div>
          )}
        </>
      )}
      <div className="flex items-center gap-4 border-t border-border pt-5">
        <Icon icon={Users} size={28} strokeWidth={1.75} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-bold leading-tight">{t("fr.plan.title")}</p>
          <p className="text-[16px] text-muted-foreground">{t("fr.plan.body")}</p>
        </div>
        <Link to="/profil/venner?fane=grupper" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[17px] font-semibold text-accent-foreground hover:underline">{t("fr.plan.cta")} <Icon icon={ChevronRight} size={20} /></Link>
      </div>
    </div>
  );
}

function GroupsTab() {
  const t = useT();
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const groups = trpc.social.groups.list.useQuery(undefined, { retry: false });
  const create = trpc.social.groups.create.useMutation({ onSuccess: (g) => { utils.social.groups.list.invalidate(); navigate(`/profil/venner/grupper/${g.id}`); } });
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [open, setOpen] = useState(false);
  const sorted = [...ALL_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city, "nb"));
  if (groups.isLoading) return <div className="space-y-3" aria-busy="true"><div className="shimmer h-20 rounded-2xl" /><div className="shimmer h-20 rounded-2xl" /></div>;
  if (groups.isError) return <ErrorState body={humanMessage(groups.error)} onRetry={() => groups.refetch()} />;
  return (
    <div className="space-y-6">
      {groups.data?.length ? (
        <ul className="space-y-3">
          {groups.data.map((g) => (
            <li key={g.id}>
              <Link to={`/profil/venner/grupper/${g.id}`} className="press flex items-center gap-4 rounded-2xl border border-border bg-card p-3 hover:border-foreground/30">
                <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-lavender">
                  {g.cover?.image ? <img src={g.cover.image} srcSet={imageSrcSet(g.cover.image)} sizes="64px" alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full w-full place-items-center"><Icon icon={Users} size={24} /></span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-bold">{g.name}</span>
                  <span className="block text-[14px] text-muted-foreground">{t("fr.group.members", { count: g.memberCount })} · {t("fr.privategroup")}</span>
                </span>
                <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title={t("fr.group.empty.title")} body={t("fr.group.empty.body")} />
      )}
      {open ? (
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate({ name: name.trim(), coverDestinationId: cover || undefined });
          }}
        >
          <FormField id="g-name" label={t("fr.group.name")} required>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("fr.group.nameph")} autoFocus />
          </FormField>
          <FormField id="g-cover" label={t("fr.group.cover")}>
            <select id="g-cover" value={cover} onChange={(e) => setCover(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="">–</option>
              {sorted.map((d) => (
                <option key={d.id} value={d.id}>{d.city}, {d.country}</option>
              ))}
            </select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.back")}</Button>
            <Button type="submit" disabled={!name.trim()} loading={create.isPending}>{t("fr.group.new")}</Button>
          </div>
          {create.isError && <p role="alert" className="text-[13px] text-destructive">{humanMessage(create.error)}</p>}
        </form>
      ) : (
        <Button size="xl" className="w-full rounded-full" onClick={() => setOpen(true)}>{t("fr.group.new")}</Button>
      )}
    </div>
  );
}

function InviteLinkBox() {
  const t = useT();
  const make = trpc.social.friends.createInviteLink.useMutation();
  const [copied, setCopied] = useState(false);
  const url = make.data?.url;
  return (
    <section className="rounded-2xl bg-sky-soft p-5">
      <h2 className="text-[18px] font-bold">{t("fr.invite.title")}</h2>
      <p className="mt-1 text-[15px] text-muted-foreground">{t("fr.invite.body")}</p>
      {url ? (
        <div className="mt-4 space-y-3">
          <p className="break-all rounded-lg bg-card px-3 py-2 font-mono text-[13px]">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="dark"
              onClick={async () => {
                if (await copyText(url)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              <Icon icon={copied ? Check : Copy} size={16} /> {copied ? t("fr.invite.copied") : t("fr.invite.copy")}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" onClick={() => navigator.share({ url }).catch(() => undefined)}>
                <Icon icon={Share} size={16} /> {t("fr.invite.share")}
              </Button>
            )}
          </div>
          {make.data?.expiresAt && <p className="text-[13px] text-muted-foreground">{t("fr.invite.expires", { date: formatDateShort(String(make.data.expiresAt)) })}</p>}
        </div>
      ) : (
        <Button className="mt-4" variant="dark" loading={make.isPending} onClick={() => make.mutate()}>
          <Icon icon={UserRoundPlus} size={16} /> {t("fr.invite.make")}
        </Button>
      )}
      {make.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(make.error)}</p>}
    </section>
  );
}

function FindTab() {
  const t = useT();
  const utils = trpc.useUtils();
  const list = trpc.social.friends.list.useQuery(undefined, { retry: false });
  const refresh = () => {
    utils.social.friends.list.invalidate();
    utils.social.posts.feed.invalidate();
  };
  const respond = trpc.social.friends.respond.useMutation({ onSuccess: refresh });
  const remove = trpc.social.friends.remove.useMutation({ onSuccess: refresh });
  const block = trpc.social.friends.block.useMutation({ onSuccess: refresh });
  const unblock = trpc.social.friends.unblock.useMutation({ onSuccess: refresh });
  if (list.isLoading) return <div className="space-y-3" aria-busy="true"><div className="shimmer h-36 rounded-2xl" /><div className="shimmer h-20 rounded-2xl" /></div>;
  if (list.isError || !list.data) return <ErrorState body={list.error ? humanMessage(list.error) : undefined} onRetry={() => list.refetch()} />;
  const d = list.data;
  return (
    <div className="space-y-8">
      <InviteLinkBox />
      {d.incoming.length > 0 && (
        <section>
          <h2 className="t-h3">{t("fr.requests")}</h2>
          <ul className="mt-3 space-y-2">
            {d.incoming.map((r) => (
              <li key={r.requestId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{r.name}</span>
                <Button size="sm" onClick={() => respond.mutate({ requestId: r.requestId, accept: true })} loading={respond.isPending}><Icon icon={Check} size={16} /> {t("fr.accept")}</Button>
                <Button size="sm" variant="ghost" onClick={() => respond.mutate({ requestId: r.requestId, accept: false })}><Icon icon={X} size={16} /> {t("fr.decline")}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="t-h3">{t("fr.list")}</h2>
        {d.friends.length ? (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {d.friends.map((f) => (
              <li key={f.customerId} className="flex items-center gap-3 px-3 py-3">
                <Avatar name={f.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{f.name}</span>
                  <span className="block text-[13px] text-muted-foreground">{t("fr.since", { date: formatDateShort(String(f.since)) })}</span>
                </span>
                <button type="button" onClick={() => remove.mutate({ customerId: f.customerId })} className="min-h-10 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{t("fr.unfriend")}</button>
                <button type="button" onClick={() => block.mutate({ customerId: f.customerId })} className="min-h-10 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-destructive">{t("fr.block")}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted-foreground">{t("fr.list.empty")}</p>
        )}
      </section>
      {d.blocked.length > 0 && (
        <section>
          <h2 className="t-h3">{t("fr.blocked")}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("fr.blocked.note")}</p>
          <ul className="mt-3 space-y-2">
            {d.blocked.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-[14px]">
                <span>#{id}</span>
                <button type="button" onClick={() => unblock.mutate({ customerId: id })} className="font-semibold text-accent-foreground hover:underline">{t("fr.unblock")}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Friends() {
  usePageMeta(PAGE_META.friends);
  const t = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { customer, isLoading } = useCustomer();
  const tab: Tab = TAB_PARAM[params.get("fane") ?? ""] ?? "foryou";
  const setTab = (next: Tab) => setParams(next === "foryou" ? {} : { fane: PARAM_OF[next] }, { replace: true });
  const groups = trpc.social.groups.list.useQuery(undefined, { enabled: Boolean(customer), retry: false, staleTime: 30_000 });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <header className="flex items-center justify-between gap-2 pb-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
          <button type="button" onClick={() => navigate(-1)} aria-label={t("common.back")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={ChevronLeft} size={24} /></button>
          <h1 className="t-h3">{t("fr.title")}</h1>
          <div className="flex items-center">
            <button type="button" onClick={() => setTab("groups")} aria-label={t("fr.groups.open")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={MessageCircle} size={28} strokeWidth={1.75} /></button>
            <button type="button" onClick={() => setTab("find")} aria-label={t("fr.addfriend")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={UserRoundPlus} size={28} strokeWidth={1.75} /></button>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-4" aria-busy="true"><div className="shimmer h-12 rounded-xl" /><div className="shimmer h-64 rounded-2xl" /></div>
        ) : !customer ? (
          <Link to="/logg-inn?next=/profil/venner" className="press flex items-center gap-4 rounded-2xl bg-night p-6 text-white">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={24} /></span>
            <span className="min-w-0 flex-1">
              <span className="t-h3 block">{t("fr.login")}</span>
              <span className="mt-0.5 block text-[14px] text-white/65">{t("fr.login.sub")}</span>
            </span>
            <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
          </Link>
        ) : (
          <>
            <LinkTabs
              label={t("fr.title")}
              active={tab}
              onChange={setTab}
              tabs={[
                { id: "foryou", label: t("fr.tab.foryou") },
                { id: "groups", label: t("fr.tab.groups") },
                { id: "find", label: t("fr.tab.find") },
              ]}
            />
            <div className="mt-6">
              {tab === "foryou" && <ForYou groups={(groups.data ?? []).map((g) => ({ id: g.id, name: g.name }))} />}
              {tab === "groups" && <GroupsTab />}
              {tab === "find" && <FindTab />}
            </div>
          </>
        )}
      </AppShell>
    </div>
  );
}
