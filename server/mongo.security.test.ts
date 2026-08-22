import { describe, expect, it } from "vitest";
import { sanitizeInvoiceForRole, sanitizeProductForRole } from "./mongoApi";
import { allocatePayment, calculateCancellationEffect, calculateInvoiceTotals } from "./invoiceLogic";

describe("role-based sensitive data", () => {
  it("removes purchase cost from products for USER while retaining it for ADMIN", () => {
    const product = { name: "منتج", defaultSellingPrice: 100, defaultPurchaseCost: 60 };
    expect(sanitizeProductForRole(product, "USER")).not.toHaveProperty("defaultPurchaseCost", 60);
    expect(sanitizeProductForRole(product, "ADMIN")).toHaveProperty("defaultPurchaseCost", 60);
  });

  it("removes cost snapshots from invoice items for USER", () => {
    const invoice = { total: 200, items: [{ productNameSnapshot: "منتج", purchaseCostAtSale: 120, total: 200 }] };
    expect(sanitizeInvoiceForRole(invoice, "USER").items[0]).not.toHaveProperty("purchaseCostAtSale", 120);
    expect(sanitizeInvoiceForRole(invoice, "ADMIN").items[0]).toHaveProperty("purchaseCostAtSale", 120);
  });
});

describe("invoice cancellation server rules", () => {
  it("restores every line and clears the outstanding customer balance", () => {
    expect(calculateCancellationEffect({ remainingAmount: 176, items: [{ productId: "p1", quantity: 3 }, { productId: "p2", quantity: 2 }] })).toEqual({ restoredItems: [{ productId: "p1", quantity: 3 }, { productId: "p2", quantity: 2 }], customerBalanceDelta: -176, remainingAmount: 0, status: "CANCELLED" });
  });
});

describe("payment allocation server rules", () => {
  it("allocates a payment oldest-first and reports any unapplied remainder", () => {
    expect(allocatePayment(250, [
      { id: "old", remainingAmount: 100 },
      { id: "new", remainingAmount: 80 },
    ])).toEqual({ allocations: [{ invoiceId: "old", amount: 100 }, { invoiceId: "new", amount: 80 }], unapplied: 70 });
  });
});

describe("multi-item invoice server rules", () => {
  it("calculates total, remaining balance, and stock cost from all lines", () => {
    expect(calculateInvoiceTotals([
      { quantity: 2, sellingPrice: 150, purchaseCost: 100 },
      { quantity: 3, sellingPrice: 80, purchaseCost: 50 },
    ], 20, 200)).toEqual({ subtotal: 540, cost: 350, total: 520, remaining: 320 });
  });
});
