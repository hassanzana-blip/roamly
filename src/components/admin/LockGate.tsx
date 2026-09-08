import { useEffect, useRef, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { Avatar } from "@/components/admin/Avatar";
import { humanMessage } from "@/lib/apiError";

/**
 * Låst skjerm.
 *
 * Skallet tas ned mens låsen står på, med vilje: sto det igjen bak, ville
 * kundelistene du hadde åpne ligget og lyst gjennom en lås som finnes nettopp
 * for at de ikke skal det. Adressen beholdes, så opplåsing gir deg siden du
 * sto på – ikke forsiden.
 *
 * Selve låsen ligger på serveren. Dette er bare veien tilbake inn.
 */
export function LockGate({ name, onUnlocked }: { name: string; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const unlock = trpc.staffAuth.unlockScreen.useMutation({
    onSuccess: () => {
      setPassword("");
      setError(null);
      onUnlocked();
    },
    onError: (e) => {
      setError(humanMessage(e));
      setPassword("");
      inputRef.current?.focus();
    },
  });
  const logout = trpc.staffAuth.logout.useMutation({ onSuccess: () => window.location.assign("/admin/logg-inn") });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-night px-4" role="dialog" aria-modal="true" aria-label="Skjermen er låst">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <SkyMark className="mx-auto h-9 w-9 text-white" />
        </div>
        <main className="rounded-2xl bg-card p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <Avatar name={name} size={48} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl leading-tight text-foreground">{name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" /> Skjermen er låst
              </p>
            </div>
          </div>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              unlock.mutate({ password });
            }}
          >
            <label htmlFor="unlock-password" className="block text-sm font-semibold text-foreground">
              Passordet ditt
            </label>
            <input
              ref={inputRef}
              id="unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full min-h-12 rounded-xl border border-input bg-white px-4 text-base text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={unlock.isPending || password.length === 0}
              className="w-full min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {unlock.isPending ? "Låser opp …" : "Lås opp"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => logout.mutate()}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <LogOut className="size-4" aria-hidden="true" /> Logg ut i stedet
          </button>
        </main>
      </div>
    </div>
  );
}
