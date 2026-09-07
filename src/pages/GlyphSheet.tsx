import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";
import { usePageMeta } from "@/lib/seo";
import * as G from "@/components/graphics";
import * as Pack from "@/components/graphics/pack";
import manifest from "@/components/graphics/pack/manifest.json";

/**
 * Internal glyph sheet: the official HelloSky SVG pack (public/icons) and the
 * app-level glyphs built on it. Used by design and QA; compare against
 * docs/reference/hellosky-svg-pack/hellosky-svg-library.svg.
 * Not linked from navigation, not indexed.
 */
function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">{title}</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-8">{children}</div>
    </section>
  );
}
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center">
      <span className="text-foreground">{children}</span>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function GlyphSheet() {
  usePageMeta({ title: "Ikonark", description: "HelloSky vektorer", noindex: true, canonicalPath: "/utvikler/ikoner" });
  const s = 32;
  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <AppShell>
        <h1 className="font-display mt-6 text-3xl">Ikonark</h1>
        <p className="mt-1 text-sm text-muted-foreground">Offisiell HelloSky SVG-pakke: 24-rutenett, 1.8 strek, currentColor, lime kun på ett aksentpunkt.</p>
        <Row title={`Pakken (${manifest.length})`}>
          {manifest.map((m) => {
            const I = Pack[m.name as keyof typeof Pack] as (p: G.GlyphProps) => ReactNode;
            return (
              <Cell key={m.name} label={m.title}>
                <I size={s} />
              </Cell>
            );
          })}
        </Row>
        <Row title="Bagasje">
          <Cell label="Personlig veske"><G.PersonalItemGlyph size={s} /></Cell>
          <Cell label="Håndbagasje"><G.CabinBagGlyph size={s} /></Cell>
          <Cell label="Innsjekket"><G.CheckedBagGlyph size={s} /></Cell>
          <Cell label="Ekstra stor"><G.HeavyBagGlyph size={s} /></Cell>
          <Cell label="Flere kolli"><G.MultipleBagsGlyph size={s} /></Cell>
          <Cell label="Barnevogn"><G.StrollerGlyph size={s} /></Cell>
          <Cell label="Sportsutstyr"><G.SportsEquipmentGlyph size={s} /></Cell>
          <Cell label="Instrument"><G.InstrumentGlyph size={s} /></Cell>
          <Cell label="Rullestol"><G.WheelchairGlyph size={s} /></Cell>
          <Cell label="Kjæledyr (bur)"><G.PetCarrierGlyph size={s} /></Cell>
          <Cell label="2 kolli"><G.BaggageVisual kind="checked" count={2} size={s} label="2 kolli" /></Cell>
          <Cell label="Ikke inkludert"><G.BaggageVisual kind="checked" count={0} size={s} label="Ikke inkludert" /></Cell>
        </Row>
        <Row title="Fly og reise">
          <Cell label="Fly"><G.AircraftSideGlyph size={s} /></Cell>
          <Cell label="Flyplassbytte"><G.AirportChangeGlyph size={s} /></Cell>
          <Cell label="Avreise"><G.TakeoffGlyph size={s} /></Cell>
          <Cell label="Ankomst"><G.LandingGlyph size={s} /></Cell>
          <Cell label="Direktefly"><G.DirectRouteGlyph size={s} /></Cell>
          <Cell label="Mellomlanding"><G.ConnectingRouteGlyph size={s} /></Cell>
          <Cell label="Nattfly"><G.OvernightGlyph size={s} /></Cell>
          <Cell label="Flybytte"><G.AircraftChangeGlyph size={s} /></Cell>
          <Cell label="Transfer"><G.TransferRoadGlyph size={s} /></Cell>
          <Cell label="Rute"><G.RoutePinsGlyph size={s} /></Cell>
          <Cell label="Flyplass"><G.AirportGlyph size={s} /></Cell>
          <Cell label="Terminal"><G.TerminalGlyph size={s} /></Cell>
          <Cell label="Hele verden"><G.GlobeGlyph size={s} /></Cell>
        </Row>
        <Row title="Seter">
          <Cell label="Ledig"><G.SeatGlyph size={s} /></Cell>
          <Cell label="Valgt"><G.SeatGlyph size={s} state="selected" /></Cell>
          <Cell label="Opptatt"><G.SeatGlyph size={s} state="unavailable" /></Cell>
          <Cell label="Ekstra benplass"><G.SeatGlyph size={s} state="extra-legroom" /></Cell>
          <Cell label="Foretrukket"><G.SeatGlyph size={s} state="preferred" /></Cell>
          <Cell label="Vindussete"><G.SeatPositionGlyph size={s} position="window" /></Cell>
          <Cell label="Midtgang"><G.SeatPositionGlyph size={s} position="aisle" /></Cell>
          <Cell label="Midtsete"><G.SeatPositionGlyph size={s} position="middle" /></Cell>
          <Cell label="Babyseng"><G.BassinetGlyph size={s} /></Cell>
          <Cell label="Seter sammen"><G.SeatsTogetherGlyph size={s} /></Cell>
          <Cell label="Economy"><G.CabinClassGlyph size={s} cabin="economy" /></Cell>
          <Cell label="Premium"><G.CabinClassGlyph size={s} cabin="premium_economy" /></Cell>
          <Cell label="Business"><G.CabinClassGlyph size={s} cabin="business" /></Cell>
          <Cell label="First"><G.CabinClassGlyph size={s} cabin="first" /></Cell>
        </Row>
        <Row title="Passasjerer">
          <Cell label="Voksen"><G.AdultGlyph size={s} /></Cell>
          <Cell label="Barn"><G.ChildGlyph size={s} /></Cell>
          <Cell label="Spedbarn"><G.InfantGlyph size={s} /></Cell>
          <Cell label="Familie"><G.FamilyGlyph size={s} /></Cell>
          <Cell label="Reisefølge"><G.PartyPictogram passengers={[{ type: "adult" }, { type: "adult" }, { type: "child" }, { type: "infant_without_seat" }]} size={s} label="Familie" /></Cell>
          <Cell label="Senior"><G.SeniorGlyph size={s} /></Cell>
          <Cell label="Assistanse"><G.AssistanceGlyph size={s} /></Cell>
          <Cell label="Gruppe"><G.GroupGlyph size={s} /></Cell>
          <Cell label="UM"><G.UnaccompaniedMinorGlyph size={s} /></Cell>
          <Cell label="Kjæledyr"><G.PetGlyph size={s} /></Cell>
          <Cell label="Legg til"><G.AddTravellerGlyph size={s} /></Cell>
        </Row>
        <Row title="Dokumenter og status">
          <Cell label="Pass"><G.PassportGlyph size={s} /></Cell>
          <Cell label="Visum"><G.VisaStampGlyph size={s} /></Cell>
          <Cell label="Boardingkort"><G.BoardingPassGlyph size={s} /></Cell>
          <Cell label="Bagasjelapp"><G.LuggageTagGlyph size={s} /></Cell>
          <Cell label="Booket"><G.StatusGlyph size={s} kind="booked" /></Cell>
          <Cell label="Ticket utstedt"><G.StatusGlyph size={s} kind="ticket" /></Cell>
          <Cell label="Under behandling"><G.StatusGlyph size={s} kind="processing" /></Cell>
          <Cell label="Endring"><G.StatusGlyph size={s} kind="change" /></Cell>
          <Cell label="Kansellert"><G.StatusGlyph size={s} kind="cancelled" /></Cell>
          <Cell label="Refusjon"><G.StatusGlyph size={s} kind="refund" /></Cell>
        </Row>
        <Row title="Illustrasjoner">
          <Cell label="Ingen fly"><G.NoFlightsSpot /></Cell>
          <Cell label="Utløpt"><G.SearchExpiredSpot /></Cell>
          <Cell label="Betaling feilet"><G.PaymentFailedSpot /></Cell>
          <Cell label="Booking feilet"><G.BookingFailedSpot /></Cell>
          <Cell label="Ingen kontakt"><G.ConnectionProblemSpot /></Cell>
          <Cell label="Ingen lagret"><G.NoSavedSpot /></Cell>
          <Cell label="Ingen hotell"><G.NoHotelsSpot /></Cell>
          <Cell label="Ingen reiser"><G.NoTripsSpot /></Cell>
        </Row>
        <Row title="Tillit og fasiliteter">
          {Object.entries(G.TRUST_ICONS).map(([k, I]) => (
            <Cell key={k} label={k}><I size={s} /></Cell>
          ))}
          {Object.entries(G.AMENITY_ICONS).slice(0, 6).map(([k, I]) => (
            <Cell key={k} label={k}><I size={s} /></Cell>
          ))}
          {Object.entries(G.TRANSPORT_ICONS).slice(0, 5).map(([k, I]) => (
            <Cell key={k} label={k}><I size={s} /></Cell>
          ))}
        </Row>
        <section className="mt-8 max-w-xl">
          <h2 className="eyebrow mb-3">Bekreftelse</h2>
          <G.ConfirmationMark className="mb-4" />
        </section>
      </AppShell>
    </div>
  );
}
