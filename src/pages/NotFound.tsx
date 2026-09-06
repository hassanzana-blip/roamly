import { Link } from "react-router";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="aurora-band grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <Compass className="mx-auto h-12 w-12 text-gold" strokeWidth={1.5} />
        <h1 className="mt-6 font-display text-6xl">404</h1>
        <p className="mt-2 font-display text-2xl">Denne ruten finnes ikke</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          Siden du leter etter har fløyet sin egen vei. La oss finne en bedre destinasjon.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground"
        >
          Tilbake til søk
        </Link>
      </div>
    </div>
  );
}
