import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CircleCheck, MailWarning } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/** /bekreft-epost?token=… — bekrefter e-postadressen fra lenken i e-posten. */
export default function VerifyEmail() {
  usePageMeta(PAGE_META.verifyEmail);
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const utils = trpc.useUtils();
  const [done, setDone] = useState<"ok" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  const verify = trpc.customerAuth.verifyEmail.useMutation({
    onSuccess: () => {
      setDone("ok");
      utils.customerAuth.me.invalidate();
    },
    onError: (e) => {
      setDone("error");
      setMessage(humanMessage(e));
    },
  });

  useEffect(() => {
    if (token && !ran.current) {
      ran.current = true;
      verify.mutate({ token });
    } else if (!token) {
      setDone("error");
      setMessage("Lenken mangler bekreftelseskode.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <AppShell className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-soft">
          {done === null && (
            <>
              <div className="shimmer mx-auto h-12 w-12 rounded-full" />
              <p className="mt-4 font-display text-xl">Bekrefter e-posten din …</p>
            </>
          )}
          {done === "ok" && (
            <>
              <Icon icon={CircleCheck} size={24} className="mx-auto text-success" />
              <h1 className="mt-4 font-display text-2xl">E-posten er bekreftet!</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Kontoen din er nå fullverdig. Vi sender bekreftelser og viktige reisevarsler hit.
              </p>
              <Link
                to="/profil"
                className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-primary px-7 text-[14px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
              >
                Til profilen din
              </Link>
            </>
          )}
          {done === "error" && (
            <>
              <Icon icon={MailWarning} size={24} className="mx-auto text-warning" />
              <h1 className="mt-4 font-display text-2xl">Lenken virker ikke</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">{message}</p>
              <Link
                to="/profil"
                className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-night px-7 text-[14px] font-semibold text-white transition-colors hover:opacity-90"
              >
                Til profilen — send ny lenke
              </Link>
            </>
          )}
        </div>
      </AppShell>
    </div>
  );
}
