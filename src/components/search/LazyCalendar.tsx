import { Suspense, lazy, type ComponentProps } from "react";
import { Calendar as CalendarType } from "@/components/ui/calendar";

/**
 * Kalenderen lastes først når noen åpner den.
 *
 * react-day-picker er 76 kB, og den lå i den kritiske stien på hver eneste
 * side som har et søkefelt – også for de som aldri åpner datovelgeren. Nå
 * hentes den ved første åpning, med en flate i riktig størrelse imens, så
 * arket ikke hopper.
 */
const Calendar = lazy(() => import("@/components/ui/calendar").then((m) => ({ default: m.Calendar })));

export default function LazyCalendar(props: ComponentProps<typeof CalendarType>) {
  return (
    <Suspense fallback={<div className="h-[336px] w-[280px] max-w-full animate-pulse rounded-lg bg-muted" aria-busy="true" />}>
      <Calendar {...props} />
    </Suspense>
  );
}
