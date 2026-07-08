"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Order leads with the value lens, then operational, then governance.
// Logins lives inside Audit (sign-ins and edits are both "who did what
// when"); restoring deleted workflows is an operational task, so it gets
// its own Recovery tab rather than padding out the audit reading surface.
const TABS = [
  { value: "cost", label: "Costs" },
  { value: "champions", label: "Champions" },
  { value: "regulatory", label: "Compliance" },
  { value: "audit", label: "Audit" },
  { value: "recovery", label: "Recovery" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const DEFAULT_TAB: TabValue = "cost";

function isTabValue(v: string | null): v is TabValue {
  return TABS.some((t) => t.value === v);
}

type Props = {
  regulatory: React.ReactNode;
  cost: React.ReactNode;
  champions: React.ReactNode;
  audit: React.ReactNode;
  recovery: React.ReactNode;
};

export function AdminTabs({
  regulatory,
  cost,
  champions,
  audit,
  recovery,
}: Props) {
  const panels: Record<TabValue, React.ReactNode> = {
    regulatory,
    cost,
    champions,
    audit,
    recovery,
  };

  // The selected tab lives in the URL (?tab=) so refreshes, bookmarks, and
  // post-mutation revalidations don't dump admins back onto the first tab.
  // We update it with history.replaceState (Next keeps useSearchParams in
  // sync) so switching tabs doesn't re-run the server render.
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const value: TabValue = isTabValue(param) ? param : DEFAULT_TAB;

  function handleValueChange(next: unknown) {
    const nextValue = typeof next === "string" && isTabValue(next) ? next : DEFAULT_TAB;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextValue);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {panels[t.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
