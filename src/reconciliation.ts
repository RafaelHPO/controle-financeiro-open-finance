export type TransactionDirection = "debit" | "credit";
export type TransactionStatus = "pending" | "posted" | "reversed" | "deleted";
export type PaymentStatus = "OPEN" | "PAID" | "OVERDUE" | "IGNORED";
export type AccountType = "checking" | "savings" | "payment" | "credit_card" | "other";
export type PlannedKind = "expense" | "card_bill";
export type MatchKind = "bank_payment" | "card_purchase";

export interface BankTransaction {
  id: string;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount: number;
  transactionDate: string;
  description: string;
  merchantName?: string | null;
  institutionCode?: string | null;
  accountType?: AccountType;
}

export interface PlannedInstallment {
  id: string;
  idParcela: string;
  paymentStatus: PaymentStatus;
  amount: number;
  dueDate: string;
  description: string;
  origin?: string | null;
  recordKind?: PlannedKind;
  modality?: string | null;
}

export type ReconciliationDecision = "strong" | "review" | "none" | "ineligible";

export interface ReconciliationResult {
  transactionId: string;
  installmentId: string;
  score: number;
  decision: ReconciliationDecision;
  reasons: string[];
  matchKind?: MatchKind;
}

const DAY_MS = 86_400_000;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  const ignored = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "PAG", "PAGAMENTO"]);
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 2 && !ignored.has(token)),
  );
}

export function tokenSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / new Set([...a, ...b]).size;
}

function daysBetween(left: string, right: string): number {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / DAY_MS));
}

export function scoreReconciliation(
  transaction: BankTransaction,
  installment: PlannedInstallment,
): ReconciliationResult {
  const reasons: string[] = [];
  const accountType = transaction.accountType ?? "checking";
  const recordKind = installment.recordKind ?? "expense";
  const matchKind: MatchKind = accountType === "credit_card" ? "card_purchase" : "bank_payment";
  const label = normalizeText(`${transaction.description} ${transaction.merchantName ?? ""}`);
  const isBillPayment = /\b(FATURA|PAGAMENTO CARTAO|PGTO CARTAO|CARD BILL)\b/.test(label);
  const isInternalMovement = /\b(APLICACAO|RESGATE|INVESTIMENTO|TRANSFERENCIA INTERNA|TRANSFERENCIA ENTRE CONTAS)\b/.test(label);

  if (
    transaction.direction !== "debit" ||
    transaction.status !== "posted" ||
    !["OPEN", "OVERDUE"].includes(installment.paymentStatus) ||
    !["checking", "savings", "payment", "credit_card"].includes(accountType) ||
    (accountType === "credit_card" && recordKind === "card_bill") ||
    (accountType !== "credit_card" && recordKind === "expense" && isBillPayment) ||
    (accountType !== "credit_card" && isInternalMovement)
  ) {
    return {
      transactionId: transaction.id,
      installmentId: installment.id,
      score: 0,
      decision: "ineligible",
      reasons: ["movimento ou parcela não elegível"],
    };
  }

  let score = 0;
  const amountDifference = Math.abs(transaction.amount - installment.amount);
  const relativeDifference = installment.amount === 0 ? 1 : amountDifference / installment.amount;
  const dateDifference = daysBetween(transaction.transactionDate, installment.dueDate);

  // The first release only proposes one-to-one, near-exact payments.
  // Partial payments, installments combined in one transfer and distant dates need manual review.
  if (relativeDifference > 0.01 || dateDifference > 7) {
    return {
      transactionId: transaction.id,
      installmentId: installment.id,
      score: 0,
      decision: "none",
      reasons: ["valor ou data fora do intervalo de conciliação"],
      matchKind,
    };
  }

  if (amountDifference <= 0.01) {
    score += 50;
    reasons.push("valor idêntico");
  } else if (relativeDifference <= 0.01) {
    score += 30;
    reasons.push("valor com diferença de até 1%");
  }

  if (dateDifference <= 1) {
    score += 20;
    reasons.push("data no intervalo de 1 dia");
  } else if (dateDifference <= 3) {
    score += 15;
    reasons.push("data no intervalo de 3 dias");
  } else if (dateDifference <= 7) {
    score += 8;
    reasons.push("data no intervalo de 7 dias");
  }

  score += 10;
  reasons.push(matchKind === "card_purchase" ? "compra em cartão, não pagamento de fatura" : "saída de conta bancária");

  const transactionLabel = `${transaction.description} ${transaction.merchantName ?? ""}`;
  const normalizedPlanned = normalizeText(installment.description);
  const similarity = normalizedPlanned.length >= 4 && label.includes(normalizedPlanned)
    ? 1
    : tokenSimilarity(transactionLabel, installment.description);
  if (similarity >= 0.6) {
    score += 20;
    reasons.push("descrição muito semelhante");
  } else if (similarity >= 0.35) {
    score += 15;
    reasons.push("descrição semelhante");
  } else if (similarity >= 0.2) {
    score += 8;
    reasons.push("descrição parcialmente semelhante");
  }

  score = Math.min(score, 100);
  const decision: ReconciliationDecision = score >= 85 && similarity >= 0.35
    ? "strong"
    : score >= 60 ? "review" : "none";

  return {
    transactionId: transaction.id,
    installmentId: installment.id,
    score,
    decision,
    reasons,
    matchKind,
  };
}
