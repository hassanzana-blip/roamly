import { useState } from "react";
import { cn } from "@/lib/utils";
import { ReauthDialog } from "./ui";
import { errorMessage, isReauthError, type TrpcErrorLike } from "./helpers";

/** Hook: fang feil fra mutasjoner, skill ut reauth. */
export function useActionFeedback() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const fail = (err: TrpcErrorLike) => {
    if (isReauthError(err)) {
      setReauth(true);
      return;
    }
    setError(errorMessage(err));
    setOk(null);
  };
  const flash = (msg: string) => {
    setOk(msg);
    setError(null);
  };
  const clear = () => {
    setError(null);
    setOk(null);
  };
  const banner =
    error || ok ? (
      <div
        role={error ? "alert" : "status"}
        className={cn(
          "mb-4 rounded-xl border px-4 py-3 text-sm font-semibold",
          error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success",
        )}
      >
        {error ?? ok}
      </div>
    ) : null;
  const reauthDialog = <ReauthDialog open={reauth} onClose={() => setReauth(false)} />;
  return { error, ok, fail, flash, clear, banner, reauthDialog };
}

