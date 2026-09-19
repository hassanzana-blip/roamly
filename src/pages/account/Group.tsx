import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Copy, Share, UserRoundPlus, Users } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { ErrorState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, Composer, PollCard, PollComposer, PostCard } from "@/components/minside/Social";
import { imageSrcSet } from "@/content/discover";
import { copyText } from "@/lib/clipboard";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

/**
 * Én privat gruppe: medlemmer, invitasjonslenke, avstemninger og det som
 * deles der. Serveren slipper bare aktive medlemmer inn.
 */
export default function GroupPage() {
  usePageMeta(PAGE_META.group);
  const t = useT();
  const navigate = useNavigate();
  const { id: raw } = useParams();
  const id = Number(raw);
  const { customer, isLoading } = useCustomer();
  const utils = trpc.useUtils();
  const group = trpc.social.groups.get.useQuery({ id }, { enabled: Boolean(customer) && Number.isFinite(id), retry: false });
  const feed = trpc.social.posts.feed.useQuery({ groupId: id }, { enabled: Boolean(customer) && Number.isFinite(id), retry: false });
  const invite = trpc.social.groups.inviteLink.useMutation();
  const leave = trpc.social.groups.leave.useMutation({ onSuccess: () => { utils.social.groups.list.invalidate(); navigate("/profil/venner?fane=grupper", { replace: true }); } });
  const removeGroup = trpc.social.groups.remove.useMutation({ onSuccess: () => { utils.social.groups.list.invalidate(); navigate("/profil/venner?fane=grupper", { replace: true }); } });
  const removeMember = trpc.social.groups.removeMember.useMutation({ onSuccess: () => utils.social.groups.get.invalidate({ id }) });
  const transfer = trpc.social.groups.transferOwnership.useMutation({ onSuccess: () => utils.social.groups.get.invalidate({ id }) });
  const request = trpc.social.friends.request.useMutation();
  const [copied, setCopied] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [requested, setRequested] = useState<Set<number>>(new Set());

  const g = group.data;
  const forbidden = group.error ? appCodeOf(group.error) === "FORBIDDEN" || appCodeOf(group.error) === "NOT_FOUND" : false;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <header className="flex items-center justify-between gap-2 pb-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
          <button type="button" onClick={() => navigate(-1)} aria-label={t("common.back")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={ChevronLeft} size={24} /></button>
          <h1 className="t-h3 min-w-0 truncate">{g?.name ?? t("fr.tab.groups")}</h1>
          {g ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("fr.more")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={Users} size={28} strokeWidth={1.75} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {g.myRole !== "owner" || g.members.length === 1 ? (
                  <DropdownMenuItem variant="destructive" onSelect={() => { if (window.confirm(t("fr.group.leave.confirm"))) leave.mutate({ id }); }}>{t("fr.group.leave")}</DropdownMenuItem>
                ) : null}
                {g.myRole === "owner" && (
                  <DropdownMenuItem variant="destructive" onSelect={() => { if (window.confirm(t("fr.group.delete.confirm"))) removeGroup.mutate({ id }); }}>{t("fr.group.delete")}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
        </header>

        {isLoading || group.isLoading ? (
          <div className="space-y-4" aria-busy="true"><div className="shimmer aspect-[3/1] rounded-2xl" /><div className="shimmer h-24 rounded-2xl" /></div>
        ) : !customer ? (
          <Link to={`/logg-inn?next=${encodeURIComponent(`/profil/venner/grupper/${raw}`)}`} className="press block rounded-2xl bg-night p-6 text-white">
            <span className="t-h3 block">{t("fr.login")}</span>
            <span className="mt-0.5 block text-[14px] text-white/65">{t("fr.login.sub")}</span>
          </Link>
        ) : group.isError || !g ? (
          <ErrorState title={forbidden ? t("fr.group.notmember") : undefined} body={forbidden ? undefined : group.error ? humanMessage(group.error) : undefined} onRetry={forbidden ? undefined : () => group.refetch()} />
        ) : (
          <div className="space-y-8">
            {g.cover?.image && (
              <div className="overflow-hidden rounded-2xl bg-muted">
                <img src={g.cover.image} srcSet={imageSrcSet(g.cover.image)} sizes="(max-width: 640px) 100vw, 720px" alt={g.cover.imageAlt} className="aspect-[3/1] w-full object-cover" />
              </div>
            )}
            <p className="text-[15px] text-muted-foreground">{t("fr.privategroup")} · {t("fr.group.members", { count: g.members.length })}</p>

            <section className="rounded-2xl bg-sky-soft p-5">
              <h2 className="text-[18px] font-bold">{t("fr.group.invite")}</h2>
              {invite.data ? (
                <div className="mt-3 space-y-3">
                  <p className="break-all rounded-lg bg-card px-3 py-2 font-mono text-[13px]">{invite.data.url}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="dark" onClick={async () => { if (await copyText(invite.data!.url)) { setCopied(true); window.setTimeout(() => setCopied(false), 2000); } }}>
                      <Icon icon={copied ? Check : Copy} size={16} /> {copied ? t("fr.invite.copied") : t("fr.invite.copy")}
                    </Button>
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <Button variant="outline" onClick={() => navigator.share({ url: invite.data!.url }).catch(() => undefined)}><Icon icon={Share} size={16} /> {t("fr.invite.share")}</Button>
                    )}
                  </div>
                </div>
              ) : (
                <Button className="mt-3" variant="dark" loading={invite.isPending} onClick={() => invite.mutate({ id })}><Icon icon={UserRoundPlus} size={16} /> {t("fr.invite.make")}</Button>
              )}
              {invite.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(invite.error)}</p>}
            </section>

            <section>
              <h2 className="t-h3">{t("fr.group.members")}</h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                {g.members.map((m) => (
                  <li key={m.customerId} className="flex items-center gap-3 px-3 py-3">
                    <Avatar name={m.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{m.name}{m.isYou ? ` (${t("fr.group.you")})` : ""}</span>
                      <span className="block text-[13px] text-muted-foreground">{m.role === "owner" ? t("fr.group.owner") : ""}</span>
                    </span>
                    {!m.isYou && !m.isFriend && (
                      <button type="button" disabled={requested.has(m.customerId)} onClick={() => request.mutate({ customerId: m.customerId }, { onSuccess: () => setRequested((s) => new Set(s).add(m.customerId)) })} className="min-h-10 rounded-lg px-2 text-[13px] font-semibold text-accent-foreground hover:bg-muted disabled:text-muted-foreground">
                        {requested.has(m.customerId) ? t("fr.group.requested") : t("fr.group.befriend")}
                      </button>
                    )}
                    {g.myRole === "owner" && !m.isYou && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={t("fr.more")} className="grid size-10 place-items-center rounded-full hover:bg-muted"><Icon icon={Users} size={20} /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => transfer.mutate({ id, customerId: m.customerId })}>{t("fr.group.makeowner")}</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => removeMember.mutate({ id, customerId: m.customerId })}>{t("fr.group.removemember")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="t-h3">{t("fr.group.polls")}</h2>
                <Button variant="outline" size="sm" onClick={() => setPollOpen((o) => !o)}>{t("fr.poll.new")}</Button>
              </div>
              {pollOpen && <PollComposer groupId={id} onCreated={() => setPollOpen(false)} />}
              {g.polls.map((poll) => <PollCard key={poll.id} poll={poll} canClose={g.myRole === "owner" || poll.createdById === customer.id} />)}
            </section>

            <section className="space-y-6">
              <Composer groups={[]} fixedGroupId={id} />
              {feed.isLoading ? <div className="shimmer h-40 rounded-2xl" /> : (feed.data?.posts ?? []).map((p) => <PostCard key={p.id} post={p} />)}
              {feed.data && feed.data.posts.length === 0 && <p className="text-center text-[15px] text-muted-foreground">{t("fr.feed.empty.title")}</p>}
            </section>
          </div>
        )}
      </AppShell>
    </div>
  );
}
