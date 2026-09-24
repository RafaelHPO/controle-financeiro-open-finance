import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeObligations } from "../src/priority.ts";
import { scoreReconciliation } from "../src/reconciliation.ts";
import { isMeuPluggyItem, MEU_PLUGGY_CONNECTOR_ID } from "../src/meu-pluggy.ts";
import { mapAccountType, mapPluggyTransaction } from "../src/pluggy-mappers.ts";

test("prioritizes an overdue essential bill without hiding insufficient funds", () => {
  const result = prioritizeObligations([
    { idParcela: "demo-1", description: "Rent", category: "MORADIA", amount: 900, dueDate: "2026-01-05", priority: 5 },
    { idParcela: "demo-2", description: "Streaming", category: "LAZER", amount: 40, dueDate: "2026-01-20", priority: 1 },
  ], 100, "2026-01-10");
  assert.equal(result[0].idParcela, "demo-1");
  assert.equal(result[0].bucket, "insufficient_balance");
});

test("proposes a near-exact posted debit for human review", () => {
  const result = scoreReconciliation(
    { id: "txn-demo", direction: "debit", status: "posted", amount: 120, transactionDate: "2026-01-10", description: "ELECTRICITY", accountType: "checking" },
    { id: "bill-demo", idParcela: "demo-3", paymentStatus: "OPEN", amount: 120, dueDate: "2026-01-10", description: "ELECTRICITY", recordKind: "expense" },
  );
  assert.equal(result.decision, "strong");
  assert.equal(result.score, 100);
});

test("never treats a credit-card bill payment as another expense", () => {
  const result = scoreReconciliation(
    { id: "txn-bill", direction: "debit", status: "posted", amount: 500, transactionDate: "2026-01-10", description: "PAGAMENTO FATURA CARTAO", accountType: "checking" },
    { id: "expense-demo", idParcela: "demo-4", paymentStatus: "OPEN", amount: 500, dueDate: "2026-01-10", description: "SHOPPING", recordKind: "expense" },
  );
  assert.equal(result.decision, "ineligible");
});

test("pending movements cannot be auto-reconciled", () => {
  const result = scoreReconciliation(
    { id: "txn-pending", direction: "debit", status: "pending", amount: 30, transactionDate: "2026-01-10", description: "GROCERIES" },
    { id: "expense-pending", idParcela: "demo-5", paymentStatus: "OPEN", amount: 30, dueDate: "2026-01-10", description: "GROCERIES" },
  );
  assert.equal(result.decision, "ineligible");
});

test("normalizes Pluggy amounts without changing direction", () => {
  const mapped = mapPluggyTransaction(
    { id: "provider-demo", type: "DEBIT", amount: -20, date: "2026-01-10", description: "TEST PURCHASE" },
    "example-user", "example-account",
  );
  assert.equal(mapped.direction, "debit");
  assert.equal(mapped.amount, 20);
  assert.equal(mapAccountType("CREDIT", "CREDIT_CARD"), "credit_card");
});

test("accepts only the intended Meu Pluggy proxy connector", () => {
  assert.equal(isMeuPluggyItem({ connector: { id: MEU_PLUGGY_CONNECTOR_ID } }), true);
  assert.equal(isMeuPluggyItem({ connector: { id: 999 } }), false);
});
