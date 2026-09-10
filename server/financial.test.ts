import { describe, expect, it } from "vitest";

type Item = { quantity: number; price: number; cost: number };
const calculateInvoice = (items: Item[], discount: number, paid: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, total, remaining: Math.max(0, total - paid), grossProfit: total - items.reduce((sum, item) => sum + item.quantity * item.cost, 0) };
};

describe("financial rules", () => {
  it("calculates sales, remaining and gross profit from invoice snapshots", () => {
    expect(calculateInvoice([{ quantity: 10, price: 90, cost: 80 }], 0, 500)).toEqual({ subtotal: 900, total: 900, remaining: 400, grossProfit: 100 });
  });
  it("discount reduces revenue and profit but payment does not change profit", () => {
    const before = calculateInvoice([{ quantity: 10, price: 100, cost: 80 }], 100, 0);
    const afterPayment = calculateInvoice([{ quantity: 10, price: 100, cost: 80 }], 100, 500);
    expect(before.grossProfit).toBe(100);
    expect(afterPayment.grossProfit).toBe(before.grossProfit);
    expect(afterPayment.remaining).toBe(400);
  });
  it("never returns a negative remaining amount", () => {
    expect(calculateInvoice([{ quantity: 1, price: 50, cost: 20 }], 0, 100).remaining).toBe(0);
  });
});

  it("aggregates multiple invoice lines using price and cost snapshots", () => {
    expect(calculateInvoice([
      { quantity: 2, price: 150, cost: 100 },
      { quantity: 3, price: 80, cost: 50 },
    ], 20, 200)).toEqual({ subtotal: 540, total: 520, remaining: 320, grossProfit: 170 });
  });

  it("keeps the remaining balance tied to the recalculated invoice total", () => {
    const invoice = calculateInvoice([{ quantity: 4, price: 75, cost: 40 }], 50, 100);
    expect(invoice.total).toBe(250);
    expect(invoice.remaining).toBe(150);
  });

import { calculateItemQuantityDeltas } from "./invoiceLogic";

describe("invoice item edit rules", () => {
  it("returns stock deltas for added, reduced, and removed lines", () => {
    expect(calculateItemQuantityDeltas(
      [{ productId: "sugar", quantity: 2 }, { productId: "oil", quantity: 1 }],
      [{ productId: "sugar", quantity: 3 }, { productId: "tissue", quantity: 4 }],
    )).toEqual([
      { productId: "sugar", delta: 1 },
      { productId: "oil", delta: -1 },
      { productId: "tissue", delta: 4 },
    ]);
  });
});
