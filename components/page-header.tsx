import { cn } from "@/lib/utils";

export type SectionAccent = "workflows" | "none";

// Subtle 2px top accent per section. Stays close to the muted base so the
// product still reads as monochrome; the colour exists purely to give the
// eye an orientation cue when moving between sections.
const ACCENT_CLASS: Record<SectionAccent, string> = {
  workflows: "before:bg-slate-400/70",
  none: "before:bg-transparent",
};

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function PageContainer({
  children,
  className,
  accent = "none",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: SectionAccent;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-6xl space-y-6 px-6 py-8",
        accent !== "none" &&
          "before:absolute before:inset-x-0 before:top-0 before:h-[2px]",
        ACCENT_CLASS[accent],
        className,
      )}
    >
      {children}
    </div>
  );
}
