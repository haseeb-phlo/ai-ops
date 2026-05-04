import { gbp, minutes } from "./format";

type Confidence = "high" | "medium" | "low";

type Props = {
  totalMinutes: number;
  totalGbp: number;
  activeCount: number;
  minutesByConfidence: Record<Confidence, number>;
  gbpByConfidence: Record<Confidence, number>;
  countByConfidence: Record<Confidence, number>;
};

export function CompanyImpact({
  totalMinutes,
  totalGbp,
  activeCount,
  minutesByConfidence,
  gbpByConfidence,
  countByConfidence,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <ImpactCard
        label="Minutes saved / week"
        total={minutes(totalMinutes)}
        breakdown={[
          { confidence: "high", value: minutes(minutesByConfidence.high) },
          { confidence: "medium", value: minutes(minutesByConfidence.medium) },
          { confidence: "low", value: minutes(minutesByConfidence.low) },
        ]}
        signedTotal={totalMinutes}
      />
      <ImpactCard
        label="GBP saved / week"
        total={gbp(totalGbp)}
        breakdown={[
          { confidence: "high", value: gbp(gbpByConfidence.high) },
          { confidence: "medium", value: gbp(gbpByConfidence.medium) },
          { confidence: "low", value: gbp(gbpByConfidence.low) },
        ]}
        signedTotal={totalGbp}
      />
      <ImpactCard
        label="Active interventions"
        total={activeCount.toLocaleString()}
        breakdown={[
          { confidence: "high", value: countByConfidence.high.toString() },
          { confidence: "medium", value: countByConfidence.medium.toString() },
          { confidence: "low", value: countByConfidence.low.toString() },
        ]}
        signedTotal={activeCount}
      />
    </div>
  );
}

function ImpactCard({
  label,
  total,
  breakdown,
  signedTotal,
}: {
  label: string;
  total: string;
  signedTotal: number;
  breakdown: { confidence: Confidence; value: string }[];
}) {
  const cls =
    signedTotal < 0
      ? "text-red-700"
      : signedTotal > 0
        ? "text-zinc-900"
        : "text-zinc-500";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>
        {total}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3">
        {breakdown.map((b) => (
          <div key={b.confidence}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {b.confidence}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-zinc-900">
              {b.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
