import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, KeyRound } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { trpc } from "@/providers/trpc";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const inputCls =
  "w-full min-h-12 rounded-xl border border-input bg-white px-4 py-3 text-base text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/70";
const btnCls =
  "w-full min-h-12 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50";

export default function AdminActivate() {
  usePageMeta({ ...PAGE_META.admin, title: "Aktiver konto" });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reduce = useReducedMotion();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const activate = trpc.staffAuth.activateAccount.useMutation({
    onSuccess: () => { setError(null); setDone(true); },
    onError: (err) => setError(err.message),
  });

  if (!token) {
    return (
      <main id="main" className="grid min-h-screen place-items-center bg-night px-4 text-center">
        <div className="max-w-md rounded-xl bg-card p-8">
          <h1 className="font-display text-2xl">Ugyldig lenke</h1>
          <p className="mt-3 text-sm text-muted-foreground">Aktiveringslenken mangler eller er feil. Be om en ny invitasjon.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-10">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.15 : 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <SkyMark className="mx-auto h-10 w-10 text-white" />
          <p className="mt-2 text-sm text-white/70">Aktiver kontoen din</p>
        </div>

        <main id="main" className="rounded-xl bg-card p-6 shadow-2xl sm:p-8">
          {done ? (
            <div>
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
                <h1 className="mt-4 font-display text-2xl">Kontoen er klar!</h1>
                <p className="mt-2 text-sm text-muted-foreground">Logg inn med e-posten din og passordet du nettopp valgte.</p>
              </div>
              <Link to="/admin/logg-inn" className="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-semibold text-primary-foreground transition-all hover:opacity-90">
                Gå til innlogging
              </Link>
            </div>
          ) : (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Velg passord
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Minst 12 tegn med store og små bokstaver og tall.</p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password !== password2) { setError("Passordene er ikke like."); return; }
                  activate.mutate({ token, password });
                }}
              >
                <div>
                  <label htmlFor="pw1" className="mb-1.5 block text-sm font-semibold text-foreground">Nytt passord</label>
                  <input id="pw1" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="pw2" className="mb-1.5 block text-sm font-semibold text-foreground">Gjenta passordet</label>
                  <input id="pw2" type="password" autoComplete="new-password" required minLength={12} value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} />
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                <button type="submit" disabled={activate.isPending} className={btnCls}>{activate.isPending ? "Aktiverer …" : "Aktiver kontoen"}</button>
              </form>
            </>
          )}
        </main>
      </motion.div>
    </div>
  );
}
