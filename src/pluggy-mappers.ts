export type PluggyAccount = Record<string, unknown> & {
  id: string;
  type?: string;
  subtype?: string;
  number?: string;
  name?: string;
  marketingName?: string;
  balance?: number;
  currencyCode?: string;
  bankData?: Record<string, unknown> | null;
  creditData?: Record<string, unknown> | null;
};

export type PluggyTransaction = Record<string, unknown> & {
  id: string;
  type?: string;
  amount?: number;
  date?: string;
  description?: string;
  descriptionRaw?: string | null;
  category?: string | null;
  status?: string;
  merchant?: unknown;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function mapAccountType(type: unknown, subtype: unknown):
  | "checking"
  | "savings"
  | "payment"
  | "credit_card"
  | "other" {
  const normalizedType = String(type ?? "").toUpperCase();
  const normalizedSubtype = String(subtype ?? "").toUpperCase();
  if (normalizedType === "CREDIT" || normalizedSubtype === "CREDIT_CARD") return "credit_card";
  if (normalizedSubtype === "SAVINGS_ACCOUNT") return "savings";
  if (normalizedSubtype === "PAYMENT_ACCOUNT") return "payment";
  if (normalizedType === "BANK" || normalizedSubtype === "CHECKING_ACCOUNT") return "checking";
  return "other";
}

export function mapPluggyAccount(
  account: PluggyAccount,
  userId: string,
  connectionId: string,
): Record<string, unknown> {
  const credit = account.creditData ?? {};
  const displayName = text(account.marketingName) ?? text(account.name) ?? `Conta ${account.id.slice(0, 8)}`;
  return {
    user_id: userId,
    connection_id: connectionId,
    provider_account_id: account.id,
    account_type: mapAccountType(account.type, account.subtype),
    subtype: text(account.subtype),
    display_name: displayName,
    masked_number: text(account.number),
    currency_code: text(account.currencyCode) ?? "BRL",
    current_balance: finiteNumber(account.balance),
    available_balance: finiteNumber(credit.availableCreditLimit),
    credit_limit: finiteNumber(credit.creditLimit),
    active: String(credit.status ?? "ACTIVE").toUpperCase() !== "CANCELLED",
    raw_payload: account,
  };
}

function merchantName(value: unknown): string | null {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return null;
  const merchant = value as Record<string, unknown>;
  return text(merchant.name) ?? text(merchant.businessName) ?? text(merchant.tradeName);
}

export function mapPluggyTransaction(
  transaction: PluggyTransaction,
  userId: string,
  accountId: string,
): Record<string, unknown> {
  const amount = finiteNumber(transaction.amount) ?? 0;
  const direction = String(transaction.type ?? "").toUpperCase() === "CREDIT" ? "credit" : "debit";
  const providerStatus = String(transaction.status ?? "POSTED").toUpperCase();
  const status = providerStatus === "PENDING"
    ? "pending"
    : providerStatus === "REVERSED"
    ? "reversed"
    : providerStatus === "DELETED"
    ? "deleted"
    : "posted";
  const date = text(transaction.date);
  if (!date || Number.isNaN(Date.parse(date))) throw new Error(`Invalid transaction date: ${transaction.id}`);

  return {
    user_id: userId,
    account_id: accountId,
    provider_transaction_id: transaction.id,
    direction,
    amount: Math.abs(amount),
    transaction_date: date.slice(0, 10),
    posted_at: providerStatus === "PENDING" ? null : date,
    description: text(transaction.description) ?? text(transaction.descriptionRaw) ?? "Movimentação",
    merchant_name: merchantName(transaction.merchant),
    provider_category: text(transaction.category),
    status,
    raw_payload: transaction,
  };
}

