import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Native <select> keeps the platform picker (right for long lists) but gets a visible affordance. */
export default function SelectWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
