import { Link, useNavigate, useParams } from "react-router";
import { Users } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { EmptyState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/minside/Social";
import { imageSrcSet } from "@/content/discover";
import { humanMessage } from "@/lib/apiError";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

const TOKEN_OK = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Invitasjonslenker. Forhåndsvisningen viser bare fornavn og etternavnets
 * forbokstav – aldri e-post – og selve handlingen krever innlogging.
 */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-xl">
        <AppHeader title={title} as="h1" />
        {children}
      </AppShell>
    </div>
  );
}

function LoginCta({ next }: { next: string }) {
  const t = useT();
  return (
    <Button asChild size="xl" className="mt-6 w-full rounded-full">
      <Link to={`/logg-inn?next=${encodeURIComponent(next)}`}>{t("fr.inv.login")}</Link>
    </Button>
  );
}

export function FriendInvite() {
  usePageMeta(PAGE_META.friendInvite);
  const t = useT();
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const { customer, isLoading } = useCustomer();
  const valid = TOKEN_OK.test(token);
  const preview = trpc.social.friends.previewInvite.useQuery({ token }, { enabled: valid && Boolean(customer), retry: false });
  const accept = trpc.social.friends.acceptInvite.useMutation({ onSuccess: () => navigate("/profil/venner?fane=finn", { replace: true }) });
  const next = `/venner/invitasjon/${token}`;

  if (isLoading) return <Frame title={t("fr.title")}><div className="shimmer h-40 rounded-2xl" aria-busy="true" /></Frame>;
  if (!customer) {
    return (
      <Frame title={t("fr.title")}>
        <div className="rounded-2xl bg-sky-soft p-6 text-center">
          <Icon icon={Users} size={28} className="mx-auto" />
          <p className="t-h3 mt-3">{t("fr.inv.friend.accept")}</p>
          <p className="mt-1 text-[15px] text-muted-foreground">{t("fr.inv.friend.body")}</p>
          <LoginCta next={next} />
        </div>
      </Frame>
    );
  }
  if (!valid || preview.isError || (preview.data && !preview.data.valid)) {
    return <Frame title={t("fr.title")}><EmptyState icon={Users} title={t("fr.inv.invalid.title")} body={t("fr.inv.invalid.body")} action={<Button asChild variant="dark" className="mt-2"><Link to="/profil/venner">{t("fr.title")}</Link></Button>} /></Frame>;
  }
  if (!preview.data) return <Frame title={t("fr.title")}><div className="shimmer h-40 rounded-2xl" aria-busy="true" /></Frame>;
  const p = preview.data;
  return (
    <Frame title={t("fr.title")}>
      <div className="rounded-2xl bg-sky-soft p-6 text-center">
        <Avatar name={p.from.name} className="mx-auto" />
        <p className="t-h2 mt-4">{t("fr.inv.friend.title", { name: p.from.name })}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">{p.self ? t("fr.inv.self") : t("fr.inv.friend.body")}</p>
        {!p.self && (
          <Button size="xl" className="mt-6 w-full rounded-full" loading={accept.isPending} onClick={() => accept.mutate({ token })}>
            {t("fr.inv.friend.accept")}
          </Button>
        )}
        {accept.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(accept.error)}</p>}
      </div>
    </Frame>
  );
}

export function GroupInvite() {
  usePageMeta(PAGE_META.groupInvite);
  const t = useT();
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const { customer, isLoading } = useCustomer();
  const valid = TOKEN_OK.test(token);
  const preview = trpc.social.groups.previewInvite.useQuery({ token }, { enabled: valid && Boolean(customer), retry: false });
  const join = trpc.social.groups.join.useMutation({ onSuccess: (r) => navigate(`/profil/venner/grupper/${r.id}`, { replace: true }) });
  const next = `/grupper/invitasjon/${token}`;

  if (isLoading) return <Frame title={t("fr.tab.groups")}><div className="shimmer h-40 rounded-2xl" aria-busy="true" /></Frame>;
  if (!customer) {
    return (
      <Frame title={t("fr.tab.groups")}>
        <div className="rounded-2xl bg-sky-soft p-6 text-center">
          <Icon icon={Users} size={28} className="mx-auto" />
          <p className="t-h3 mt-3">{t("fr.inv.group.join")}</p>
          <p className="mt-1 text-[15px] text-muted-foreground">{t("fr.group.empty.body")}</p>
          <LoginCta next={next} />
        </div>
      </Frame>
    );
  }
  if (!valid || preview.isError || (preview.data && !preview.data.valid)) {
    return <Frame title={t("fr.tab.groups")}><EmptyState icon={Users} title={t("fr.inv.invalid.title")} body={t("fr.inv.invalid.body")} action={<Button asChild variant="dark" className="mt-2"><Link to="/profil/venner?fane=grupper">{t("fr.tab.groups")}</Link></Button>} /></Frame>;
  }
  if (!preview.data) return <Frame title={t("fr.tab.groups")}><div className="shimmer h-40 rounded-2xl" aria-busy="true" /></Frame>;
  const g = preview.data;
  return (
    <Frame title={t("fr.tab.groups")}>
      <div className="overflow-hidden rounded-2xl bg-sky-soft">
        {g.cover?.image && <img src={g.cover.image} srcSet={imageSrcSet(g.cover.image)} sizes="(max-width: 640px) 100vw, 560px" alt={g.cover.imageAlt} className="aspect-[3/1] w-full object-cover" />}
        <div className="p-6 text-center">
          <p className="t-h2">{t("fr.inv.group.title", { name: g.name })}</p>
          <p className="mt-1 text-[15px] text-muted-foreground">{t("fr.inv.group.body", { owner: g.owner.name })} · {t("fr.group.members", { count: g.memberCount })}</p>
          {g.alreadyMember ? (
            <>
              <p className="mt-4 text-[15px] font-semibold">{t("fr.inv.group.member")}</p>
              <Button asChild size="xl" className="mt-3 w-full rounded-full"><Link to={`/profil/venner/grupper/${g.groupId}`}>{t("fr.inv.group.open")}</Link></Button>
            </>
          ) : (
            <Button size="xl" className="mt-6 w-full rounded-full" loading={join.isPending} onClick={() => join.mutate({ token })}>{t("fr.inv.group.join")}</Button>
          )}
          {join.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(join.error)}</p>}
        </div>
      </div>
    </Frame>
  );
}
