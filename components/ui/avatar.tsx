"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return letters || "?";
}

/**
 * Avatar image with an initials fallback so the UI degrades gracefully when
 * the image URL is missing or fails to load (offline, CSP, broken link).
 * Pass `alt` when the image is the only representation of the person;
 * omit it when the name is rendered alongside (decorative).
 */
export function Avatar({
  src,
  name,
  alt = "",
  className,
}: {
  src?: string | null;
  name: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-label={alt || undefined}
        role={alt ? "img" : undefined}
        aria-hidden={alt ? undefined : true}
        className={cn(
          "flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={32}
      height={32}
      onError={() => setFailed(true)}
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
    />
  );
}
