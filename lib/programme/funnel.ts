/**
 * The gate funnel for the admin dashboard.
 *
 * Deliberately NOT a funnel in the drop-off sense: G1-G4 are independent
 * conditions, not sequential stages. Someone can pass G4 while failing G1.
 * Rendering them as a classic narrowing funnel would imply an order that
 * doesn't exist and make "more people passed G3 than G2" look like a bug.
 * So this is a count per gate, plus how many have all four.
 */

import { GATE_IDS, allGatesPassed, type GateId, type GateSet } from "./gates";

export type GateFunnel = {
  total: number;
  perGate: Record<GateId, number>;
  complete: number;
};

export function buildGateFunnel(
  memberGates: readonly GateSet[],
): GateFunnel {
  const perGate = Object.fromEntries(
    GATE_IDS.map((id) => [id, 0]),
  ) as Record<GateId, number>;

  let complete = 0;
  for (const gates of memberGates) {
    for (const id of GATE_IDS) if (gates[id].passed) perGate[id] += 1;
    if (allGatesPassed(gates)) complete += 1;
  }

  return { total: memberGates.length, perGate, complete };
}
