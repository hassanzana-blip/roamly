import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  /** Popover width class on desktop */
  popoverClassName?: string;
  /** Show a "Done" button (mobile sheet footer + desktop popover footer) */
  doneLabel?: string;
  align?: "start" | "end" | "center";
}

/**
 * Renders a picker as a bottom sheet on phones and a popover on larger
 * screens. Same children, same state, right container for the device.
 */
export default function PickerSurface({ open, onOpenChange, trigger, title, children, popoverClassName, doneLabel, align = "start" }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <SheetBody>{children}</SheetBody>
          {doneLabel && (
            <SheetFooter>
              <Button size="lg" onClick={() => onOpenChange(false)}>
                {doneLabel}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className={cn("rounded-xl border-border p-0 shadow-lift", popoverClassName)}>
        <p className="sr-only">{title}</p>
        {children}
        {doneLabel && (
          <div className="flex justify-end border-t border-border p-2">
            <Button size="sm" onClick={() => onOpenChange(false)}>
              {doneLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
