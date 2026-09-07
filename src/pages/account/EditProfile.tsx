import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Camera, KeyRound, LogOut, Trash2, TriangleAlert, UserRound } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const inputCls =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/60";

/** Skaler valgt bilde til 192×192 JPEG (data-URL) — ingen opplasting av original. */
async function resizeToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - size) / 2,
    (bitmap.height - size) / 2,
    size,
    size,
    0,
    0,
    192,
    192,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function EditProfile() {
  usePageMeta(PAGE_META.editProfile);
  const { customer, isLoading } = useCustomer();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [delPw, setDelPw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn");
  }, [customer, isLoading, navigate]);

  // Fyll skjemaet fra kontoen første gang den er lastet (render-tids-synk, ikke effekt)
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (customer && seededFor !== customer.id) {
    setSeededFor(customer.id);
    setFirstName(customer.firstName);
    setLastName(customer.lastName);
    setPhone(customer.phone ?? "");
  }

  const update = trpc.customerAuth.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      utils.customerAuth.me.invalidate();
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const setAvatar = trpc.customerAuth.setAvatar.useMutation({
    onSuccess: () => {
      setAvatarMsg("Profilbildet er oppdatert!");
      utils.customerAuth.me.invalidate();
      setTimeout(() => setAvatarMsg(null), 2500);
    },
    onError: (e) => setAvatarMsg(humanMessage(e)),
  });
  const changePw = trpc.customerAuth.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg("Passordet er endret.");
      setCurPw("");
      setNewPw("");
    },
    onError: (e) => setPwMsg(humanMessage(e)),
  });
  const logoutAll = trpc.customerAuth.logoutAll.useMutation({
    onSuccess: () => {
      utils.customerAuth.me.invalidate();
      navigate("/logg-inn");
    },
  });
  const del = trpc.customerAuth.deleteAccount.useMutation({
    onSuccess: () => {
      utils.customerAuth.me.invalidate();
      navigate("/");
    },
  });

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setAvatarMsg("Velg en bildefil (JPG, PNG eller WebP).");
      return;
    }
    try {
      const dataUrl = await resizeToAvatar(f);
      setAvatar.mutate({ dataUrl });
    } catch {
      setAvatarMsg("Kunne ikke lese bildet — prøv et annet.");
    }
  };

  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title="Rediger profil" back />

        {/* Profilbilde */}
        <section className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-white p-5 shadow-soft">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Bytt profilbilde"
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full"
          >
            {customer.avatarUrl ? (
              <img src={customer.avatarUrl} alt="Profilbilde" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-2xl font-extrabold text-night">
                {customer.firstName.charAt(0).toUpperCase()}
                {customer.lastName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-night/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Icon icon={Camera} size={20} className="text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">Profilbilde</p>
            <p className="text-[12px] text-muted-foreground">
              Vises i samfunnet og på profilen din. Bildet skaleres ned — originalen forlater aldri enheten din.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={setAvatar.isPending}
                className="min-h-9 rounded-full bg-night px-4 text-[12px] font-bold text-white transition-colors hover:brightness-125 disabled:opacity-50"
              >
                {setAvatar.isPending ? "Laster opp …" : "Last opp bilde"}
              </button>
              {customer.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatar.mutate({ dataUrl: "" })}
                  className="min-h-9 rounded-full border border-border px-4 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Fjern
                </button>
              )}
            </div>
            {avatarMsg && <p className="mt-1.5 text-[12px] font-semibold text-emerald-700">{avatarMsg}</p>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </section>

        {/* Navn og kontakt */}
        <section className="mb-6 rounded-3xl border border-border bg-white p-5 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg">
            <Icon icon={UserRound} size={20} /> Navn og kontakt
          </h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ firstName, lastName, phone: phone || undefined });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Fornavn" required className={inputCls} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Etternavn" required className={inputCls} />
            </div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (+47 …)" type="tel" className={inputCls} />
            {update.isError && <p className="text-[12px] font-medium text-coral">{humanMessage(update.error)}</p>}
            <button
              type="submit"
              disabled={update.isPending}
              className="min-h-11 w-full rounded-full bg-night text-[14px] font-bold text-white transition-colors hover:brightness-125 disabled:opacity-50"
            >
              {saved ? "Lagret!" : update.isPending ? "Lagrer …" : "Lagre endringer"}
            </button>
          </form>
          {customer.email && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              E-post ({customer.email}) kan ikke endres ennå —{" "}
              <Link to="/hjelp" className="font-semibold underline underline-offset-2">kontakt oss</Link> om du trenger ny e-post.
            </p>
          )}
        </section>

        {/* Passord */}
        <section className="mb-6 rounded-3xl border border-border bg-white p-5 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg">
            <Icon icon={KeyRound} size={20} /> Bytt passord
          </h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              changePw.mutate({ currentPassword: curPw, newPassword: newPw });
            }}
          >
            <input type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Nåværende passord" required className={inputCls} />
            <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Nytt passord (minst 10 tegn)" minLength={10} required className={inputCls} />
            {pwMsg && <p className={`text-[12px] font-semibold ${pwMsg === "Passordet er endret." ? "text-emerald-700" : "text-coral"}`}>{pwMsg}</p>}
            <button
              type="submit"
              disabled={changePw.isPending || !curPw || !newPw}
              className="min-h-11 w-full rounded-full bg-night text-[14px] font-bold text-white transition-colors hover:brightness-125 disabled:opacity-50"
            >
              {changePw.isPending ? "Endrer …" : "Bytt passord"}
            </button>
          </form>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Når passordet byttes, logges alle andre enheter ut automatisk.
          </p>
        </section>

        {/* Sikkerhet */}
        <section className="mb-6 rounded-3xl border border-border bg-white p-5 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
            <Icon icon={LogOut} size={20} /> Økter
          </h2>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Logg ut av alle enheter — lurt hvis du har brukt en delt eller offentlig enhet.
          </p>
          <button
            onClick={() => logoutAll.mutate()}
            disabled={logoutAll.isPending}
            className="min-h-11 w-full rounded-full border border-border text-[14px] font-bold transition-colors hover:bg-muted disabled:opacity-50"
          >
            {logoutAll.isPending ? "Logger ut …" : "Logg ut alle enheter"}
          </button>
        </section>

        {/* Slett konto */}
        <section className="rounded-3xl border border-coral/30 bg-coral/5 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-coral">
            <Icon icon={TriangleAlert} size={20} /> Slett konto
          </h2>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Kontoen, lagrede reisende, prisvarsler og bonus slettes permanent. Gjennomførte bestillinger
            beholdes som regnskapsbilag. Dette kan ikke angres.
          </p>
          {confirmDelete ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                del.mutate({ password: delPw });
              }}
            >
              <input
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                placeholder="Skriv passordet for å bekrefte"
                required
                className={inputCls}
              />
              {del.isError && <p className="text-[12px] font-medium text-coral">{humanMessage(del.error)}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={del.isPending || !delPw}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-coral text-[14px] font-bold text-white transition-colors hover:brightness-95 disabled:opacity-50"
                >
                  <Icon icon={Trash2} size={16} />
                  {del.isPending ? "Sletter …" : "Slett kontoen permanent"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-11 rounded-full border border-border px-5 text-[14px] font-semibold"
                >
                  Avbryt
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="min-h-11 w-full rounded-full border border-coral/40 text-[14px] font-bold text-coral transition-colors hover:bg-coral/10"
            >
              Jeg vil slette kontoen min
            </button>
          )}
        </section>
      </AppShell>
    </div>
  );
}
