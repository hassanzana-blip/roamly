import { Link } from "react-router";
import { ArrowRight, CreditCard, Facebook, Heart, LifeBuoy, Search } from "lucide-react";
import ContentPage, { Section } from "./ContentPage";
import { COMPANY } from "./company";
import Icon from "@/components/app/Icon";
import { FACEBOOK_LINK } from "@/components/layout/SiteFooter";
import { PAGE_META, usePageMeta } from "@/lib/seo";

export default function About() {
  usePageMeta({
    ...PAGE_META.about,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "Om HelloSky",
      mainEntity: {
        "@type": "TravelAgency",
        name: COMPANY.legalName,
        email: COMPANY.supportEmail,
        telephone: COMPANY.supportPhoneTel,
        address: COMPANY.address,
        areaServed: "NO",
      },
    },
  });

  return (
    <ContentPage
      eyebrow="Om HelloSky"
      title="Et norsk reisebyrå for hele verden"
      intro="HelloSky er et norsk reisebyrå. Vi hjelper deg med å finne reisen dit du skal – strandferie, storbyhelg, langtur eller cruise – med ekte mennesker på andre siden av telefonen."
    >
      <Section title="Hvem vi er">
        <p>
          HelloSky ble startet av folk som har reist mye, og som har brukt for mange kvelder på å lete etter
          den riktige billetten. Vi selger hele verden fra Norge – fra Kanariøyenes vintersol og Hellas' øyer
          til storbyhelger og langturer. Noen ruter kjenner vi spesielt godt, fordi vi har reist dem selv.
          Den kunnskapen får du med deg uansett hvor du skal.
        </p>
      </Section>

      <div className="grid gap-3 py-7 sm:grid-cols-3">
        {[
          { icon: Search, title: "Hele markedet", sub: "Vi søker på tvers av flyselskapene for deg" },
          { icon: LifeBuoy, title: "06–24 alle dager", sub: "Ekte kundeservice, også ved avreise" },
          { icon: Heart, title: "Personlig hjelp", sub: "Vi kjenner rutene vi selger" },
        ].map((c) => (
          <div key={c.title} className="rounded-lg border border-border bg-card p-5 shadow-soft">
            <Icon icon={c.icon} size={20} className="text-foreground" />
            <p className="mt-3 font-display text-[16px]">{c.title}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <Section title="Ærlig pris, ingen overraskelser">
        <p>
          Prisen du ser er alltid totalprisen. Vårt servicegebyr – {COMPANY.serviceFeePercent} % av
          flyselskapets pris pluss {COMPANY.serviceFeeFlatNok} kr per bestilling – vises som egen linje før du
          betaler. Betalingen går trygt gjennom Stripe, med bankkort eller Klarna. Vi lagrer aldri kortopplysninger.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-semibold">
            <Icon icon={CreditCard} size={14} /> Kort
          </span>
          <img src="/brand/klarna.jpg" alt="Klarna" className="h-8 rounded-md" width="80" height="32" />
          <span className="rounded-md bg-night px-2.5 py-1 text-[12px] font-semibold text-white">Stripe</span>
        </div>
      </Section>

      <Section title="Følg oss">
        <p>Reisetips, gode priser og nyheter fra HelloSky – følg oss gjerne på Facebook.</p>
        <a
          href={FACEBOOK_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-night px-5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
        >
          <Icon icon={Facebook} size={16} /> HelloSky på Facebook
        </a>
      </Section>

      <Section title="Kontakt oss">
        <p>
          Ring {COMPANY.supportPhone} ({COMPANY.openingHours}), send e-post til {COMPANY.supportEmail}, eller
          skriv til oss på WhatsApp – vi svarer raskt.
        </p>
        <p className="text-[13px]">
          {COMPANY.identityLine}
        </p>
        <Link
          to="/hjelp"
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
        >
          Til hjelpesiden <Icon icon={ArrowRight} size={14} />
        </Link>
      </Section>
    </ContentPage>
  );
}
