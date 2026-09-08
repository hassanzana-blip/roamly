/**
 * De som driver HelloSky.
 *
 * Ett register, brukt av kundeservice, «Om oss», adminskallet og chatten.
 * Bildene er ekte fotografier av ekte mennesker – aldri generert, aldri
 * hentet fra et bildebyrå og satt navn på. Mangler bildet, viser
 * grensesnittet initialene; det er ærligere enn en tilfeldig ansiktsfoto.
 */

export type FounderId = "zyar" | "zana";

export type Founder = {
  id: FounderId;
  name: string;
  /** Rollen slik den står i grensesnittet. */
  role: string;
  /** Kort, i førsteperson – brukes i chat og kundeservice. */
  line: string;
  /** Kvadratisk avatar. Bygges av scripts/build-team-avatars.py. */
  avatar: { src: string; srcSet: string };
  /** Hele portrettet, til «Om oss» og kundeservice. */
  portrait: string;
  /** E-postadressen staff-kontoen er knyttet til (aldri vist til kunder). */
  staffEmailEnv: string;
  initials: string;
};

const avatar = (slug: FounderId) => ({
  src: `/team/${slug}-128.jpg`,
  srcSet: `/team/${slug}-64.jpg 64w, /team/${slug}-128.jpg 128w, /team/${slug}-256.jpg 256w`,
});

export const FOUNDERS: Founder[] = [
  {
    id: "zyar",
    name: "Zyar",
    role: "Daglig leder",
    line: "Jeg svarer selv når det haster.",
    avatar: avatar("zyar"),
    portrait: "/team/team-1.jpg",
    staffEmailEnv: "BOOTSTRAP_OWNER_EMAIL",
    initials: "ZY",
  },
  {
    id: "zana",
    name: "Zana",
    role: "Kundeservice",
    line: "Ring heller enn å vente på et skjema.",
    avatar: avatar("zana"),
    portrait: "/team/team-2.jpg",
    staffEmailEnv: "BOOTSTRAP_ADMIN_EMAIL",
    initials: "ZA",
  },
];

export function founderById(id: string): Founder | undefined {
  return FOUNDERS.find((f) => f.id === id);
}

/**
 * Finn grunnleggeren bak et navn fra staff-kontoen.
 *
 * Adminbrukere heter det de heter i databasen; vi kobler på fornavn slik at
 * en konto som heter «Zyar Ahmed» får riktig ansikt uten at e-postadresser
 * eller id-er må hardkodes i frontend.
 */
export function founderForName(name: string | null | undefined): Founder | undefined {
  if (!name) return undefined;
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  return FOUNDERS.find((f) => f.name.toLowerCase() === first);
}
