import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { currentLang } from "@/lib/format";

/**
 * Calendar: 40 px day cells (touch friendly), localised month names,
 * primary-coloured selection and quiet range shading. Tailwind 3 syntax only.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  captionLayout = "label",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();
  const locale = currentLang() === "nb" ? "nb-NO" : currentLang();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar bg-transparent p-1", className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale, { month: "long" }),
        formatCaption: (date) => {
          const s = date.toLocaleString(locale, { month: "long", year: "numeric" });
          return s.charAt(0).toUpperCase() + s.slice(1);
        },
        formatWeekdayName: (date) => date.toLocaleString(locale, { weekday: "short" }).replace(".", "").slice(0, 2),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-6 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-10 select-none p-0 aria-disabled:opacity-40", defaultClassNames.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-10 select-none p-0 aria-disabled:opacity-40", defaultClassNames.button_next),
        month_caption: cn("flex h-10 w-full items-center justify-center px-10", defaultClassNames.month_caption),
        dropdowns: cn("flex h-10 w-full items-center justify-center gap-1.5 text-sm font-medium", defaultClassNames.dropdowns),
        dropdown_root: cn("relative rounded-md border border-input has-[:focus]:border-primary has-[:focus]:ring-2 has-[:focus]:ring-primary/25", defaultClassNames.dropdown_root),
        dropdown: cn("absolute inset-0 bg-popover opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-semibold",
          captionLayout === "label" ? "text-sm" : "flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("flex-1 select-none text-center text-xs font-medium uppercase tracking-wide text-muted-foreground", defaultClassNames.weekday),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-10 select-none", defaultClassNames.week_number_header),
        week_number: cn("select-none text-xs text-muted-foreground", defaultClassNames.week_number),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("rounded-l-md bg-primary-soft", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-primary-soft", defaultClassNames.range_end),
        today: cn("rounded-md font-semibold text-primary data-[selected=true]:rounded-none", defaultClassNames.today),
        outside: cn("text-muted-foreground/50 aria-selected:text-muted-foreground", defaultClassNames.outside),
        disabled: cn("text-muted-foreground/40 line-through", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />,
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          if (orientation === "right") return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-10 items-center justify-center text-center">{children}</div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-10 w-full min-w-10 items-center justify-center rounded-md text-sm font-normal text-foreground outline-none tabular",
        "transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:font-semibold data-[selected-single=true]:text-primary-foreground",
        "data-[range-start=true]:rounded-md data-[range-start=true]:bg-primary data-[range-start=true]:font-semibold data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:rounded-md data-[range-end=true]:bg-primary data-[range-end=true]:font-semibold data-[range-end=true]:text-primary-foreground",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-primary-soft data-[range-middle=true]:text-accent-foreground",
        "disabled:pointer-events-none",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
