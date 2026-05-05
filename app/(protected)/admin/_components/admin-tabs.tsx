"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "regulatory", label: "Regulatory" },
  { value: "cost", label: "Cost" },
  { value: "champions", label: "Champions" },
  { value: "audit", label: "Audit" },
] as const;

type Props = {
  regulatory: React.ReactNode;
  cost: React.ReactNode;
  champions: React.ReactNode;
  audit: React.ReactNode;
};

export function AdminTabs({ regulatory, cost, champions, audit }: Props) {
  const panels: Record<(typeof TABS)[number]["value"], React.ReactNode> = {
    regulatory,
    cost,
    champions,
    audit,
  };

  return (
    <Tabs defaultValue="regulatory">
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
