export type InvoiceCalculationLine = { quantity: number; sellingPrice: number; purchaseCost: number };
export type InvoiceQuantityLine = { productId: string; quantity: number };

export function calculateItemQuantityDeltas(previousItems: InvoiceQuantityLine[], nextItems: InvoiceQuantityLine[]) {
  const previous = new Map<string, number>();
  const next = new Map<string, number>();
  for (const item of previousItems) previous.set(item.productId, (previous.get(item.productId) || 0) + Number(item.quantity || 0));
  for (const item of nextItems) next.set(item.productId, (next.get(item.productId) || 0) + Number(item.quantity || 0));
  const productIds = new Set([...Array.from(previous.keys()), ...Array.from(next.keys())]);
  return Array.from(productIds).map(productId => ({ productId, delta: (next.get(productId) || 0) - (previous.get(productId) || 0) })).filter(item => item.delta !== 0);
}

export function calculateInvoiceTotals(lines: InvoiceCalculationLine[], discount: number, paidAmount: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.sellingPrice, 0);
  const cost = lines.reduce((sum, line) => sum + line.quantity * line.purchaseCost, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, cost, total, remaining: Math.max(0, total - paidAmount) };
}

export function calculateCancellationEffect(invoice: { items?: Array<{ productId: string; quantity: number }>; remainingAmount?: number }) {
  return { restoredItems: (invoice.items || []).map(item => ({ productId: item.productId, quantity: Math.max(0, Number(item.quantity || 0)) })), customerBalanceDelta: -Math.max(0, Number(invoice.remainingAmount || 0)), remainingAmount: 0, status: "CANCELLED" as const };
}

export function allocatePayment(amount: number, invoices: Array<{ id: string; remainingAmount: number }>) {
  let unapplied = Math.max(0, amount);
  const allocations: Array<{ invoiceId: string; amount: number }> = [];
  for (const invoice of invoices) {
    if (unapplied <= 0) break;
    const applied = Math.min(unapplied, Math.max(0, invoice.remainingAmount));
    if (applied > 0) allocations.push({ invoiceId: invoice.id, amount: applied });
    unapplied -= applied;
  }
  return { allocations, unapplied };
}
