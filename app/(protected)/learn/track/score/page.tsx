import Link from "next/link";
import { ClipboardCheckIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Your AI Score" };

/**
 * Placeholder. The real instrument - the 24-question form, the returner
 * pre-fill flow and the radar result screens - lands in Part 3.
 *
 * It exists now so the gate card on the track has somewhere to point: shipping
 * Part 2 with a link to a 404 would be worse than shipping this.
 */
export default function AiScorePlaceholderPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Your AI Score"
        description="A 3-minute check-in that sets your starting point."
      />
      <EmptyState
        icon={<ClipboardCheckIcon aria-hidden />}
        title="Almost ready"
        description="The check-in opens here shortly. Once you've done it, the rest of your 15-day track unlocks day by day."
        action={
          <Link
            href="/learn/track"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Back to the programme
          </Link>
        }
      />
    </PageContainer>
  );
}
