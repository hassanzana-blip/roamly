/**
 * En lesbar beskrivelse av en nettleser.
 *
 * Vi lagrer user agent-strengen som den kom, men den er ikke noe å vise en
 * kollega som skal svare på «er dette meg?». Dette er bevisst grovt: nettleser
 * og system er nok til å kjenne igjen sin egen maskin, og vi later ikke som vi
 * vet mer enn det.
 */
const BROWSERS: [RegExp, string][] = [
  [/\bEdg\//, "Edge"],
  [/\bOPR\//, "Opera"],
  [/\bChrome\//, "Chrome"],
  [/\bFirefox\//, "Firefox"],
  [/\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

export function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "Ukjent nettleser";
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
  if (browser && system) return `${browser} på ${system}`;
  return browser ?? system ?? "Ukjent nettleser";
}
