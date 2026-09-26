import type { NativeSocialSignIn } from "./socialAuth";

/**
 * Sosial innlogging utenfor iPhone-appen (nettleser-forhåndsvisning, Android):
 * INGEN. Clerk lastes ikke her, og Profil viser aldri Google/Apple.
 * iPhone bruker lib/nativeSocial.ios.tsx.
 *
 * Filen MÅ hete .tsx som iOS-filen: Metro prøver filendelse for filendelse
 * (.ios.ts, .native.ts, .ts, så .tsx-variantene), så en nativeSocial.ts ville
 * vunnet over nativeSocial.ios.tsx i iOS-bunten.
 */
export const nativeSocialSignIn: NativeSocialSignIn = {
  supports: () => false,
  signIn: async () => {
    throw new Error("native social sign-in is not available on this platform");
  },
};
