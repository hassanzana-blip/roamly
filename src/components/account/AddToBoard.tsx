import { useState } from "react";
import { Link } from "react-router";
import { Check, LayoutGrid, Plus } from "lucide-react";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * «Legg til på tavle» – liten velger over kundens egne tavler. Gjester får en
 * rolig lenke til innlogging; ingen tavle uten konto.
 */
export default function AddToBoard({ kind, refId, payload, className }: { kind: "destination" | "flight" | "article"; refId: string; payload?: Record<string, unknown>; className?: string }) {
  const { customer } = useCustomer();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const boards = trpc.boards.mine.useQuery(undefined, { enabled: Boolean(customer) && open, retry: false });
  const add = trpc.boards.addItem.useMutation({ onSuccess: (_, vars) => { setDone(vars.token); setTimeout(() => { setDone(null); setOpen(false); }, 1200); } });

  if (!customer) {
    return <Link to="/logg-inn?next=/tavler" className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold", className)}><Icon icon={LayoutGrid} size={14} /> Legg til på tavle</Link>;
  }
  return (
    <div className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold hover:border-foreground/40"><Icon icon={LayoutGrid} size={14} /> Legg til på tavle</button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          {boards.isLoading && <p className="px-4 py-3 text-[13px] text-muted-foreground">Henter tavler …</p>}
          {boards.data?.length === 0 && <p className="px-4 py-3 text-[13px] text-muted-foreground">Ingen tavler ennå.</p>}
          <ul>
            {(boards.data ?? []).map((b) => (
              <li key={b.token}>
                <button type="button" onClick={() => add.mutate({ token: b.token, kind, refId, payload })} disabled={add.isPending} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[14px] hover:bg-muted">
                  <span className="truncate">{b.title}</span>
                  {done === b.token ? <Icon icon={Check} size={16} className="text-success" /> : <Icon icon={Plus} size={16} className="text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
          <Link to="/tavler" className="block border-t border-border px-4 py-3 text-[13px] font-semibold">Ny tavle →</Link>
        </div>
      )}
    </div>
  );
}
