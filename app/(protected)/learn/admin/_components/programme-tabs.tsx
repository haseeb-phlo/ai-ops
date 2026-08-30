"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab state lives in the URL, matching AdminTabs on /admin - so a refresh
 * after marking attendance doesn't dump you back on the first tab, and a
 * post-mutation revalidation keeps you where you were.
 */
const TABS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "roster", label: "Roster" },
  { value: "cohorts", label: "Cohorts" },
  { value: "reporting", label: "Reporting" },
  { value: "import", label: "AI Score import" },
] as const;

type TabValue = (typeof TABS)[number]["value"];
const DEFAULT_TAB: TabValue = "dashboard";

function isTabValue(v: string | null): v is TabValue {
  return TABS.some((t) => t.value === v);
}

export function ProgrammeTabs({
  dashboard,
  roster,
  cohorts,
  reporting,
  importPanel,
}: {
  dashboard: React.ReactNode;
  roster: React.ReactNode;
  cohorts: React.ReactNode;
  reporting: React.ReactNode;
  importPanel: React.ReactNode;
}) {
  const panels: Record<TabValue, React.ReactNode> = {
    dashboard,
    roster,
    cohorts,
    reporting,
    import: importPanel,
  };

  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const value: TabValue = isTabValue(param) ? param : DEFAULT_TAB;

  function handleValueChange(next: unknown) {
    const nextValue =
      typeof next === "string" && isTabValue(next) ? next : DEFAULT_TAB;
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
