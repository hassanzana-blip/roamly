import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

/**
 * Lettvekts i18n for HelloSky (OTA-151/154/157).
 *
 *  Språk:   nb (standard) · en · sv · da · de
 *  Bruk:
 *    const t = useT();
 *    t("nav.home")                              → "Hjem"
 *    t("cart.items", { count: 3 })              → plural: nøkler `cart.items_one` / `cart.items_other`
 *    t("greet.name", { name: "Ada" })           → interpolasjon av `{name}`
 *
 *    const { lang, locale, currency } = useLocale();   // "nb", "nb-NO", "NOK"
 *    (currency = visningspreferanse; beløp formateres i src/lib/format.ts)
 *
 *  Ordbok: nb og en er komplette (nav, footer, innholdssider, søk, checkout,
 *  Min reise, bekreftelse, kundeservice, innlogging, profil). sv/da/de dekker
 *  navigasjon, footer og innholdssidenes titler — alt annet faller tilbake
 *  til en, deretter nb.
 *  Språkvalg lagres i localStorage (`hellosky:lang`) og synkes til kundekonto
 *  via customerAuth.updatePreferences når kunden er innlogget.
 *  `document.documentElement.lang` settes alltid — format.ts leser den.
 */

export const LANGS = ["nb", "en", "sv", "da", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const CURRENCIES = ["NOK", "SEK", "DKK", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const LOCALE_OF: Record<Lang, string> = {
  nb: "nb-NO",
  en: "en-GB",
  sv: "sv-SE",
  da: "da-DK",
  de: "de-DE",
};

export const LANG_LABELS: Record<Lang, string> = {
  nb: "Norsk",
  en: "English",
  sv: "Svenska",
  da: "Dansk",
  de: "Deutsch",
};

const DEFAULT_CURRENCY_OF: Record<Lang, Currency> = { nb: "NOK", en: "NOK", sv: "SEK", da: "DKK", de: "EUR" };

type Entry = { nb: string; en: string; sv?: string; da?: string; de?: string };

// Full nb + en. sv/da/de: navigasjon, footer, innholdssidetitler.
// TODO: profesjonell oversettelse av sv/da/de (maskinkvalitet).
const dict = {
  // ── Navigasjon (BottomNav + SiteHeader) ────────────────────────────────
  "nav.home": { nb: "Hjem", en: "Home", sv: "Hem", da: "Hjem", de: "Start" },
  "nav.explore": { nb: "Utforsk", en: "Explore", sv: "Utforska", da: "Udforsk", de: "Entdecken" },
  "nav.saved": { nb: "Lagret", en: "Saved", sv: "Sparat", da: "Gemt", de: "Gespeichert" },
  "nav.profile": { nb: "Profil", en: "Profile", sv: "Profil", da: "Profil", de: "Profil" },
  "nav.main": { nb: "Hovednavigasjon", en: "Main navigation", sv: "Huvudnavigering", da: "Hovednavigation", de: "Hauptnavigation" },
  "nav.mainmenu": { nb: "Hovedmeny", en: "Main menu", sv: "Huvudmeny", da: "Hovedmenu", de: "Hauptmenü" },
  "nav.mobilemenu": { nb: "Mobilmeny", en: "Mobile menu", sv: "Mobilmeny", da: "Mobilmenu", de: "Mobiles Menü" },
  "nav.search": { nb: "Søk fly", en: "Search flights", sv: "Sök flyg", da: "Søg fly", de: "Flüge suchen" },
  "nav.destinations": { nb: "Reisemål", en: "Destinations", sv: "Resmål", da: "Rejsemål", de: "Reiseziele" },
  "nav.quiz": { nb: "Reisequiz", en: "Travel quiz", sv: "Resequiz", da: "Rejsequiz", de: "Reise-Quiz" },
  "nav.hotelcar": { nb: "Hotell & bil", en: "Hotels & cars", sv: "Hotell & bil", da: "Hotel & bil", de: "Hotel & Auto" },
  "nav.mytrip": { nb: "Min reise", en: "My trip", sv: "Min resa", da: "Min rejse", de: "Meine Reise" },
  "nav.flightstatus": { nb: "Flystatus", en: "Flight status", sv: "Flygstatus", da: "Flystatus", de: "Flugstatus" },
  "nav.support": { nb: "Kundeservice", en: "Customer service", sv: "Kundservice", da: "Kundeservice", de: "Kundenservice" },
  "nav.findbooking": { nb: "Finn bestilling", en: "Find booking", sv: "Hitta bokning", da: "Find bestilling", de: "Buchung finden" },
  "nav.openmenu": { nb: "Åpne meny", en: "Open menu", sv: "Öppna meny", da: "Åbn menu", de: "Menü öffnen" },
  "nav.closemenu": { nb: "Lukk meny", en: "Close menu", sv: "Stäng meny", da: "Luk menu", de: "Menü schließen" },
  "nav.skip": { nb: "Hopp til innhold", en: "Skip to content", sv: "Hoppa till innehåll", da: "Spring til indhold", de: "Zum Inhalt springen" },
  "nav.tofront": { nb: "HelloSky – til forsiden", en: "HelloSky – to the front page", sv: "HelloSky – till startsidan", da: "HelloSky – til forsiden", de: "HelloSky – zur Startseite" },
  "nav.language": { nb: "Språk", en: "Language", sv: "Språk", da: "Sprog", de: "Sprache" },
  "nav.hours": { nb: "Kundeservice · 06–24", en: "Customer service · 06–24", sv: "Kundservice · 06–24", da: "Kundeservice · 06–24", de: "Kundenservice · 06–24" },

  // ── Footer ─────────────────────────────────────────────────────────────
  "footer.tagline": { nb: "Hele verden. Nærmere.", en: "The whole world. Closer.", sv: "Hela världen. Närmare.", da: "Hele verden. Tættere på.", de: "Die ganze Welt. Näher." },
  // Ingen påstand om «hele markedet» eller «under to minutter»: vi kan ikke
  // dokumentere noen av delene, og feil løfte er verre enn ingen løfte.
  "footer.blurb": {
    nb: "Vi kan reisene hjem — til familie, til høytider, med bagasje som faktisk må være med. Totalprisen står der fra første søk, og du får hjelp av ekte mennesker.",
    en: "We know journeys home — to family, for holidays, with the baggage that has to come along. The total price is there from the first search, and real people help when you need it.",
    sv: "Vi kan resorna hem — till familjen, till högtiderna, med bagaget som faktiskt måste med. Totalpriset står där från första sökningen, och riktiga människor hjälper dig.",
    da: "Vi kender rejserne hjem — til familien, til højtiderne, med den bagage der skal med. Totalprisen står der fra første søgning, og rigtige mennesker hjælper dig.",
    de: "Wir kennen die Reisen nach Hause — zur Familie, zu den Feiertagen, mit dem Gepäck, das mit muss. Der Gesamtpreis steht ab der ersten Suche, und echte Menschen helfen.",
  },
  "footer.trust": { nb: "Sikker betaling via Stripe · Bekreftelse på e-post · Norsk kundeservice", en: "Secure payment via Stripe · Confirmation by e-mail · Norwegian customer service", sv: "Säker betalning via Stripe · Bekräftelse via e-post · Nordisk kundservice", da: "Sikker betaling via Stripe · Bekræftelse på e-mail · Nordisk kundeservice", de: "Sichere Zahlung über Stripe · Bestätigung per E-Mail · Kundenservice" },
  "footer.trust.nopay": { nb: "Bekreftelse på e-post · Norsk kundeservice · Prisen inkluderer avgifter", en: "Confirmation by e-mail · Norwegian customer service · Taxes included in the price", sv: "Bekräftelse via e-post · Nordisk kundservice · Priset inkluderar avgifter", da: "Bekræftelse på e-mail · Nordisk kundeservice · Prisen inkluderer afgifter", de: "Bestätigung per E-Mail · Kundenservice · Preis inklusive Steuern und Gebühren" },
  "footer.paywith": { nb: "Betal med", en: "Pay with", sv: "Betala med", da: "Betal med", de: "Bezahlen mit" },
  "footer.card": { nb: "Kort", en: "Card", sv: "Kort", da: "Kort", de: "Karte" },
  "footer.facebook": { nb: "Følg oss på Facebook", en: "Follow us on Facebook", sv: "Följ oss på Facebook", da: "Følg os på Facebook", de: "Folgen Sie uns auf Facebook" },
  "footer.shortcuts": { nb: "Snarveier", en: "Shortcuts", sv: "Genvägar", da: "Genveje", de: "Schnellzugriff" },
  "footer.searchtickets": { nb: "Søk flybilletter", en: "Search flight tickets", sv: "Sök flygbiljetter", da: "Søg flybilletter", de: "Flugtickets suchen" },
  "footer.destinations": { nb: "Reisemål over hele verden", en: "Destinations worldwide", sv: "Resmål över hela världen", da: "Rejsemål over hele verden", de: "Reiseziele weltweit" },
  "footer.hotelcar": { nb: "Hotell og leiebil", en: "Hotels and car rental", sv: "Hotell och hyrbil", da: "Hotel og lejebil", de: "Hotels und Mietwagen" },
  "footer.quiz": { nb: "Reisequizen", en: "The travel quiz", sv: "Resequizen", da: "Rejsequizzen", de: "Das Reise-Quiz" },
  "footer.findbooking": { nb: "Finn bestillingen din", en: "Find your booking", sv: "Hitta din bokning", da: "Find din bestilling", de: "Buchung finden" },
  "footer.track": { nb: "Spor et fly", en: "Track a flight", sv: "Spåra ett flyg", da: "Følg et fly", de: "Flug verfolgen" },
  "footer.about": { nb: "Om HelloSky", en: "About HelloSky", sv: "Om HelloSky", da: "Om HelloSky", de: "Über HelloSky" },
  "footer.community": { nb: "Reisesamfunn", en: "Travel community", sv: "Resegemenskap", da: "Rejsefællesskab", de: "Reise-Community" },
  "footer.contact": { nb: "Kontakt oss", en: "Contact us", sv: "Kontakta oss", da: "Kontakt os", de: "Kontakt" },
  "footer.hours": { nb: "Alle dager 06–24. Svar på e-post innen 2 timer i åpningstiden.", en: "Every day 06–24. E-mail replies within 2 hours during opening hours.", sv: "Alla dagar 06–24. Svar på e-post inom 2 timmar under öppettid.", da: "Alle dage 06–24. Svar på e-mail inden for 2 timer i åbningstiden.", de: "Täglich 06–24 Uhr. E-Mail-Antwort innerhalb von 2 Stunden während der Öffnungszeiten." },
  "footer.legal": { nb: "Vilkår og info", en: "Terms and info", sv: "Villkor och info", da: "Vilkår og info", de: "Bedingungen und Infos" },
  "footer.terms": { nb: "Reisevilkår", en: "Terms of travel", sv: "Resevillkor", da: "Rejsevilkår", de: "Reisebedingungen" },
  "footer.privacy": { nb: "Personvern", en: "Privacy", sv: "Integritet", da: "Privatliv", de: "Datenschutz" },
  "footer.baggage": { nb: "Bagasjeregler", en: "Baggage rules", sv: "Bagageregler", da: "Bagageregler", de: "Gepäckregeln" },
  "footer.visa": { nb: "Pass og visum", en: "Passport and visa", sv: "Pass och visum", da: "Pas og visum", de: "Pass und Visum" },
  "footer.copy": { nb: "Flyinnhold levert via Duffel", en: "Flight content provided via Duffel", sv: "Flyginnehåll via Duffel", da: "Flyindhold leveret via Duffel", de: "Fluginhalte über Duffel" },
  "footer.photo": { nb: "Foto: Unsplash- og Pexels-fotografer", en: "Photos: Unsplash and Pexels photographers", sv: "Foto: Unsplash- och Pexels-fotografer", da: "Foto: Unsplash- og Pexels-fotografer", de: "Fotos: Unsplash- und Pexels-Fotografen" },

  // ── Innholdssider (titler) ─────────────────────────────────────────────
  "content.terms.title": { nb: "Reisevilkår", en: "Terms of travel", sv: "Resevillkor", da: "Rejsevilkår", de: "Reisebedingungen" },
  "content.privacy.title": { nb: "Personvernerklæring", en: "Privacy policy", sv: "Integritetspolicy", da: "Privatlivspolitik", de: "Datenschutzerklärung" },
  "content.baggage.title": { nb: "Bagasjeguiden", en: "Baggage guide", sv: "Bagageguiden", da: "Bagageguiden", de: "Gepäckratgeber" },
  "content.visa.title": { nb: "Visumguiden", en: "Visa guide", sv: "Visumguiden", da: "Visumguiden", de: "Visum-Ratgeber" },
  "content.about.title": { nb: "Om HelloSky", en: "About HelloSky", sv: "Om HelloSky", da: "Om HelloSky", de: "Über HelloSky" },
  "content.legal": { nb: "Juridisk", en: "Legal", sv: "Juridiskt", da: "Juridisk", de: "Rechtliches" },
  "content.travelinfo": { nb: "Reiseinfo", en: "Travel info", sv: "Reseinfo", da: "Rejseinfo", de: "Reiseinfos" },
  "content.reviewnote": { nb: "Merknader i klammer er markert for juridisk gjennomgang.", en: "Notes in brackets are marked for legal review." },

  // ── 404 ────────────────────────────────────────────────────────────────
  "notfound.title": { nb: "Siden finnes ikke (404)", en: "Page not found (404)", sv: "Sidan finns inte (404)", da: "Siden findes ikke (404)", de: "Seite nicht gefunden (404)" },
  "notfound.sub": { nb: "Denne ruten finnes ikke", en: "This route does not exist", sv: "Den här rutten finns inte", da: "Denne rute findes ikke", de: "Diese Route gibt es nicht" },
  "notfound.body": { nb: "Siden du leter etter har fløyet sin egen vei. La oss finne en bedre destinasjon.", en: "The page you are looking for has flown off on its own. Let us find a better destination." },
  "notfound.cta": { nb: "Tilbake til søk", en: "Back to search", sv: "Tillbaka till sökningen", da: "Tilbage til søgning", de: "Zurück zur Suche" },

  // ── Feilgrense ─────────────────────────────────────────────────────────
  "error.title": { nb: "Noe gikk galt", en: "Something went wrong" },
  "error.body": { nb: "Vi klarte ikke å vise denne siden. Prøv å laste den på nytt – hvis det fortsetter, kontakt kundeservice.", en: "We could not display this page. Try reloading – if it keeps happening, contact customer service." },
  "error.reload": { nb: "Last siden på nytt", en: "Reload the page" },
  "error.home": { nb: "Til forsiden", en: "To the front page" },
  "loading": { nb: "Laster …", en: "Loading …" },

  // ── Hilsen / TopBar ────────────────────────────────────────────────────
  "greet.hi": { nb: "Hei,", en: "Hi," },
  "greet.name": { nb: "Hei, {name}!", en: "Hi, {name}!" },
  "greet.where": { nb: "Hvor vil du reise i dag?", en: "Where do you want to go today?" },
  "topbar.openprofile": { nb: "Åpne profil", en: "Open profile" },
  "topbar.search": { nb: "Søk etter fly", en: "Search for flights" },
  "topbar.settings": { nb: "Innstillinger", en: "Settings" },
  "topbar.back": { nb: "Tilbake", en: "Back" },
  "topbar.home": { nb: "HelloSky hjem", en: "HelloSky home" },

  // ── Home ───────────────────────────────────────────────────────────────
  "home.title1": { nb: "Finn den", en: "Find the" },
  "home.title2": { nb: "perfekte", en: "perfect" },
  "home.title3": { nb: "reisen", en: "trip" },
  "home.tab.flight": { nb: "Fly", en: "Flights" },
  "home.tab.hotel": { nb: "Hotell", en: "Hotels" },
  "home.tab.car": { nb: "Leiebil", en: "Car rental" },
  "home.sub": { nb: "Se totalprisen med en gang — med bagasje og gebyrer. Og få hjelp av ekte mennesker.", en: "See the total price up front, baggage and fees included. And get help from real people." },
  "home.trust": { nb: "Sikker betaling via Stripe. Norsk kundeservice alle dager 06–24.", en: "Secure payment via Stripe. Norwegian customer service every day 06–24." },
  // Ikke personalisert — en redaksjonell liste. «For deg» ville lovet noe
  // produktet ikke gjør.
  "home.recommended": { nb: "Reisemål vi kan godt", en: "Destinations we know well" },
  "home.deals": { nb: "Populære ruter fra Norge", en: "Popular routes from Norway" },
  "home.quiz.title": { nb: "Usikker på hvor du vil?", en: "Not sure where to go?" },
  "home.quiz.body": { nb: "Svar på noen korte spørsmål, så finner vi reiser som passer deg.", en: "Answer a few short questions and we will find trips that suit you." },
  "home.quiz.cta": { nb: "Finn min reise", en: "Find my trip" },
  "home.help.title": { nb: "Snakk med et menneske", en: "Talk to a person" },
  "home.help.body": { nb: "Usikker på bagasje, mellomlanding eller hvem som kan reise? Skriv til oss, så svarer vi på norsk.", en: "Unsure about baggage, connections or who can travel? Message us and we answer in Norwegian." },
  "home.seeall": { nb: "Se alle", en: "See all" },
  "home.recent": { nb: "Siste søk", en: "Recent searches" },
  "home.paylater": { nb: "Book nå, betal senere med Klarna", en: "Book now, pay later with Klarna" },

  // ── Explore / Saved ────────────────────────────────────────────────────
  "explore.title": { nb: "Utforsk reisemål", en: "Explore destinations" },
  "explore.all": { nb: "Alle", en: "All" },
  "saved.title": { nb: "Lagrede reisemål", en: "Saved destinations" },
  "saved.empty": { nb: "Ingen lagrede reisemål ennå", en: "No saved destinations yet" },
  "saved.recent": { nb: "Siste søk", en: "Recent searches" },
  "saved.count_one": { nb: "{count} lagret reisemål", en: "{count} saved destination" },
  "saved.count_other": { nb: "{count} lagrede reisemål", en: "{count} saved destinations" },

  // ── Profile ────────────────────────────────────────────────────────────
  "profile.title": { nb: "Profil", en: "Profile" },
  "profile.login": { nb: "Logg inn eller lag konto", en: "Log in or create account" },
  "profile.loginsub": { nb: "Se reisene dine samlet og bestill raskere", en: "See your trips in one place and book faster" },
  "profile.mybookings": { nb: "Mine bestillinger", en: "My bookings" },
  "profile.mytrip": { nb: "Min reise", en: "My trip" },
  "profile.mytripsub": { nb: "Finn bestillingen din med referanse", en: "Find your booking with a reference" },
  "profile.flightstatus": { nb: "Flystatus", en: "Flight status" },
  "profile.flightstatussub": { nb: "Sjekk avganger og ankomster", en: "Check departures and arrivals" },
  "profile.hotelcar": { nb: "Hotell og leiebil", en: "Hotels and car rental" },
  "profile.hotelcarsub": { nb: "Vi ordner hele reisen", en: "We arrange the whole trip" },
  "profile.quiz": { nb: "Reisequiz", en: "Travel quiz" },
  "profile.quizsub": { nb: "Finn reisemålet som passer deg", en: "Find the destination that suits you" },
  "profile.help": { nb: "Hjelp og kundeservice", en: "Help and customer service" },
  "profile.helpsub": { nb: "Svar, kontakt og rettigheter", en: "Answers, contact and rights" },
  "profile.settings": { nb: "Innstillinger", en: "Settings" },
  "profile.language": { nb: "Språk", en: "Language" },
  "profile.currency": { nb: "Valuta", en: "Currency" },
  "profile.theme": { nb: "Mørk modus", en: "Dark mode" },
  "profile.logout": { nb: "Logg ut", en: "Log out" },
  "profile.edit": { nb: "Rediger profil", en: "Edit profile" },
  "profile.travelers": { nb: "Lagrede reisende", en: "Saved travellers" },
  "profile.alerts": { nb: "Prisvarsler", en: "Price alerts" },
  "profile.bonus": { nb: "Bonus", en: "Bonus" },
  "profile.invite": { nb: "Inviter venner", en: "Invite friends" },
  "profile.invitesub": { nb: "Dere får 200 kr hver i bonus", en: "You both get 200 kr in bonus" },
  "profile.verify": { nb: "Bekreft e-postadressen din", en: "Verify your email address" },
  "profile.verifysub": { nb: "Sjekk innboksen — eller send lenken på nytt", en: "Check your inbox — or resend the link" },
  "profile.community": { nb: "Reisesamfunn", en: "Travel community" },
  "profile.communitysub": { nb: "Del tips, svar og spørsmål med andre reisende", en: "Share tips, answers and questions with other travellers" },

  // ── Search ─────────────────────────────────────────────────────────────
  "search.where": { nb: "Hvor reiser du?", en: "Where are you going?" },
  "search.from": { nb: "Fra", en: "From" },
  "search.to": { nb: "Til", en: "To" },
  "search.depart": { nb: "Utreise", en: "Departure" },
  "search.return": { nb: "Hjemreise", en: "Return" },
  "search.travelers": { nb: "Reisende", en: "Travellers" },
  "search.button": { nb: "Søk fly", en: "Search flights" },
  "search.passengers_one": { nb: "{count} reisende", en: "{count} traveller" },
  "search.passengers_other": { nb: "{count} reisende", en: "{count} travellers" },

  // ── Diverse ────────────────────────────────────────────────────────────
  "misc.from": { nb: "fra", en: "from" },
  "misc.cheapest": { nb: "Billigst", en: "Cheapest" },
  "misc.close": { nb: "Lukk", en: "Close" },
  "misc.night_one": { nb: "{count} natt", en: "{count} night" },
  "misc.night_other": { nb: "{count} netter", en: "{count} nights" },

  // ── Felles ─────────────────────────────────────────────────────────────
  "common.back": { nb: "Tilbake", en: "Back", sv: "Tillbaka", da: "Tilbage", de: "Zurück" },
  "common.next": { nb: "Neste", en: "Next", sv: "Nästa", da: "Næste", de: "Weiter" },
  "common.retry": { nb: "Prøv igjen", en: "Try again", sv: "Försök igen", da: "Prøv igen", de: "Erneut versuchen" },
  "common.searchagain": { nb: "Søk på nytt", en: "Search again", sv: "Sök igen", da: "Søg igen", de: "Erneut suchen" },
  "common.contactus": { nb: "Kontakt oss", en: "Contact us", sv: "Kontakta oss", da: "Kontakt os", de: "Kontakt" },
  "common.sent": { nb: "Sendt!", en: "Sent!", sv: "Skickat!", da: "Sendt!", de: "Gesendet!" },
  "common.sending": { nb: "Sender …", en: "Sending …", sv: "Skickar …", da: "Sender …", de: "Wird gesendet …" },
  "common.resendlink": { nb: "Send lenken på nytt", en: "Resend the link" },
  "common.login": { nb: "Logg inn", en: "Log in", sv: "Logga in", da: "Log ind", de: "Anmelden" },
  "common.pax_one": { nb: "{count} reisende", en: "{count} traveller" },
  "common.pax_other": { nb: "{count} reisende", en: "{count} travellers" },
  "common.pnr": { nb: "Bookingreferanse (PNR)", en: "Booking reference (PNR)" },
  "common.itinerary": { nb: "Reiserute", en: "Itinerary", sv: "Resväg", da: "Rejserute", de: "Reiseroute" },
  "common.tickets": { nb: "Reisende og billetter", en: "Travellers and tickets" },
  "common.class": { nb: "Klasse", en: "Class" },
  "common.booked": { nb: "Bestilt", en: "Booked" },
  "common.refund": { nb: "Refusjon", en: "Refund" },
  "common.price": { nb: "Pris", en: "Price", sv: "Pris", da: "Pris", de: "Preis" },
  "common.total": { nb: "Totalt", en: "Total", sv: "Totalt", da: "I alt", de: "Gesamt" },
  "common.paid": { nb: "Betalt", en: "Paid" },
  "common.fee": { nb: "Servicegebyr", en: "Service fee" },
  "common.flights": { nb: "Flybilletter", en: "Flight tickets" },
  "common.extrabags": { nb: "Ekstra bagasje", en: "Extra baggage" },
  "common.bonusused": { nb: "Bonus brukt", en: "Bonus used" },
  "common.refunded": { nb: "Refundert", en: "Refunded" },
  "common.bags_one": { nb: "{count} kolli", en: "{count} bag" },
  "common.bags_other": { nb: "{count} kolli", en: "{count} bags" },
  "common.email": { nb: "E-post", en: "E-mail", sv: "E-post", da: "E-mail", de: "E-Mail" },
  "common.emailaddress": { nb: "E-postadresse", en: "E-mail address" },
  "common.emailph": { nb: "deg@eksempel.no", en: "you@example.com" },
  "common.first": { nb: "Fornavn", en: "First name" },
  "common.last": { nb: "Etternavn", en: "Last name" },
  "common.choose": { nb: "Velg …", en: "Choose …" },

  // ── Søkeresultater ─────────────────────────────────────────────────────
  "sr.sort.best": { nb: "Anbefalt", en: "Recommended" },
  "sr.sort.cheapest": { nb: "Billigst", en: "Cheapest" },
  "sr.sort.fastest": { nb: "Raskest", en: "Fastest" },
  "sr.sort.earliest": { nb: "Tidligst avgang", en: "Earliest departure" },
  "sr.sorting": { nb: "Sortering", en: "Sorting" },
  "sr.time.all": { nb: "Alle", en: "All" },
  "sr.time.night": { nb: "Før 06", en: "Before 06" },
  "sr.time.morning": { nb: "06–12", en: "06–12" },
  "sr.time.day": { nb: "12–18", en: "12–18" },
  "sr.time.evening": { nb: "Etter 18", en: "After 18" },
  "sr.filter": { nb: "Filtrer", en: "Filter" },
  "sr.filter.short": { nb: "Filter", en: "Filter" },
  "sr.filter.title": { nb: "Filtrer resultatet", en: "Filter results" },
  "sr.filter.maxprice": { nb: "Maks totalpris", en: "Max total price" },
  "sr.filter.upto": { nb: "Opptil", en: "Up to" },
  "sr.filter.approxfee": { nb: "(ca. inkl. servicegebyr)", en: "(approx. incl. service fee)" },
  "sr.filter.stops": { nb: "Stopp", en: "Stops" },
  "sr.filter.direct": { nb: "Kun direkte", en: "Direct only" },
  "sr.filter.max1": { nb: "Maks 1 stopp", en: "Max 1 stop" },
  "sr.filter.ticket": { nb: "Billett", en: "Ticket" },
  "sr.filter.baggage": { nb: "Innsjekket bagasje inkludert", en: "Checked baggage included" },
  "sr.filter.refundable": { nb: "Kun refunderbare", en: "Refundable only" },
  "sr.filter.deptime": { nb: "Avgangstid", en: "Departure time" },
  "sr.filter.arrtime": { nb: "Ankomsttid", en: "Arrival time" },
  "sr.filter.maxduration": { nb: "Maks reisetid", en: "Max travel time" },
  "sr.filter.unlimited": { nb: "Ubegrenset", en: "Unlimited" },
  "sr.filter.maxlayover": { nb: "Maks mellomlanding", en: "Max layover" },
  "sr.filter.origin": { nb: "Avreiseflyplass", en: "Departure airport" },
  "sr.filter.dest": { nb: "Ankomstflyplass", en: "Arrival airport" },
  "sr.filter.airlines": { nb: "Flyselskaper", en: "Airlines" },
  "sr.filter.reset": { nb: "Nullstill filtre", en: "Reset filters" },
  "sr.filter.resetcount": { nb: "Nullstill filtre ({count})", en: "Reset filters ({count})" },
  "sr.multicity": { nb: "Flerbyreise", en: "Multi-city" },
  "sr.oneway": { nb: "én vei", en: "one way" },
  "sr.to": { nb: "til", en: "to" },
  "sr.edit": { nb: "Endre søk", en: "Edit search" },
  "sr.alert": { nb: "Prisvarsel", en: "Price alert" },
  "sr.demo": { nb: "Demomodus: prisene er ikke reelle", en: "Demo mode: prices are not real" },
  "sr.alert.title": { nb: "Få varsel når prisen faller", en: "Get notified when the price drops" },
  "sr.alert.body": { nb: "Vi følger {route} {date} og sender deg e-post når prisen kommer under målet ditt.", en: "We watch {route} {date} and e-mail you when the price drops below your target." },
  "sr.alert.emailph": { nb: "E-postadressen din", en: "Your e-mail address" },
  "sr.alert.target": { nb: "Målpris i kroner", en: "Target price" },
  "sr.alert.targetph": { nb: "Målpris i kr", en: "Target price" },
  "sr.alert.eg": { nb: "F.eks. {amount}", en: "E.g. {amount}" },
  "sr.alert.saving": { nb: "Lagrer …", en: "Saving …" },
  "sr.alert.activate": { nb: "Aktiver prisvarsel", en: "Activate price alert" },
  "sr.alert.active": { nb: "Varslet er aktivt. Vi sender e-post når prisen faller.", en: "The alert is active. We e-mail you when the price drops." },
  "sr.strip.from": { nb: "fra {price}", en: "from {price}" },
  "sr.strip.search": { nb: "Søk", en: "Search" },
  "sr.flexible": { nb: "Fleksible datoer?", en: "Flexible dates?" },
  "sr.expired": { nb: "Prisene er ikke lenger gyldige", en: "Prices are no longer valid" },
  "sr.searching": { nb: "Søker etter fly {to} …", en: "Searching for flights {to} …" },
  "sr.searching.to": { nb: "til {city}", en: "to {city}" },
  "sr.searching.sub": { nb: "Vi henter priser og tilgjengelighet fra flyselskapene", en: "Fetching prices and availability from the airlines" },
  "sr.error.title": { nb: "Søket gikk ikke helt som planlagt", en: "The search did not go as planned" },
  "sr.empty.filtered": { nb: "Ingen flyvninger passer filtrene", en: "No flights match the filters" },
  "sr.empty.none": { nb: "Ingen flyvninger funnet", en: "No flights found" },
  "sr.empty.filteredsub": { nb: "Prøv å fjerne noen filtre, eller juster datoene for å se flere alternativer.", en: "Try removing some filters or adjusting the dates to see more options." },
  "sr.empty.nonesub": { nb: "Prøv andre datoer eller flyplasser.", en: "Try other dates or airports." },
  "sr.results_one": { nb: "{count} alternativ", en: "{count} option" },
  "sr.results_other": { nb: "{count} alternativer", en: "{count} options" },
  "sr.results.of": { nb: "(av {count})", en: "(of {count})" },
  "sr.validfor": { nb: "Prisene er gyldige i ca. {count} min", en: "Prices are valid for approx. {count} min" },
  "sr.more": { nb: "Vis flere ({count} igjen)", en: "Show more ({count} left)" },
  "sr.disclaimer": { nb: "Prisene hentes fra flyselskapene og vises ca. inkl. HelloSkys servicegebyr. Endelig pris bekreftes før betaling.", en: "Prices come from the airlines and are shown approx. incl. HelloSky's service fee. The final price is confirmed before payment." },
  "sr.share": { nb: "Fly hos HelloSky: {route} {date} kl. {time}, ca. {price} totalt for {count} reisende. Se selv: {url}", en: "Flights at HelloSky: {route} {date} at {time}, approx. {price} total for {count} travellers. See for yourself: {url}" },

  // ── Checkout ───────────────────────────────────────────────────────────
  "co.step.pax": { nb: "Reisende", en: "Travellers" },
  "co.step.contact": { nb: "Kontakt", en: "Contact" },
  "co.step.bags": { nb: "Bagasje", en: "Baggage" },
  "co.step.payment": { nb: "Betaling", en: "Payment" },
  "co.step.confirm": { nb: "Bekreftelse", en: "Confirmation" },
  "co.nooffer": { nb: "Ingen reise valgt ennå", en: "No trip selected yet" },
  "co.startsearch": { nb: "Start et søk", en: "Start a search" },
  "co.backresults": { nb: "Tilbake til resultater", en: "Back to results" },
  "co.title": { nb: "Fullfør bestillingen", en: "Complete your booking" },
  "co.secure": { nb: "Kryptert forbindelse — kortet belastes først når flyselskapet har bekreftet billetten", en: "Encrypted connection — your card is only charged once the airline has confirmed the ticket" },
  "co.progress": { nb: "Fremdrift", en: "Progress" },
  "co.stepof": { nb: "Steg {n} av {total}: {label}", en: "Step {n} of {total}: {label}" },
  "co.trip": { nb: "Reisen din", en: "Your trip" },
  "co.leg.single": { nb: "Reise", en: "Trip" },
  "co.leg.out": { nb: "Utreise", en: "Outbound" },
  "co.leg.return": { nb: "Hjemreise", en: "Return" },
  "co.leg.n": { nb: "Strekning {n}", en: "Leg {n}" },
  "co.operatedby": { nb: "(operert av {name})", en: "(operated by {name})" },
  "co.bags.included": { nb: "{count} innsjekket kolli per reisende", en: "{count} checked bag(s) per traveller" },
  "co.bags.handonly": { nb: "Kun håndbagasje inkludert", en: "Hand baggage only" },
  "co.bags.unknown": { nb: "Bagasje ikke oppgitt av flyselskapet", en: "Baggage not stated by the airline" },
  "co.pax.title": { nb: "Hvem reiser?", en: "Who is travelling?" },
  "co.pax.note": { nb: "Navnene må staves nøyaktig som i passet. Navneendring etter utstedelse er ofte ikke mulig.", en: "Names must be spelled exactly as in the passport. Name changes after issuing are often not possible." },
  "co.pax.fromsaved": { nb: "Fyll inn fra lagrede reisende:", en: "Fill in from saved travellers:" },
  "co.pax.infantlap": { nb: "(reiser i fanget)", en: "(lap infant)" },
  "co.f.title": { nb: "Tittel", en: "Title" },
  "co.f.given": { nb: "Fornavn (som i passet)", en: "First name (as in passport)" },
  "co.f.family": { nb: "Etternavn (som i passet)", en: "Last name (as in passport)" },
  "co.f.born": { nb: "Fødselsdato", en: "Date of birth" },
  "co.f.born.adult": { nb: "Minst 12 år ved avreise", en: "At least 12 years at departure" },
  "co.f.born.child": { nb: "2–11 år ved siste avreise", en: "2–11 years at last departure" },
  "co.f.born.infant": { nb: "Under 2 år ved siste avreise", en: "Under 2 years at last departure" },
  "co.f.gender": { nb: "Kjønn", en: "Gender" },
  "co.f.gender.hint": { nb: "Kreves av flyselskapet", en: "Required by the airline" },
  "co.f.male": { nb: "Mann", en: "Male" },
  "co.f.female": { nb: "Kvinne", en: "Female" },
  "co.f.guardian": { nb: "Reiser med voksen", en: "Travelling with adult" },
  "co.f.adultn": { nb: "Voksen {n}", en: "Adult {n}" },
  "co.f.passport": { nb: "Passnummer", en: "Passport number" },
  "co.f.passport.hint": { nb: "Lagres kryptert og bare til billetten er utstedt", en: "Stored encrypted and only until the ticket is issued" },
  "co.f.country": { nb: "Utstederland", en: "Issuing country" },
  "co.f.expiry": { nb: "Passet utløper", en: "Passport expires" },
  "co.f.expiry.hint": { nb: "Må være gyldig t.o.m. {date}", en: "Must be valid until {date}" },
  "co.f.email2": { nb: "Gjenta e-post", en: "Repeat e-mail" },
  "co.f.phone": { nb: "Mobilnummer", en: "Mobile number" },
  "co.f.phone.hint": { nb: "Brukes kun til viktige beskjeder om reisen", en: "Only used for important messages about the trip" },
  "co.f.countrycode": { nb: "Landskode", en: "Country code" },
  "co.v.given": { nb: "Fornavn må skrives med latinske bokstaver (1–60 tegn), som i passet.", en: "First name must use Latin letters (1–60 characters), as in the passport." },
  "co.v.family": { nb: "Etternavn må skrives med latinske bokstaver (1–60 tegn), som i passet.", en: "Last name must use Latin letters (1–60 characters), as in the passport." },
  "co.v.born": { nb: "Oppgi fødselsdato.", en: "Enter date of birth." },
  "co.v.bornbad": { nb: "Fødselsdatoen ser ikke riktig ut.", en: "The date of birth does not look right." },
  "co.v.adultage": { nb: "Voksne må være minst 12 år ved avreise. Velg «barn» eller «baby» i søket.", en: "Adults must be at least 12 at departure. Choose “child” or “infant” in the search." },
  "co.v.childage": { nb: "Barn må være 2–11 år ved siste avreise. Søk på nytt med riktig alder.", en: "Children must be 2–11 at the last departure. Search again with the correct age." },
  "co.v.infantage": { nb: "Babyer uten eget sete må være under 2 år ved siste avreise.", en: "Lap infants must be under 2 at the last departure." },
  "co.v.agemismatch": { nb: "Alder ved avreise stemmer ikke med søket. Søk på nytt med riktig alder.", en: "Age at departure does not match the search. Search again with the correct age." },
  "co.v.title": { nb: "Velg tittel.", en: "Choose a title." },
  "co.v.gender": { nb: "Velg kjønn slik det står i passet.", en: "Choose gender as stated in the passport." },
  "co.v.guardian": { nb: "Velg hvilken voksen babyen reiser med.", en: "Choose which adult the infant travels with." },
  "co.v.guardiandup": { nb: "Hver voksen kan reise med maks én baby på fanget.", en: "Each adult can travel with at most one lap infant." },
  "co.v.passport": { nb: "Passnummeret ser ikke riktig ut (5–20 bokstaver/siffer).", en: "The passport number does not look right (5–20 letters/digits)." },
  "co.v.country": { nb: "Velg utstederland.", en: "Choose issuing country." },
  "co.v.expiry": { nb: "Oppgi passets utløpsdato.", en: "Enter the passport expiry date." },
  "co.v.expiryshort": { nb: "Passet må være gyldig til og med siste ankomstdato.", en: "The passport must be valid through the last arrival date." },
  "co.v.noadult": { nb: "Minst én voksen må være med på reisen.", en: "At least one adult must be on the trip." },
  "co.v.email": { nb: "Skriv inn en gyldig e-postadresse.", en: "Enter a valid e-mail address." },
  "co.v.emailrepeat": { nb: "E-postadressene er ikke like.", en: "The e-mail addresses do not match." },
  "co.v.phone": { nb: "Skriv inn et gyldig mobilnummer med landskode.", en: "Enter a valid mobile number with country code." },
  "co.v.terms": { nb: "Du må godta vilkårene for å fortsette.", en: "You must accept the terms to continue." },
  "co.next.contact": { nb: "Neste: kontakt", en: "Next: contact" },
  "co.next.bags": { nb: "Neste: bagasje", en: "Next: baggage" },
  "co.contact.title": { nb: "Kontaktinformasjon", en: "Contact details" },
  "co.contact.sub": { nb: "Billett og viktig informasjon om reisen sendes hit.", en: "Your ticket and important trip information are sent here." },
  "co.terms.aria": { nb: "Vilkår", en: "Terms" },
  "co.terms.label": { nb: "Jeg godtar HelloSkys reisevilkår og flyselskapets transportbetingelser, og bekrefter at opplysningene er riktige.", en: "I accept HelloSky's terms of travel and the airline's conditions of carriage, and confirm that the details are correct." },
  "co.marketing": { nb: "Ja takk, send meg reisetips og tilbud på e-post (valgfritt, kan avmeldes når som helst).", en: "Yes please, send me travel tips and offers by e-mail (optional, unsubscribe at any time)." },
  "co.bonus.use": { nb: "Bruk bonus ({amount} kr tilgjengelig) — nøyaktig fradrag bekreftes i neste steg", en: "Use bonus ({amount} kr available) — the exact deduction is confirmed in the next step" },
  "co.topay": { nb: "Gå til betaling", en: "Go to payment" },
  "co.confirmingprice": { nb: "Bekrefter pris …", en: "Confirming price …" },
  "co.confirming": { nb: "Bekrefter …", en: "Confirming …" },
  "co.demo.title": { nb: "Demobestilling — ingen betaling", en: "Demo booking — no payment" },
  "co.demo.body": { nb: "Betaling er ikke konfigurert i dette miljøet. Ingen kort belastes og ingen ekte billett utstedes.", en: "Payment is not configured in this environment. No card is charged and no real ticket is issued." },
  "co.editdetails": { nb: "Endre opplysninger (avbryter betalingsøkten)", en: "Edit details (cancels the payment session)" },
  "co.slow.title": { nb: "Dette tar lengre tid enn vanlig", en: "This is taking longer than usual" },
  "co.slow.body": { nb: "Vi venter fortsatt på flyselskapets bekreftelse. Du får e-post til {email} så snart den er klar — du kan trygt lukke siden. Kortet belastes ikke før billetten er bekreftet.", en: "We are still waiting for the airline's confirmation. You will get an e-mail at {email} as soon as it is ready — you can safely close the page. The card is not charged until the ticket is confirmed." },
  "co.youraddress": { nb: "adressen du oppga", en: "the address you provided" },
  "co.checkagain": { nb: "Sjekk status igjen", en: "Check status again" },
  "co.gomytrip": { nb: "Gå til Min reise", en: "Go to My trip" },
  "co.booking": { nb: "Bestiller billetten hos flyselskapet …", en: "Booking the ticket with the airline …" },
  "co.confirmingpayment": { nb: "Bekrefter betalingen …", en: "Confirming the payment …" },
  "co.wait": { nb: "Dette tar vanligvis under ett minutt. Ikke last siden på nytt — vi sender deg videre automatisk.", en: "This usually takes under a minute. Do not reload the page — we will forward you automatically." },
  "co.ref": { nb: "Referanse {ref} — henter billetter …", en: "Reference {ref} — fetching tickets …" },
  "co.validfor": { nb: "Prisen gjelder i {time}", en: "Price valid for {time}" },
  "co.extrabags": { nb: "Ekstra bagasje ({count} kolli)", en: "Extra baggage ({count} bags)" },
  "co.fee.approx": { nb: "Servicegebyr (ca.)", en: "Service fee (approx.)" },
  "co.total.est": { nb: "Estimert totalt", en: "Estimated total" },
  "co.price.final": { nb: "Endelig pris bekreftet av HelloSky. Inkluderer skatter, avgifter og servicegebyr.", en: "Final price confirmed by HelloSky. Includes taxes, fees and service fee." },
  "co.price.est": { nb: "Estimat inkl. skatter og avgifter. Servicegebyret legges til og endelig pris bekreftes når du går til betaling.", en: "Estimate incl. taxes and fees. The service fee is added and the final price confirmed when you go to payment." },
  "co.closed": { nb: "Direktebooking er midlertidig stengt. Kontakt oss, så hjelper vi deg med bestillingen.", en: "Instant booking is temporarily closed. Contact us and we will help you with the booking." },
  "co.issuedby": { nb: "Billetten utstedes av {name}. Bekreftelse sendes til {email}.", en: "The ticket is issued by {name}. Confirmation is sent to {email}." },
  "co.youremail": { nb: "e-postadressen din", en: "your e-mail address" },
  "co.pay": { nb: "Betal {amount}", en: "Pay {amount}" },
  "co.paymentfailed": { nb: "Betalingen ble avbrutt eller avvist. Prøv igjen.", en: "The payment was cancelled or declined. Please try again." },
  "co.bookingfailed": { nb: "Bestillingen kunne ikke fullføres. Reservasjonen på kortet frigis automatisk.", en: "The booking could not be completed. The reservation on your card is released automatically." },
  "co.exp.title": { nb: "Prisen er ikke lenger gyldig", en: "The price is no longer valid" },
  "co.exp.body": { nb: "Flypriser holdes bare i et begrenset tidsrom. Vi søker etter samme reise på nytt med oppdaterte priser.", en: "Flight prices are only held for a limited time. We are searching for the same trip again with updated prices." },
  "co.exp.searching": { nb: "Søker etter samme reise …", en: "Searching for the same trip …" },
  "co.exp.found": { nb: "Vi fant reisen igjen:", en: "We found the trip again:" },
  "co.exp.dearer": { nb: "dyrere", en: "more expensive" },
  "co.exp.cheaper": { nb: "billigere", en: "cheaper" },
  "co.exp.exclfee": { nb: "ekskl. servicegebyr", en: "excl. service fee" },
  "co.exp.continue": { nb: "Fortsett med oppdatert pris", en: "Continue with updated price" },
  "co.exp.samesearch": { nb: "Søk på nytt med samme reise", en: "Search again for the same trip" },
  "co.exp.restart": { nb: "Start helt på nytt", en: "Start over" },
  "co.err.nocharge": { nb: "Ingenting er trukket fra kortet ditt.", en: "Nothing has been charged to your card." },
  "co.err.callus": { nb: "Ring oss eller send en melding, så booker vi for deg.", en: "Call or message us and we will book for you." },
  "co.err.newprice": { nb: "Ny pris vises i sammendraget. Ingenting er reservert på kortet ditt.", en: "The new price is shown in the summary. Nothing is reserved on your card." },
  "co.err.continuenew": { nb: "Fortsett med ny pris", en: "Continue with new price" },
  "co.pc.title": { nb: "Prisen har endret seg hos flyselskapet", en: "The price has changed at the airline" },
  "co.pc.body": { nb: "Reservasjonen på kortet ditt er frigitt. Du kan fortsette med ny pris — da opprettes en ny betaling.", en: "The reservation on your card has been released. You can continue with the new price — a new payment will be created." },
  "co.pc.old": { nb: "Gammel pris", en: "Old price" },
  "co.pc.new": { nb: "Ny pris", en: "New price" },
  "co.pc.fetching": { nb: "Hentes …", en: "Fetching …" },

  // ── Tilbud (checkout-lenke) ────────────────────────────────────────────
  "qp.pax.title": { nb: "Hvem reiser?", en: "Who is travelling?" },
  "qp.pax.sub": { nb: "Fyll inn reisende før betaling — nøyaktig som i passet.", en: "Enter the travellers before payment — exactly as in the passport." },
  "qp.pax.save": { nb: "Lagre reisende", en: "Save travellers" },
  "qp.pax.saved": { nb: "Reisende er registrert", en: "Travellers registered" },
  "qp.pax.edit": { nb: "Endre", en: "Edit" },
  "qp.pax.required": { nb: "Registrer reisende før du går til betaling.", en: "Register the travellers before going to payment." },
  "qp.pax.phone": { nb: "Mobilnummer (valgfritt)", en: "Mobile number (optional)" },
  "qp.pax.thenpay": { nb: "Betalingen åpnes så snart reisende er registrert.", en: "Payment opens as soon as the travellers are registered." },

  // ── Kvittering ─────────────────────────────────────────────────────────
  "rc.title": { nb: "Kvittering nr. {n}", en: "Receipt no. {n}" },
  "rc.plain": { nb: "Kvittering", en: "Receipt" },
  "rc.issued": { nb: "Utstedt {date}", en: "Issued {date}" },
  "rc.desc": { nb: "Beskrivelse", en: "Description" },
  "rc.amount": { nb: "Beløp", en: "Amount" },
  "rc.vatrate": { nb: "Mva-sats", en: "VAT rate" },
  "rc.vat": { nb: "Mva", en: "VAT" },
  "rc.vatsummary": { nb: "Herav mva", en: "Of which VAT" },
  "rc.psp": { nb: "Betalingsreferanse", en: "Payment reference" },
  "rc.view": { nb: "Se kvittering", en: "View receipt" },

  // ── Bekreftelse ────────────────────────────────────────────────────────
  "cf.err.auth": { nb: "Du må bekrefte hvem du er", en: "You need to confirm who you are" },
  "cf.err.notfound": { nb: "Vi fant ikke bestillingen", en: "We could not find the booking" },
  "cf.err.authbody": { nb: "Bruk lenken fra bekreftelses-e-posten, logg inn med kontoen bestillingen er knyttet til, eller slå den opp med referanse og e-post.", en: "Use the link from the confirmation e-mail, log in with the account the booking belongs to, or look it up with reference and e-mail." },
  "cf.find": { nb: "Finn bestilling", en: "Find booking" },
  "cf.failed": { nb: "Bestillingen gikk ikke gjennom", en: "The booking did not go through" },
  "cf.almost": { nb: "Nesten i mål", en: "Almost there" },
  "cf.bonvoyage": { nb: "God tur{name}!", en: "Have a great trip{name}!" },
  "cf.failedbody": { nb: "Reservasjonen på kortet ditt frigis automatisk. Vi har ikke belastet deg.", en: "The reservation on your card is released automatically. You have not been charged." },
  "cf.processing": { nb: "Vi venter på at {carrier} bekrefter billetten. Du får e-post til {email} når den er klar — kortet belastes først da.", en: "We are waiting for {carrier} to confirm the ticket. You will get an e-mail at {email} when it is ready — the card is charged only then." },
  "cf.airline": { nb: "flyselskapet", en: "the airline" },
  "cf.cancelled": { nb: "Denne reisen er avbestilt.", en: "This trip has been cancelled." },
  "cf.sentto": { nb: "Billetten er bekreftet og sendt til", en: "The ticket is confirmed and sent to" },
  "cf.copyref": { nb: "Kopier bookingreferanse {ref}", en: "Copy booking reference {ref}" },
  "cf.copied": { nb: "Kopiert!", en: "Copied!" },
  "cf.demo": { nb: "Demobestilling — ingen reell billett er utstedt", en: "Demo booking — no real ticket has been issued" },
  "cf.extras": { nb: "Tilvalg", en: "Extras" },
  "cf.extrabags": { nb: "{count} ekstra kolli", en: "{count} extra bag(s)" },
  "cf.ticketspending": { nb: "E-billettnumre vises her så snart flyselskapet har utstedt dem.", en: "E-ticket numbers appear here as soon as the airline has issued them." },
  "cf.cancel.title": { nb: "Avbestilling og refusjon", en: "Cancellation and refund" },
  "cf.inbox": { nb: "Sjekk innboksen", en: "Check your inbox" },
  "cf.inboxbody": { nb: "Bekreftelse med billettnummer sendes på e-post. Sjekk søppelpost hvis den ikke dukker opp.", en: "A confirmation with ticket numbers is sent by e-mail. Check your spam folder if it does not show up." },
  "cf.flightstatus": { nb: "Flystatus", en: "Flight status" },
  "cf.checkflight": { nb: "Sjekk {flight} før avreise.", en: "Check {flight} before departure." },
  "cf.help": { nb: "Trenger du noe?", en: "Need anything?" },
  "cf.helpbody": { nb: "Kundeservice hjelper deg med endringer og spørsmål.", en: "Customer service helps you with changes and questions." },
  "cf.next": { nb: "Planlegg neste reise", en: "Plan your next trip" },

  // ── Min reise ──────────────────────────────────────────────────────────
  "mt.fetchfail": { nb: "Kunne ikke hente bestillingen.", en: "Could not fetch the booking." },
  "mt.change.title": { nb: "Endre eller avbestille", en: "Change or cancel" },
  "mt.change.sub": { nb: "Avbestilling kan gjøres her når billetten tillater det. Endringer ordner kundeservice for deg.", en: "Cancellation can be done here when the ticket allows it. Customer service handles changes for you." },
  "mt.requestchange": { nb: "Be om endring", en: "Request a change" },
  "mt.kicker": { nb: "Min reise", en: "My trip" },
  "mt.title": { nb: "Finn bestillingen din", en: "Find your booking" },
  "mt.sub": { nb: "Se reiserute, billetter og status — alt du trenger er bookingreferansen fra bekreftelsen.", en: "See itinerary, tickets and status — all you need is the booking reference from the confirmation." },
  "mt.verify.title": { nb: "Bekreft e-posten din for å se bestillingene dine", en: "Verify your e-mail to see your bookings" },
  "mt.verify.body": { nb: "Vi har sendt en bekreftelseslenke til {email}. Har du ikke fått den?", en: "We have sent a verification link to {email}. Did not get it?" },
  "mt.yourbookings": { nb: "Dine bestillinger, {name}", en: "Your bookings, {name}" },
  "mt.trip.ref": { nb: "ref. {ref}", en: "ref. {ref}" },
  "mt.demo": { nb: "demo", en: "demo" },
  "mt.nobookings": { nb: "Ingen bestillinger er knyttet til kontoen din ennå.", en: "No bookings are linked to your account yet." },
  "mt.lookup": { nb: "Slå opp med referanse", en: "Look up by reference" },
  "mt.ref": { nb: "Bookingreferanse", en: "Booking reference" },
  "mt.refph": { nb: "f.eks. X7K2P9", en: "e.g. X7K2P9" },
  "mt.email": { nb: "E-post brukt ved bestilling", en: "E-mail used when booking" },
  "mt.looking": { nb: "Ser etter reisen din …", en: "Looking for your trip …" },
  "mt.show": { nb: "Vis min reise", en: "Show my trip" },
  "mt.privacy": { nb: "Vi deler aldri reiseinformasjonen din med andre.", en: "We never share your travel information with others." },

  // ── Kundeservice ───────────────────────────────────────────────────────
  "sp.kicker": { nb: "Kundeservice", en: "Customer service" },
  "sp.title1": { nb: "Ekte mennesker.", en: "Real people." },
  "sp.title2": { nb: "Ekte hjelp.", en: "Real help." },
  "sp.sub": { nb: "Ingen menylabyrinter eller chatboter som går i sirkel. Hos HelloSky får du svar av folk som kan reiser — og som kjenner bestillingen din.", en: "No menu mazes or chatbots going in circles. At HelloSky you get answers from people who know travel — and who know your booking." },
  "sp.hours": { nb: "Alle dager 06–24", en: "Every day 06–24" },
  "sp.emailsub": { nb: "Vi svarer så raskt vi kan", en: "We reply as fast as we can" },
  "sp.team.aria": { nb: "Menneskene bak HelloSky", en: "The people behind HelloSky" },
  "sp.team.kicker": { nb: "Kontakt oss i dag", en: "Contact us today" },
  "sp.team.title": { nb: "Menneskene bak HelloSky", en: "The people behind HelloSky" },
  "sp.team.sub": { nb: "Når du ringer eller skriver til oss, er det oss du får tak i. Vi kjenner rutene, sesongene — og hva som betyr noe når du reiser hjem. Trykk på WhatsApp-knappen, så åpnes chatten direkte.", en: "When you call or write to us, it is us you reach. We know the routes, the seasons — and what matters when you travel home. Tap the WhatsApp button to open the chat directly." },
  "sp.team.role.owner": { nb: "Eier og daglig leder", en: "Owner and general manager" },
  "sp.team.role.support": { nb: "Kundeservice og drift", en: "Customer service and operations" },
  "sp.team.quote.owner": { nb: "Jeg startet HelloSky fordi å reise hjem til familien aldri skulle vært så komplisert.", en: "I started HelloSky because travelling home to family should never have been this complicated." },
  "sp.team.quote.support": { nb: "Ingen henvendelse er for liten. Vi svarer alltid — også på kveldstid.", en: "No request is too small. We always answer — evenings too." },
  "sp.team.wamsg": { nb: "Hei {name}! Jeg vil gjerne ha hjelp med en reise.", en: "Hi {name}! I would like help with a trip." },
  "sp.team.wa": { nb: "WhatsApp {name} direkte", en: "WhatsApp {name} directly" },
  "sp.team.chat": { nb: "Chat med {name} på WhatsApp", en: "Chat with {name} on WhatsApp" },
  "sp.team.alt": { nb: "{name} — {role} i HelloSky", en: "{name} — {role} at HelloSky" },
  "sp.write": { nb: "Skriv til oss", en: "Write to us" },
  "sp.write.sub": { nb: "Fortell hva det gjelder, så svarer vi på e-post — som regel i løpet av et par timer.", en: "Tell us what it is about and we reply by e-mail — usually within a couple of hours." },
  "sp.thanks": { nb: "Takk for henvendelsen!", en: "Thank you for your message!" },
  "sp.thanks.a": { nb: "Saken din er registrert med referanse", en: "Your case is registered with reference" },
  "sp.thanks.b": { nb: ". Vi svarer til {email} så raskt vi kan.", en: ". We reply to {email} as fast as we can." },
  "sp.name": { nb: "Navnet ditt", en: "Your name" },
  "sp.topic": { nb: "Hva gjelder det?", en: "What is it about?" },
  "sp.ref": { nb: "Bookingreferanse (valgfritt)", en: "Booking reference (optional)" },
  "sp.message": { nb: "Melding", en: "Message" },
  "sp.messageph": { nb: "Hva kan vi hjelpe deg med?", en: "How can we help you?" },
  "sp.err.call": { nb: "Du kan også ringe oss på {phone}.", en: "You can also call us on {phone}." },
  "sp.send": { nb: "Send henvendelse", en: "Send message" },
  "sp.cases": { nb: "Dine saker", en: "Your cases" },
  "sp.cases.login": { nb: "Logg inn for å se sakene dine og svarene fra oss.", en: "Log in to see your cases and our replies." },
  "sp.cases.verify": { nb: "Bekreft e-posten din for å se sakene dine", en: "Verify your e-mail to see your cases" },
  "sp.resendverify": { nb: "Send bekreftelseslenke på nytt", en: "Resend verification link" },
  "sp.cases.none": { nb: "Vi har ingen saker registrert på {email}.", en: "We have no cases registered for {email}." },
  "sp.open": { nb: "Åpen", en: "Open" },
  "sp.closed": { nb: "Avsluttet", en: "Closed" },
  "sp.you": { nb: "Deg", en: "You" },
  "sp.faq": { nb: "Ofte stilte spørsmål", en: "Frequently asked questions" },
  "sp.faq.1.q": { nb: "Hva koster det å bestille gjennom HelloSky?", en: "What does it cost to book through HelloSky?" },
  "sp.faq.1.a": { nb: "Prisen du betaler er flyselskapets pris pluss HelloSkys servicegebyr (normalt 8 % av billettprisen pluss et fast beløp per bestilling, f.eks. 250 kr i NOK). Gebyret vises spesifisert før du betaler og dekker kundeservice, hjelp med endringer og refusjoner, og oppfølging hvis flyet blir forsinket eller kansellert.", en: "The price you pay is the airline's price plus HelloSky's service fee (normally 8 % of the ticket price plus a fixed amount per booking, e.g. 250 kr in NOK). The fee is itemised before you pay and covers customer service, help with changes and refunds, and follow-up if the flight is delayed or cancelled." },
  "sp.faq.2.q": { nb: "Hvordan betaler jeg, og når belastes kortet?", en: "How do I pay, and when is the card charged?" },
  "sp.faq.2.a": { nb: "Du kan betale med bankkort eller Klarna. Kortet reserveres når du bestiller og belastes først når flyselskapet har bekreftet billetten. Får vi ikke bekreftelse, frigis reservasjonen automatisk. Klarnas egne vilkår gjelder for betaling via Klarna.", en: "You can pay by card or Klarna. The card is reserved when you book and charged only once the airline has confirmed the ticket. If we do not get confirmation, the reservation is released automatically. Klarna's own terms apply to payment via Klarna." },
  "sp.faq.3.q": { nb: "Hvordan endrer jeg flybilletten min?", en: "How do I change my flight ticket?" },
  "sp.faq.3.a": { nb: "Send oss bookingreferansen din via skjemaet på denne siden eller ring {phone}, så sjekker vi hva billetttypen din tillater. Billetter merket «kan endres» kan som regel flyttes mot et gebyr og eventuell prisdifferanse. Vi gjør jobben med flyselskapet for deg.", en: "Send us your booking reference via the form on this page or call {phone}, and we check what your fare type allows. Tickets marked “changeable” can usually be moved for a fee plus any fare difference. We handle the airline for you." },
  "sp.faq.4.q": { nb: "Kan jeg få refundert billetten?", en: "Can I get a refund for my ticket?" },
  "sp.faq.4.a": { nb: "Det avhenger av billetttypen. Refunderbare billetter kan du avbestille selv under «Min reise» — der ser du nøyaktig hva du får tilbake før du bekrefter. For ikke-refunderbare billetter får du i mange tilfeller igjen skatter og avgifter. Hvis flyselskapet kansellerer eller endrer flyvningen vesentlig, har du som hovedregel rett på full refusjon — da hjelper vi deg.", en: "It depends on the fare type. Refundable tickets can be cancelled by you under “My trip” — there you see exactly what you get back before confirming. For non-refundable tickets you often get taxes and fees back. If the airline cancels or significantly changes the flight, you are generally entitled to a full refund — and we help you." },
  "sp.faq.5.q": { nb: "Hvor mye bagasje er inkludert?", en: "How much baggage is included?" },
  "sp.faq.5.a": { nb: "Bagasjereglene vises per strekning på hvert tilbud før du bestiller. Ekstra innsjekket bagasje kan du legge til i bestillingen når flyselskapet tilbyr det, ellers kjøpes det direkte hos flyselskapet etter bestilling.", en: "Baggage rules are shown per leg on every offer before you book. Extra checked baggage can be added to the booking when the airline offers it; otherwise it is bought directly from the airline after booking." },
  "sp.faq.6.q": { nb: "Når må jeg sjekke inn?", en: "When do I need to check in?" },
  "sp.faq.6.a": { nb: "Innsjekking åpner vanligvis 24–48 timer før avgang og gjøres direkte hos flyselskapet med bookingreferansen din. Vi anbefaler å være på flyplassen minst 2 timer før avgang innenlands og 3 timer før utenlandsreiser.", en: "Check-in usually opens 24–48 hours before departure and is done directly with the airline using your booking reference. We recommend being at the airport at least 2 hours before domestic and 3 hours before international departures." },
  "sp.faq.7.q": { nb: "Flyet mitt er forsinket eller kansellert — hva gjør jeg?", en: "My flight is delayed or cancelled — what do I do?" },
  "sp.faq.7.a": { nb: "Sjekk flyselskapets nettside eller flyplassens tavle for oppdatert status, og ta kontakt med oss. Ved lange forsinkelser og kanselleringer kan du ha rett på mat, hotell og erstatning etter EU-forordning 261/2004. Vi hjelper deg med både ombestilling og erstatningskrav.", en: "Check the airline's website or the airport board for updated status, and contact us. For long delays and cancellations you may be entitled to meals, hotel and compensation under EU Regulation 261/2004. We help you with both rebooking and compensation claims." },
  "sp.faq.8.q": { nb: "Kan jeg velge sete?", en: "Can I choose a seat?" },
  "sp.faq.8.a": { nb: "Setevalg gjøres hos flyselskapet, som regel ved innsjekking. Har du spesielle ønsker — for eksempel sete ved nødutgang eller plass til familien samlet — si ifra, så formidler vi det til flyselskapet.", en: "Seat selection is done with the airline, usually at check-in. If you have special wishes — for example an exit-row seat or seats together for the family — let us know and we pass it on to the airline." },
  "sp.faq.9.q": { nb: "Reiser barnet mitt alene?", en: "Is my child travelling alone?" },
  "sp.faq.9.a": { nb: "De fleste flyselskaper tilbyr tilsynstjeneste for barn mellom 5 og 11 år som reiser alene. Tjenesten må bestilles i forkant. Kontakt oss, så undersøker vi hva som er mulig på din rute og ordner papirene.", en: "Most airlines offer an unaccompanied-minor service for children aged 5–11 travelling alone. The service must be booked in advance. Contact us and we check what is possible on your route and arrange the paperwork." },
  "sp.faq.10.q": { nb: "Hvordan bruker dere personopplysningene mine?", en: "How do you use my personal data?" },
  "sp.faq.10.a": { nb: "Vi bruker bare opplysningene til å gjennomføre bestillingen din hos flyselskapet og til å gi deg kundeservice. Vi selger aldri dataene dine, og du kan når som helst be oss slette dem. Kortinformasjon lagres aldri hos oss.", en: "We only use your data to complete your booking with the airline and to provide customer service. We never sell your data, and you can ask us to delete it at any time. Card details are never stored with us." },

  // ── Innlogging ─────────────────────────────────────────────────────────
  "au.welcome": { nb: "Velkommen", en: "Welcome" },
  "au.welcome.hl": { nb: "tilbake", en: "back" },
  "au.otp.title": { nb: "Logg inn med", en: "Log in with" },
  "au.otp.hl": { nb: "engangskode", en: "one-time code" },
  "au.create": { nb: "Lag din", en: "Create your" },
  "au.create.hl": { nb: "konto", en: "account" },
  "au.login.sub": { nb: "Logg inn for å se reisene dine og bestille raskere.", en: "Log in to see your trips and book faster." },
  "au.otp.sub": { nb: "Ingen passord — vi sender en kode på SMS til telefonnummeret ditt.", en: "No password — we send a code by SMS to your phone number." },
  "au.register.sub": { nb: "Bare navn, e-post eller telefon og et passord. Ingen adresse, ingen mas.", en: "Just a name, e-mail or phone and a password. No address, no fuss." },
  "au.tab.otp": { nb: "Engangskode", en: "One-time code" },
  "au.tab.register": { nb: "Opprett konto", en: "Create account" },
  "au.forgot": { nb: "Glemt", en: "Forgot" },
  "au.forgot.hl": { nb: "passord?", en: "password?" },
  "au.forgot.sub": { nb: "Skriv inn e-postadressen din, så sender vi deg en lenke for å velge et nytt passord.", en: "Enter your e-mail address and we send you a link to choose a new password." },
  "au.checkemail": { nb: "Sjekk e-posten din", en: "Check your e-mail" },
  "au.forgot.sent": { nb: "Hvis det finnes en konto for {email}, har vi sendt en lenke for å tilbakestille passordet. Lenken er gyldig i 1 time.", en: "If an account exists for {email}, we have sent a link to reset the password. The link is valid for 1 hour." },
  "au.backtologin": { nb: "Tilbake til innlogging", en: "Back to login" },
  "au.otp.info": { nb: "Vi sender en kode på SMS til nummeret du registrerte kontoen med. Ukjent nummer får ingen kode.", en: "We send a code by SMS to the number you registered the account with. Unknown numbers get no code." },
  "au.phone": { nb: "Telefonnummer", en: "Phone number" },
  "au.code": { nb: "Engangskode", en: "One-time code" },
  "au.code.hint": { nb: "Vi har sendt en 6-sifret kode til {phone}. Den er gyldig i 10 minutter.", en: "We have sent a 6-digit code to {phone}. It is valid for 10 minutes." },
  "au.wrongnumber": { nb: "Feil nummer? Send kode på nytt", en: "Wrong number? Send the code again" },
  "au.identifier": { nb: "E-post eller telefonnummer", en: "E-mail or phone number" },
  "au.identifier.hint": { nb: "Vi bruker denne til billett og viktig info om reisen.", en: "We use this for your ticket and important trip info." },
  "au.identifier.ph": { nb: "deg@eksempel.no eller +47 900 00 000", en: "you@example.com or +47 900 00 000" },
  "au.pw": { nb: "Passord", en: "Password" },
  "au.pw.hint": { nb: "Minst 10 tegn.", en: "At least 10 characters." },
  "au.pwshort": { nb: "Passordet må være minst 10 tegn.", en: "The password must be at least 10 characters." },
  "au.usepw": { nb: " Logg inn med passord i stedet.", en: " Log in with a password instead." },
  "au.retryin": { nb: " Du kan prøve igjen om {count} s.", en: " You can try again in {count} s." },
  "au.wait": { nb: "Vennligst vent …", en: "Please wait …" },
  "au.waits": { nb: "Vent {count} s", en: "Wait {count} s" },
  "au.submit.code": { nb: "Logg inn med kode", en: "Log in with code" },
  "au.submit.sendcode": { nb: "Send engangskode", en: "Send one-time code" },
  "au.submit.reset": { nb: "Send tilbakestillingslenke", en: "Send reset link" },
  "au.forgotpw": { nb: "Glemt passordet?", en: "Forgot your password?" },

  // ── Profil (resten) ────────────────────────────────────────────────────
  "pf.avatar": { nb: "Bytt profilbilde", en: "Change profile picture" },
  "pf.bonusrate": { nb: "1 % bonus på hver bestilling", en: "1 % bonus on every booking" },
  "pf.copyreferral": { nb: "Kopier henvisningskode {code}", en: "Copy referral code {code}" },
  "pf.editsub": { nb: "Navn, e-post, telefon og passord", en: "Name, e-mail, phone and password" },
  "pf.travelerssub": { nb: "Fyll ut passasjerskjema med ett trykk", en: "Fill in passenger forms with one tap" },
  "pf.alertssub": { nb: "Vi sier fra når prisen faller", en: "We tell you when the price drops" },
  "pf.stats": { nb: "{posts} innlegg · {likes} liker mottatt", en: "{posts} posts · {likes} likes received" },
  "pf.currencyhint": { nb: "Visningsvaluta — prisene vises alltid i tilbudets valuta", en: "Display preference — prices are always shown in the offer's currency" },
  "pf.marketing": { nb: "Reisetips og tilbud på e-post", en: "Travel tips and offers by e-mail" },
  "pf.marketingsub": { nb: "Kan skrus av når som helst", en: "Can be turned off at any time" },
  "pf.privacy": { nb: "Personvern", en: "Privacy" },
  "pf.export": { nb: "Last ned mine data", en: "Download my data" },
  "pf.exportsub": { nb: "Kopi av kontoen, reisende, bestillinger og saker (JSON). Krever bekreftet e-post.", en: "A copy of your account, travellers, bookings and cases (JSON). Requires a verified e-mail." },
  "pf.fetching": { nb: "Henter …", en: "Fetching …" },
  "pf.prepare": { nb: "Forbered nedlasting", en: "Prepare download" },
  "pf.downloadjson": { nb: "Last ned JSON", en: "Download JSON" },
  "pf.footer": { nb: "HelloSky — norsk reisebyrå med kundeservice alle dager 06–24.", en: "HelloSky — Norwegian travel agency with customer service every day 06–24." },
  // ── Checkout: bagasje + betaling ───────────────────────────────────────
  "ex.included": { nb: "{count} innsjekket kolli per reisende er inkludert i billetten.", en: "{count} checked bag(s) per traveller are included in the ticket." },
  "ex.handonly": { nb: "Billetten inkluderer kun håndbagasje.", en: "The ticket includes hand baggage only." },
  "ex.bagsunknown": { nb: "Flyselskapet har ikke oppgitt bagasjereglene for denne billetten. Vi bekrefter dem for deg før avreise.", en: "The airline has not stated the baggage rules for this ticket. We will confirm them for you before departure." },
  "ex.unavailable": { nb: "Ekstra bagasje kan ikke legges til på denne billetten her. Du kan som regel kjøpe det hos flyselskapet etter bestilling.", en: "Extra baggage cannot be added to this ticket here. You can usually buy it from the airline after booking." },
  "ex.title": { nb: "Ekstra innsjekket bagasje", en: "Extra checked baggage" },
  "ex.perbag": { nb: "{price} per kolli for hele reisen", en: "{price} per bag for the whole trip" },
  "ex.priceatpay": { nb: "Pris bekreftes ved betaling", en: "Price confirmed at payment" },
  "ex.maxper": { nb: "maks {count} ekstra per reisende", en: "max {count} extra per traveller" },
  "ex.group": { nb: "Ekstra kolli for {name}", en: "Extra bags for {name}" },
  "ex.fewer": { nb: "Færre kolli for {name}", en: "Fewer bags for {name}" },
  "ex.more": { nb: "Flere kolli for {name}", en: "More bags for {name}" },
  "pay.sub": { nb: "Velg hvordan du vil betale. Prisen er den samme uansett.", en: "Choose how you want to pay. The price is the same either way." },
  "pay.method": { nb: "Betalingsmåte", en: "Payment method" },
  "pay.card": { nb: "Bankkort", en: "Card" },
  "pay.card.sub": { nb: "Visa, Mastercard eller Apple/Google Pay", en: "Visa, Mastercard or Apple/Google Pay" },
  "pay.klarna.sub": { nb: "Betal med Klarna. Klarnas vilkår gjelder.", en: "Pay with Klarna. Klarna's terms apply." },
  "pay.how": { nb: "Slik fungerer betalingen", en: "How the payment works" },
  "pay.how.1": { nb: "Kortet ditt reserveres nå og belastes først når flyselskapet har bekreftet billetten. Får vi ikke bekreftelse, frigis reservasjonen automatisk.", en: "Your card is reserved now and charged only once the airline has confirmed the ticket. If we do not get confirmation, the reservation is released automatically." },
  "pay.how.2": { nb: "Kortopplysningene sendes direkte til betalingsleverandøren (Stripe) og lagres aldri hos HelloSky.", en: "Card details go directly to the payment provider (Stripe) and are never stored by HelloSky." },
  // ── Ordredetaljer (bekreftelse + Min reise) ────────────────────────────
  "od.operatedby": { nb: "Operert av {name}", en: "Operated by {name}" },
  "od.eticketpending": { nb: "E-billett utstedes", en: "E-ticket being issued" },
  "od.schedule.title": { nb: "Flyselskapet har endret ruten", en: "The airline has changed the schedule" },
  "od.schedule.body": { nb: "Sjekk de nye tidene under. Vi kontakter deg hvis du må godkjenne endringen eller har rett på refusjon.", en: "Check the new times below. We contact you if you need to approve the change or are entitled to a refund." },
  "od.schedule.old": { nb: "Tidligere", en: "Previously" },
  "od.schedule.new": { nb: "Ny plan ({date})", en: "New plan ({date})" },
  "od.refund.case": { nb: "Refusjonssak {ref}", en: "Refund case {ref}" },
  "od.refund.toyou": { nb: "{amount} til deg", en: "{amount} to you" },
  "od.refund.split": { nb: "Flyselskapet refunderer {supplier} · servicegebyr refundert {fee}", en: "The airline refunds {supplier} · service fee refunded {fee}" },
  "od.refund.payout": { nb: "Utbetaling til kortet tar normalt 5–10 virkedager etter at refusjonen er opprettet.", en: "Payout to the card normally takes 5–10 business days after the refund is created." },
  "od.cancel.done": { nb: "Reisen er avbestilt", en: "The trip has been cancelled" },
  "od.cancel.donebody": { nb: "Refusjonssak {ref} er opprettet. Du får e-post når pengene er på vei — status ser du under «Refusjon» på denne siden.", en: "Refund case {ref} has been created. You get an e-mail when the money is on its way — see the status under “Refund” on this page." },
  "od.cancel.openrefund": { nb: "Det finnes allerede en åpen refusjonssak for denne bestillingen.", en: "There is already an open refund case for this booking." },
  "od.cancel.nothere": { nb: "Denne bestillingen kan ikke avbestilles her.", en: "This booking cannot be cancelled here." },
  "od.cancel.help": { nb: "hvis du trenger hjelp.", en: "if you need help." },
  "od.cancel.see": { nb: "Se hva du får tilbake", en: "See what you get back" },
  "od.cancel.title": { nb: "Avbestille reisen?", en: "Cancel the trip?" },
  "od.cancel.fetching": { nb: "Henter refusjonsbeløp fra flyselskapet …", en: "Fetching refund amount from the airline …" },
  "od.cancel.supplier": { nb: "Flyselskapet refunderer", en: "The airline refunds" },
  "od.cancel.fee": { nb: "Servicegebyr refundert", en: "Service fee refunded" },
  "od.cancel.total": { nb: "Du får tilbake", en: "You get back" },
  "od.cancel.expired": { nb: "Tilbudet om refusjon er utløpt — hent på nytt.", en: "The refund offer has expired — fetch again." },
  "od.cancel.validuntil": { nb: "Beløpet gjelder til {date}.", en: "The amount is valid until {date}." },
  "od.cancel.noundo": { nb: "Avbestillingen kan ikke angres. Pengene går tilbake til betalingskortet.", en: "The cancellation cannot be undone. The money goes back to the payment card." },
  "od.cancel.keep": { nb: "Behold reisen", en: "Keep the trip" },
  "od.cancel.refetch": { nb: "Hent på nytt", en: "Fetch again" },
  "od.cancel.confirm": { nb: "Bekreft kansellering", en: "Confirm cancellation" },
  "od.calendar": { nb: "Legg til i kalender", en: "Add to calendar" },
  "od.receipt": { nb: "Last ned kvittering", en: "Download receipt" },
  "od.resend.done": { nb: "Bekreftelse sendt", en: "Confirmation sent" },
  "od.resend": { nb: "Send bekreftelse på nytt", en: "Resend confirmation" },
  // ── Tilbudskort ────────────────────────────────────────────────────────
  "oc.direct": { nb: "Direkte", en: "Direct", sv: "Direkt", da: "Direkte", de: "Direkt" },
  "oc.stops": { nb: "{count} stopp", en: "{count} stop(s)" },
  "oc.nextday": { nb: "(neste dag)", en: "(next day)" },
  "oc.arrivalnextday": { nb: "Ankomst neste dag", en: "Arrives next day" },
  "oc.arrival.next": { nb: "ankomst neste dag", en: "arrives next day" },
  "oc.arrival.days": { nb: "ankomst {count} dager senere", en: "arrives {count} days later" },
  "oc.carryon": { nb: "Håndbagasje {count}", en: "Cabin bag {count}" },
  "oc.checked": { nb: "Innsjekket {count}", en: "Checked {count}" },
  "oc.checked.none": { nb: "Innsjekket ikke inkludert", en: "Checked bag not included" },
  "oc.carryon.unknown": { nb: "Håndbagasje ikke oppgitt", en: "Cabin bag not stated" },
  "oc.checked.unknown": { nb: "Innsjekket ikke oppgitt", en: "Checked bag not stated" },
  "oc.layover": { nb: "Mellomlanding i {city} · {duration}", en: "Layover in {city} · {duration}" },
  "oc.layover.overnight": { nb: " · over natten", en: " · overnight" },
  "oc.layover.long": { nb: " · lang ventetid", en: " · long wait" },
  "oc.overnight": { nb: "Mellomlanding over natten", en: "Overnight layover" },
  "oc.longlayover": { nb: "Lang mellomlanding", en: "Long layover" },
  "oc.co2": { nb: "Estimert CO₂-utslipp", en: "Estimated CO₂ emissions" },
  "oc.hide": { nb: "Skjul detaljer", en: "Hide details" },
  "oc.show": { nb: "Se flydetaljer og vilkår", en: "See flight details and conditions" },
  "oc.conditions": { nb: "Billettvilkår", en: "Fare conditions" },
  "oc.conditions.note": { nb: "Gebyrer og eventuell prisdifferanse fastsettes av flyselskapet.", en: "Fees and any fare difference are set by the airline." },
  "oc.totalfor": { nb: "totalt for {count} reisende", en: "total for {count} traveller(s)" },
  "oc.approx": { nb: "ca. inkl. servicegebyr og skatter", en: "approx. incl. service fee and taxes" },
  "oc.supplierprice": { nb: "Flyselskapets pris {price}", en: "Airline price {price}" },
  "oc.forpax": { nb: "for {count} reisende", en: "for {count} travellers" },
  "oc.selected": { nb: "Valgt", en: "Selected" },
  "oc.compare": { nb: "Sammenlign", en: "Compare" },
  "oc.share": { nb: "Del tilbudet på WhatsApp", en: "Share the offer on WhatsApp" },
  "oc.share.short": { nb: "Del", en: "Share" },
  "oc.select": { nb: "Velg", en: "Select", sv: "Välj", da: "Vælg", de: "Wählen" },
  "oc.aria": { nb: "{airline}, {price} totalt", en: "{airline}, {price} total" },
  // ── Prioritet (søk + sortering) ─────────────────────────────────────────
  "pref.title": { nb: "Hva er viktigst for deg?", en: "What matters most to you?" },
  "pref.best": { nb: "Best totalt", en: "Best overall", sv: "Bäst totalt", da: "Bedst samlet", de: "Beste Gesamtwahl" },
  "pref.best.hint": { nb: "Balanse mellom pris, reisetid og stopp", en: "Balance of price, travel time and stops" },
  "pref.cheapest": { nb: "Billigst", en: "Cheapest", sv: "Billigast", da: "Billigst", de: "Günstigste" },
  "pref.cheapest.hint": { nb: "Laveste totalpris", en: "Lowest total price" },
  "pref.fastest": { nb: "Raskest", en: "Fastest", sv: "Snabbast", da: "Hurtigst", de: "Schnellste" },
  "pref.fastest.hint": { nb: "Kortest samlet reisetid", en: "Shortest total travel time" },
  "pref.baggage": { nb: "Ekstra bagasje", en: "Extra baggage", sv: "Extra bagage", da: "Ekstra bagage", de: "Extra Gepäck" },
  "pref.baggage.hint": { nb: "Billetter med innsjekket bagasje først", en: "Tickets with checked baggage first" },
  "pref.family": { nb: "Familievennlig", en: "Family friendly", sv: "Familjevänligt", da: "Familievenligt", de: "Familienfreundlich" },
  "pref.family.hint": { nb: "Få stopp, korte mellomlandinger og bagasje", en: "Few stops, short layovers and baggage" },
  "pref.short_layovers": { nb: "Korte mellomlandinger", en: "Short layovers", sv: "Korta byten", da: "Korte mellemlandinger", de: "Kurze Umstiege" },
  "pref.short_layovers.hint": { nb: "Minst ventetid mellom fly", en: "Least waiting between flights" },
  "pref.flexible": { nb: "Fleksibel billett", en: "Flexible ticket", sv: "Flexibel biljett", da: "Fleksibel billet", de: "Flexibles Ticket" },
  "pref.flexible.hint": { nb: "Kan refunderes eller endres", en: "Refundable or changeable" },
  "pref.fewer_stops": { nb: "Færre stopp", en: "Fewer stops", sv: "Färre stopp", da: "Færre stop", de: "Weniger Stopps" },
  "pref.fewer_stops.hint": { nb: "Direkte først, deretter korte mellomlandinger", en: "Direct first, then short layovers" },
  // ── Søkeskjema ──────────────────────────────────────────────────────────
  "sw.aria": { nb: "Søk etter flyreiser", en: "Search for flights" },
  "sw.triptype": { nb: "Reisetype", en: "Trip type" },
  "sw.roundtrip": { nb: "Tur/retur", en: "Round trip", sv: "Tur och retur", da: "Tur/retur", de: "Hin- und Rückflug" },
  "sw.oneway": { nb: "Én vei", en: "One way", sv: "Enkel", da: "Enkelt", de: "Nur Hinflug" },
  "sw.multicity": { nb: "Flere byer", en: "Multi-city", sv: "Flera städer", da: "Flere byer", de: "Mehrere Ziele" },
  "sw.leg": { nb: "Strekning {n}", en: "Leg {n}" },
  "sw.addleg": { nb: "Legg til strekning", en: "Add leg" },
  "sw.removeleg": { nb: "Fjern strekning {n}", en: "Remove leg {n}" },
  "sw.swap": { nb: "Bytt om avreise og destinasjon", en: "Swap origin and destination" },
  "sw.date": { nb: "Dato", en: "Date" },
  "sw.dates": { nb: "Datoer", en: "Dates" },
  "sw.pickdate": { nb: "Velg dato", en: "Choose date" },
  "sw.pickdates": { nb: "Velg utreise og hjemreise", en: "Choose departure and return" },
  "sw.pickairport": { nb: "Velg flyplass", en: "Choose airport" },
  "sw.searchairport": { nb: "Søk by eller flyplass …", en: "Search city or airport …" },
  "sw.popular": { nb: "Populære", en: "Popular" },
  "sw.nohits": { nb: "Ingen treff på «{q}»", en: "No matches for “{q}”" },
  "sw.pax.title": { nb: "Reisende og klasse", en: "Travellers and class" },
  "sw.cabin": { nb: "Kabinklasse", en: "Cabin class" },
  "sw.done": { nb: "Ferdig", en: "Done", sv: "Klar", da: "Færdig", de: "Fertig" },
  "sw.adult.hint": { nb: "12 år eller eldre", en: "12 years or older" },
  "sw.child.hint": { nb: "2–11 år", en: "2–11 years" },
  "sw.infant.hint": { nb: "Under 2 år, på fanget", en: "Under 2, on a lap" },
  "sw.age.child": { nb: "Alder barn {n}", en: "Age of child {n}" },
  "sw.age.infant": { nb: "Alder baby {n}", en: "Age of infant {n}" },
  "sw.years": { nb: "{count} år", en: "{count} yrs" },
  "sw.fewer": { nb: "Færre {type}", en: "Fewer {type}" },
  "sw.more": { nb: "Flere {type}", en: "More {type}" },
  "sw.family.note": { nb: "Barn og babyer prises etter alder. Du ser totalprisen for hele reisefølget i resultatet.", en: "Children and infants are priced by age. You see the total for the whole party in the results." },
  "sw.submit": { nb: "Søk flyreiser", en: "Search flights", sv: "Sök flyg", da: "Søg fly", de: "Flüge suchen" },
  "sw.err.legs": { nb: "Fyll inn flyplasser og dato for alle strekningene.", en: "Fill in airports and a date for every leg." },
  "sw.err.same": { nb: "Avreise og destinasjon kan ikke være samme flyplass.", en: "Origin and destination cannot be the same airport." },
  "sw.err.dates.round": { nb: "Velg både utreise og hjemreise.", en: "Choose both departure and return dates." },
  "sw.err.dates.one": { nb: "Velg en utreisedato.", en: "Choose a departure date." },
  "sw.err.where": { nb: "Velg hvor du reiser fra og hvor du skal.", en: "Choose where you travel from and where you are going." },
  // ── Resultater: familie, filtre ─────────────────────────────────────────
  "sr.perperson": { nb: "ca. {price} per person", en: "approx. {price} per person" },
  "sr.family.hint": { nb: "Totalpris for {count} reisende. Barn og babyer er priset etter alder.", en: "Total for {count} travellers. Children and infants are priced by age." },
  "sr.filter.show_one": { nb: "Vis {count} alternativ", en: "Show {count} option" },
  "sr.filter.show_other": { nb: "Vis {count} alternativer", en: "Show {count} options" },
  "sr.sorted.by": { nb: "Sortert etter", en: "Sorted by" },
  "sr.summary.aria": { nb: "Vis {label}: {price}", en: "Show {label}: {price}" },
  "oc.tag.bags": { nb: "Bagasje inkludert", en: "Baggage included" },
  "oc.tag.refundable": { nb: "Refunderbar", en: "Refundable" },
  "oc.tag.changeable": { nb: "Kan endres", en: "Changeable" },
  "oc.tag.family": { nb: "Passer familier", en: "Good for families" },
  "oc.details": { nb: "Detaljer", en: "Details" },
  // ── Rutediagram, tidslinje, bagasje ──────────────────────────────────────
  "rt.depart": { nb: "Avgang", en: "Departure" },
  "rt.arrive": { nb: "Ankomst", en: "Arrival" },
  "rt.airportchange": { nb: "Bytte av flyplass", en: "Airport change" },
  "rt.airportchange.body": { nb: "Du må selv reise mellom flyplassene og sjekke inn på nytt. Bagasjen følger ikke automatisk.", en: "You travel between the airports yourself and check in again. Bags are not transferred automatically." },
  "rt.transferwindow": { nb: "{duration} til overgang", en: "{duration} to transfer" },
  "tl.aria": { nb: "Status for bestillingen", en: "Booking status" },
  "tl.booked": { nb: "Bestilt", en: "Booked" },
  "tl.payment": { nb: "Betaling bekreftet", en: "Payment confirmed" },
  "tl.ticket": { nb: "Billett utstedt", en: "Ticket issued" },
  "tl.checkin": { nb: "Innsjekking", en: "Check-in" },
  "tl.departure": { nb: "Avreise", en: "Departure" },
  "tl.cancelled": { nb: "Kansellert", en: "Cancelled" },
  "tl.refunded": { nb: "Refusjon", en: "Refund" },
  "tl.failed": { nb: "Feilet", en: "Failed" },
  "tl.changed": { nb: "Endring", en: "Change" },
  "bg.carryon_one": { nb: "{count} håndbagasje per reisende", en: "{count} cabin bag per traveller" },
  "bg.carryon_other": { nb: "{count} håndbagasje per reisende", en: "{count} cabin bags per traveller" },
  "bg.checked_one": { nb: "{count} innsjekket kolli per reisende", en: "{count} checked bag per traveller" },
  "bg.checked_other": { nb: "{count} innsjekket kolli per reisende", en: "{count} checked bags per traveller" },
  "bg.checked.none": { nb: "Innsjekket bagasje ikke inkludert", en: "Checked baggage not included" },
  "bg.carryon.unknown": { nb: "Flyselskapet har ikke oppgitt håndbagasje for denne billetten", en: "The airline has not stated cabin baggage for this ticket" },
  "bg.checked.unknown": { nb: "Flyselskapet har ikke oppgitt innsjekket bagasje for denne billetten", en: "The airline has not stated checked baggage for this ticket" },
  "bg.family": { nb: "{bags} kolli inkludert for {count} reisende", en: "{bags} bags included for {count} travellers" },
  "es.noflights": { nb: "Ingen fly funnet", en: "No flights found" },
  "es.expired": { nb: "Søket er utløpt", en: "The search has expired" },
  "es.payment": { nb: "Betalingen gikk ikke gjennom", en: "The payment did not go through" },
  "es.connection": { nb: "Vi fikk ikke kontakt", en: "We could not connect" },
  "es.notrips": { nb: "Ingen reiser ennå", en: "No trips yet" },
  "es.nohotels": { nb: "Ingen overnatting funnet", en: "No stays found" },
} satisfies Record<string, Entry>;

export type I18nKey = keyof typeof dict;

/** Nøkler uten `_one`/`_other`-suffiks som kan brukes med `{count}`. */
type PluralBase<K extends string> = K extends `${infer B}_one` ? B : never;
type PluralKey = PluralBase<I18nKey>;

export type TParams = { count?: number } & Record<string, string | number | undefined>;

function lookup(key: string, lang: Lang): string | undefined {
  const entry = (dict as Record<string, Entry | undefined>)[key];
  if (!entry) return undefined;
  return entry[lang] ?? entry.en ?? entry.nb;
}

function interpolate(text: string, params?: TParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Ren oversettelsesfunksjon. */
function translate(lang: Lang, key: I18nKey | PluralKey, params?: TParams): string {
  if (params && typeof params.count === "number") {
    const rules = new Intl.PluralRules(LOCALE_OF[lang]);
    const cat = rules.select(params.count);
    const text =
      lookup(`${key}_${cat}`, lang) ??
      lookup(`${key}_other`, lang) ??
      lookup(key, lang);
    return interpolate(text ?? key, params);
  }
  return interpolate(lookup(key, lang) ?? key, params);
}

// ─── Context ───────────────────────────────────────────────────────────────

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
};

const LangContext = createContext<LangContextValue>({
  lang: "nb",
  setLang: () => {},
  currency: "NOK",
  setCurrency: () => {},
});

const LANG_KEY = "hellosky:lang";
const CURRENCY_KEY = "hellosky:currency";

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
  } catch {
    /* localStorage utilgjengelig */
  }
  return "nb";
}

function readCurrency(): Currency | null {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored && (CURRENCIES as readonly string[]).includes(stored)) return stored as Currency;
  } catch {
    /* localStorage utilgjengelig */
  }
  return null;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const [currencyOverride, setCurrencyState] = useState<Currency | null>(readCurrency);

  // Innlogget kunde: kontoens preferanser vinner første gang (kun hvis ingen lokal overstyring).
  const me = trpc.customerAuth.me.useQuery(undefined, { staleTime: 60_000, retry: false });
  const updatePrefs = trpc.customerAuth.updatePreferences.useMutation();

  useEffect(() => {
    if (!me.data) return;
    try {
      if (!localStorage.getItem(LANG_KEY) && (LANGS as readonly string[]).includes(me.data.locale)) {
        setLangState(me.data.locale as Lang);
      }
    } catch {
      /* ignorer */
    }
  }, [me.data]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      // Synkront før neste render, slik at format.ts (leser <html lang>) er i takt.
      document.documentElement.lang = l;
      setLangState(l);
      try {
        localStorage.setItem(LANG_KEY, l);
      } catch {
        /* ignorer */
      }
      if (me.data) updatePrefs.mutate({ locale: l });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me.data],
  );

  const setCurrency = useCallback(
    (c: Currency) => {
      setCurrencyState(c);
      try {
        localStorage.setItem(CURRENCY_KEY, c);
      } catch {
        /* ignorer */
      }
      if (me.data) updatePrefs.mutate({ currency: c });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me.data],
  );

  const accountCurrency = me.data?.currency;
  const currency: Currency = useMemo(() => {
    if (currencyOverride) return currencyOverride;
    if (accountCurrency && (CURRENCIES as readonly string[]).includes(accountCurrency)) return accountCurrency as Currency;
    return DEFAULT_CURRENCY_OF[lang];
  }, [currencyOverride, accountCurrency, lang]);

  const value = useMemo(() => ({ lang, setLang, currency, setCurrency }), [lang, setLang, currency, setCurrency]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang };
}

/**
 * `{ lang, locale, currency, setCurrency }` — locale er BCP-47 (nb-NO, en-GB, sv-SE, da-DK, de-DE).
 * `currency` er KUN en visningspreferanse (etikett i profil/innstillinger).
 * Priser vises alltid i tilbudets/ordrens egen valuta — vi konverterer aldri.
 */
export function useLocale() {
  const { lang, currency, setCurrency } = useContext(LangContext);
  return { lang, locale: LOCALE_OF[lang], currency, setCurrency };
}

/**
 * Oversett nøkkel til aktivt språk.
 *   t("nav.home")                       – enkel
 *   t("saved.count", { count: 2 })      – flertall via `_one`/`_other`
 *   t("greet.name", { name: "Ada" })    – interpolasjon
 */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((key: I18nKey | PluralKey, params?: TParams) => translate(lang, key, params), [lang]);
}

// ─── Formatering ───────────────────────────────────────────────────────────
// All tall-/dato-formatering ligger i src/lib/format.ts og leser aktivt språk
// fra `<html lang>` (settes av LangProvider). Ingen duplikater her.
