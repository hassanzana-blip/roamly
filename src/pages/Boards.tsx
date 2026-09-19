import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutGrid, Plus } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import BottomSheet from "@/components/app/BottomSheet";
import { EmptyState, PrimaryButton } from "@/components/app/primitives";
import { useCustomer } from "@/lib/useCustomer";
import { destinationById } from "@/content/discover";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/60";

/** Reisetavler – «Ibiza med gutta», «Familieferie Tenerife». Dine, med private lenker. */
export default function Boards() {
  usePageMeta(PAGE_META.boards);
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const utils = trpc.useUtils();
  const list = trpc.boards.mine.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const create = trpc.boards.create.useMutation({ onSuccess: (r) => { utils.boards.mine.invalidate(); navigate(`/tavler/${r.token}`); } });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/tavler");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <AppHeader title="Reisetavler" back as="h1" />
        <p className="mb-5 max-w-lg text-[14px] text-muted-foreground">Samle reisemål, flyreiser og notater for én tur. Del lenken, la gjengen stemme. En tavle er en idé – aldri en bestilling.</p>

        {list.data && list.data.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="Ingen tavler ennå" body="Lag en for neste tur – «Sommer 2027», «Ibiza med gutta», «Familieferie Tenerife»." action={<PrimaryButton icon={Plus} onClick={() => setOpen(true)} className="mt-2">Ny tavle</PrimaryButton>} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(list.data ?? []).map((b) => {
                const cover = b.coverDestinationId ? destinationById(b.coverDestinationId) : undefined;
                return (
                  <li key={b.token}>
                    <Link to={`/tavler/${b.token}`} className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/25">
                      <span className="block aspect-[4/3] bg-night">{cover?.image && <img src={cover.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}</span>
                      <span className="block p-3"><span className="block truncate text-[15px] font-semibold">{b.title}</span><span className="block text-[12px] text-muted-foreground">{b.when ? `${b.when} · ` : ""}{b.items} {b.items === 1 ? "element" : "elementer"}</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <PrimaryButton icon={Plus} onClick={() => setOpen(true)} className="mt-5 w-full sm:w-auto">Ny tavle</PrimaryButton>
          </>
        )}
      </AppShell>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ny tavle">
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate({ title: title.trim(), when: when.trim() || undefined }); }} className="space-y-4 pb-2">
          <label className="block"><span className="mb-1.5 block eyebrow">Navn på turen</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Sommer 2027" className={inputCls} autoFocus /></label>
          <label className="block"><span className="mb-1.5 block eyebrow">Når (valgfritt)</span><input value={when} onChange={(e) => setWhen(e.target.value)} maxLength={60} placeholder="Juli, eller 18.–21. oktober" className={inputCls} /></label>
          {create.isError && <p role="alert" className="text-[13px] text-destructive">{humanMessage(create.error)}</p>}
          <PrimaryButton type="submit" disabled={!title.trim() || create.isPending} className="w-full">Lag tavle</PrimaryButton>
        </form>
      </BottomSheet>
      <span className="sr-only"><Icon icon={LayoutGrid} size={16} /></span>
    </div>
  );
}
