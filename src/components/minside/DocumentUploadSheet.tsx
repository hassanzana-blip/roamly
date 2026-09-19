import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ACCEPT_ATTR, DOCUMENT_KINDS, kindLabelKey, uploadDocument, UploadError, validateFile, type DocumentKind } from "@/lib/documents";
import { useT } from "@/lib/i18n";
import { trpc } from "@/providers/trpc";

type PlanOption = { id: number; title: string };

/**
 * Opplasting av ett dokument. Type, navn, fil, valgfri reisedato og hvilken
 * reise det hører til. Fila krypteres på serveren; ingenting lagres i
 * nettleseren.
 */
export function DocumentUploadSheet({ open, onOpenChange, plans, defaultPlanId, defaultKind, onUploaded }: { open: boolean; onOpenChange: (o: boolean) => void; plans: PlanOption[]; defaultPlanId?: number | null; defaultKind?: DocumentKind; onUploaded?: (id: number) => void }) {
  const t = useT();
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<DocumentKind>(defaultKind ?? "flight_ticket");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [planId, setPlanId] = useState<number | null>(defaultPlanId ?? null);
  const [travelDate, setTravelDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind ?? "flight_ticket");
    setPlanId(defaultPlanId ?? null);
    setTitle("");
    setTitleTouched(false);
    setFile(null);
    setTravelDate("");
    setError(null);
  }, [open, defaultKind, defaultPlanId]);

  const kindLabel = useMemo(() => t(kindLabelKey(kind)), [kind, t]);
  const effectiveTitle = titleTouched && title.trim() ? title.trim() : kindLabel;

  const submit = async () => {
    if (!file || busy) return;
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid.code === "TOO_LARGE" ? t("doc.upload.toolarge") : t("doc.upload.badtype"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await uploadDocument({ kind, title: effectiveTitle, file, tripPlanId: planId, travelDate: travelDate || null });
      await Promise.all([utils.documents.list.invalidate(), utils.tripPlans.list.invalidate(), utils.tripPlans.get.invalidate()]);
      onUploaded?.(res.id);
      onOpenChange(false);
    } catch (e) {
      const code = e instanceof UploadError ? e.code : "FAILED";
      setError(code === "TOO_LARGE" ? t("doc.upload.toolarge") : code === "BAD_TYPE" ? t("doc.upload.badtype") : code === "UNAUTHORIZED" ? t("doc.login") : t("doc.upload.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent side="bottom" className="max-h-[92dvh]">
        <SheetHeader>
          <SheetTitle>{t("doc.upload.title")}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form
            id="document-upload"
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <FormField id="doc-kind" label={t("doc.upload.kind")}>
              <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
                {DOCUMENT_KINDS.map((k) => (
                  <option key={k} value={k}>{t(kindLabelKey(k))}</option>
                ))}
              </select>
            </FormField>
            <FormField id="doc-title" label={t("doc.upload.name")}>
              <Input id="doc-title" value={titleTouched ? title : kindLabel} maxLength={120} onFocus={() => { if (!titleTouched) { setTitleTouched(true); setTitle(kindLabel); } }} onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} />
            </FormField>
            <FormField id="doc-file" label={t("doc.upload.file")} error={error ?? undefined}>
              <input
                id="doc-file"
                type="file"
                accept={ACCEPT_ATTR}
                required
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setError(f ? (validateFile(f)?.code === "TOO_LARGE" ? t("doc.upload.toolarge") : validateFile(f)?.code === "BAD_TYPE" ? t("doc.upload.badtype") : null) : null);
                }}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-foreground file:px-4 file:font-semibold file:text-background"
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="doc-date" label={t("doc.upload.date")}>
                <Input id="doc-date" type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
              </FormField>
              <FormField id="doc-plan" label={t("doc.upload.plan")}>
                <select id="doc-plan" value={planId ?? ""} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : null)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
                  <option value="">{t("doc.upload.none")}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Icon icon={Lock} size={16} /> {t("doc.upload.private")}</p>
          </form>
        </SheetBody>
        <SheetFooter>
          <Button form="document-upload" type="submit" size="xl" className="w-full rounded-full" disabled={!file || Boolean(error)} loading={busy}>
            {busy ? t("doc.upload.busy") : t("doc.upload.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
