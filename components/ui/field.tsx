import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, control, and the one line of help or error under it.
 *
 * The stacking was already consistent by hand across the app; what was missing
 * every time was `aria-describedby`. Help text sat next to a control visually
 * and was invisible to a screen reader, so the field read as a bare label. That
 * is the whole reason this exists - `describedBy` below returns the id to hand
 * back to the control, and `fieldDescriptionId` derives it without a hook so
 * this works unchanged in a Server Component.
 *
 * Error *replaces* help rather than stacking under it: two lines where one
 * contradicts the other is worse than either alone. The error also carries
 * `role="alert"` so it is announced when it appears, and it is real text - a
 * red border alone says nothing to a colourblind reader and nothing at all to a
 * screen reader.
 *
 *   const help = fieldDescriptionId("video_url");
 *   <Field htmlFor="video_url" label="Video link" error={urlInvalid && "..."}
 *          help="Loom and Streamable play inside the card.">
 *     <Input id="video_url" aria-describedby={help} aria-invalid={urlInvalid} />
 *   </Field>
 */
export function fieldDescriptionId(id: string): string {
  return `${id}-description`;
}

export function Field({
  htmlFor,
  label,
  help,
  error,
  required = false,
  className,
  children,
}: {
  htmlFor: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  /** Falsy renders the help line instead. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const descriptionId = fieldDescriptionId(htmlFor);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {/* The asterisk is decoration; the word is what a screen reader gets.
            Marking the glyph aria-hidden without the sr-only text beside it
            leaves the requirement visible and unannounced. */}
        {required && (
          <>
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </Label>
      {children}
      {error ? (
        <p id={descriptionId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
