"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "impact", label: "Company impact" },
  { value: "activity", label: "Activity feed" },
  { value: "movers", label: "Top movers" },
  { value: "league", label: "League table" },
  { value: "regulatory", label: "Regulatory" },
  { value: "cost", label: "Cost summary" },
  { value: "audit", label: "Audit log" },
  { value: "champions", label: "Champions" },
  { value: "deleted", label: "Deleted workflows" },
] as const;

type Props = {
  impact: React.ReactNode;
  activity: React.ReactNode;
  topMovers: React.ReactNode;
  league: React.ReactNode;
  regulatory: React.ReactNode;
  cost: React.ReactNode;
  audit: React.ReactNode;
  champions: React.ReactNode;
  deleted: React.ReactNode;
};

export function AdminTabs({
  impact,
  activity,
  topMovers,
  league,
  regulatory,
  cost,
  audit,
  champions,
  deleted,
}: Props) {
  const panels: Record<(typeof TABS)[number]["value"], React.ReactNode> = {
    impact,
    activity,
    movers: topMovers,
    league,
    regulatory,
    cost,
    audit,
    champions,
    deleted,
  };

  return (
    <Tabs defaultValue="impact">
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
