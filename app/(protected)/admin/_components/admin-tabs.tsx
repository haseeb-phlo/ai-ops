"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Order leads with the value lens, then operational, then governance.
// Logins lives inside Audit (sign-ins, edits, deletes are all "who did
// what when") so the tab strip stays four wide instead of five.
const TABS = [
  { value: "cost", label: "ROI" },
  { value: "champions", label: "Champions" },
  { value: "regulatory", label: "Compliance" },
  { value: "audit", label: "Audit" },
] as const;

type Props = {
  regulatory: React.ReactNode;
  cost: React.ReactNode;
  champions: React.ReactNode;
  audit: React.ReactNode;
};

export function AdminTabs({
  regulatory,
  cost,
  champions,
  audit,
}: Props) {
  const panels: Record<(typeof TABS)[number]["value"], React.ReactNode> = {
    regulatory,
    cost,
    champions,
    audit,
  };

  return (
    <Tabs defaultValue="cost">
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
