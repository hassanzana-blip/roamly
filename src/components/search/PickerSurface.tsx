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
  /**
   * `sheet` (default): a bottom sheet with the standard header. `fullscreen`:
   * the panel fills the screen and draws its own header and footer – the
   * destination picker. Desktop is always a popover.
   */
  mobile?: "sheet" | "fullscreen";
}

/**
 * Renders a picker as a bottom sheet (or a full-screen panel) on phones and
 * a popover on larger screens. Same children, same state, right container
 * for the device. Escape and the overlay close it; focus returns to the
 * trigger (Radix Dialog).
 */
export default function PickerSurface({ open, onOpenChange, trigger, title, children, popoverClassName, doneLabel, align = "start", mobile = "sheet" }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    if (mobile === "fullscreen") {
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" hideClose className="h-[100dvh] max-h-[100dvh] max-w-none rounded-t-[20px] bg-white pt-0 [&>div:first-child]:absolute [&>div:first-child]:inset-x-0 [&>div:first-child]:top-0 [&>div:first-child]:z-10">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            {children}
          </SheetContent>
        </Sheet>
      );
    }
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-[20px]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <SheetBody>{children}</SheetBody>
          {doneLabel && (
            <SheetFooter>
              <Button size="lg" className="h-[52px] rounded-xl text-[17px]" onClick={() => onOpenChange(false)}>
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
      <PopoverContent align={align} sideOffset={8} className={cn("rounded-2xl border-border p-0 shadow-lift", popoverClassName)}>
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
