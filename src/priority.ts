export interface OpenObligation {
  idParcela: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  priority: number;
  knownPenaltyPercent?: number | null;
}

export interface PrioritizedObligation extends OpenObligation {
  score: number;
  bucket: "recommended_now" | "upcoming" | "insufficient_balance";
  reasons: string[];
  projectedBalance: number;
}

const DAY_MS = 86_400_000;
const ESSENTIAL_CATEGORIES = new Set([
  "MORADIA",
  "SAUDE",
  "ALIMENTACAO",
  "IMPOSTOS",
  "SERVICOS ESSENCIAIS",
]);

function normalizeCategory(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function dateOnly(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

export function prioritizeObligations(
  obligations: OpenObligation[],
  availableBalance: number,
  today: string,
): PrioritizedObligation[] {
  const todayTime = dateOnly(today);

  const scored = obligations.map((obligation) => {
    const reasons: string[] = [];
    const daysUntilDue = Math.round((dateOnly(obligation.dueDate) - todayTime) / DAY_MS);
    let score = 0;

    if (daysUntilDue < 0) {
      score += 50 + Math.min(Math.abs(daysUntilDue), 10);
      reasons.push(`vencida há ${Math.abs(daysUntilDue)} dia(s)`);
    } else if (daysUntilDue <= 1) {
      score += 35;
      reasons.push("vence hoje ou amanhã");
    } else if (daysUntilDue <= 3) {
      score += 25;
      reasons.push("vence em até 3 dias");
    } else if (daysUntilDue <= 7) {
      score += 15;
      reasons.push("vence em até 7 dias");
    } else if (daysUntilDue <= 14) {
      score += 5;
      reasons.push("vence em até 14 dias");
    }

    const priorityPoints = [0, 0, 5, 10, 18, 25][obligation.priority] ?? 0;
    score += priorityPoints;
    if (priorityPoints > 0) reasons.push(`prioridade ${obligation.priority}`);

    if (ESSENTIAL_CATEGORIES.has(normalizeCategory(obligation.category))) {
      score += 20;
      reasons.push("categoria essencial");
    }

    if ((obligation.knownPenaltyPercent ?? 0) > 0) {
      score += 10;
      reasons.push("há penalidade conhecida por atraso");
    }

    return { ...obligation, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score || a.dueDate.localeCompare(b.dueDate));

  let remaining = availableBalance;
  return scored.map((obligation) => {
    const canCover = obligation.amount <= remaining;
    if (canCover) remaining -= obligation.amount;

    const bucket = canCover
      ? obligation.score >= 35
        ? "recommended_now"
        : "upcoming"
      : "insufficient_balance";

    return {
      ...obligation,
      bucket,
      projectedBalance: Number(remaining.toFixed(2)),
      reasons: canCover
        ? obligation.reasons
        : [...obligation.reasons, "saldo informado não cobre esta obrigação após as anteriores"],
    };
  });
}

