import {
  HsBagChecked,
  HsConfirmation,
  HsFamily,
  HsFlightConnection,
  HsNightFlight,
  HsPassport,
  HsPlaneArrival,
  HsRoute,
  HsSupport,
  HsTrain,
} from "@/components/graphics";
import type { JournalTag } from "@/content/journal";

/**
 * Historietypen bestemmer tegningen på omslaget.
 *
 * Artikler uten et verifisert foto fikk før samme vinge i tre farger, og da
 * så journalen ut som én mal gjentatt tjue ganger. Nå bærer omslaget
 * kategoriens egen glyf fra HelloSky-pakken: bagasjesaker ser ut som
 * bagasje, mellomlanding ser ut som mellomlanding. Ingen glyf er funnet på;
 * alle er de samme vi bruker ellers i produktet.
 */
const STORY_GLYPH = {
  kurdistan: HsRoute,
  midtosten: HsPlaneArrival,
  storby: HsTrain,
  familie: HsFamily,
  bagasje: HsBagChecked,
  mellomlanding: HsFlightConnection,
  billetter: HsConfirmation,
  planlegging: HsPassport,
  "forste-gang": HsSupport,
  helg: HsNightFlight,
} as const satisfies Record<JournalTag, unknown>;

/**
 * Tegningen for en historietype, ferdig gjengitt. Den skaleres til rammen sin
 * og tegnes med tynnere strek enn et ikon, fordi den her er flatens tekstur.
 */
export function StoryDrawing({ tag }: { tag?: JournalTag }) {
  const Drawing = (tag && STORY_GLYPH[tag]) || HsRoute;
  return <Drawing size={0} className="h-full w-full" style={{ strokeWidth: 0.9 }} />;
}
