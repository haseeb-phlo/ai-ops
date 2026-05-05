"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

export function DirectorySearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushUpdate(next: string) {
    const qs = new URLSearchParams(params.toString());
    if (next.trim()) qs.set("q", next.trim());
    else qs.delete("q");
    qs.set("view", "directory");
    startTransition(() => {
      router.replace(`/map?${qs.toString()}`, { scroll: false });
    });
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushUpdate(next), 200);
  }

  return (
    <div className="relative max-w-xs">
      <Input
        type="search"
        placeholder="Search name, email, title, team…"
        value={value}
        onChange={onChange}
        aria-label="Search directory"
      />
    </div>
  );
}
