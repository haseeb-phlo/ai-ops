import { format } from "date-fns";

// Renders an absolute date in the chosen short format with the full ISO
// timestamp on hover so users can always recover the exact moment without
// us spending pixel budget on it.
export function Time({
  iso,
  pattern = "d MMM yyyy",
  className,
}: {
  iso: string;
  pattern?: string;
  className?: string;
}) {
  const date = new Date(iso);
  return (
    <time
      dateTime={iso}
      title={date.toLocaleString()}
      className={className}
    >
      {format(date, pattern)}
    </time>
  );
}
