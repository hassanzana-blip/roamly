/** Velkomsten ved første oppstart (components/WelcomeGate.tsx). Knappene for Google og Apple står i `account`. */
const en = {
  skip: "Skip",
  skipHint: "Continues without an account. You can log in later in Profile.",
  /** Overskriften på fotoet: det HelloSky faktisk gjør. */
  title: "Compare flight prices from airlines and travel agencies – in Norwegian kroner.",
  email: "Continue with e-mail",
  noAccountNeeded: "You can search without an account.",
};

const nb: typeof en = {
  skip: "Hopp over",
  skipHint: "Går videre uten konto. Du kan logge inn senere i Profil.",
  title: "Sammenlign flypriser fra flyselskaper og reisebyråer – i norske kroner.",
  email: "Fortsett med e-post",
  noAccountNeeded: "Du kan søke uten konto.",
};

export const welcome = { en, nb };
