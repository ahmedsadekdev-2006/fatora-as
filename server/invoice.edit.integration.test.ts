import { describe, expect, it } from "vitest";
import { Customer, Invoice, Product, StockMovement, getMongo } from "./mongodb";

const baseUrl = process.env.TEST_API_BASE_URL;
const runLive = process.env.RUN_LIVE_INTEGRATION === "1" && Boolean(baseUrl);

describe.skipIf(!runLive)("invoice edit HTTP integration", () => {
  it("edits all invoice lines, reconciles stock/balance, records movement, then cancels safely", async () => {
    await getMongo();
    const suffix = Date.now().toString(36);
    const createdIds = { customer: "", customerNew: "", productA: "", productB: "", invoice: "", invoiceNew: "" };
    let cookie = "";
    const request = async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Content-Type", "application/json");
      if (cookie) headers.set("Cookie", cookie);
      const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      const body = await response.json().catch(() => ({}));
      return { response, body };
    };
    try {
      const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "Admin123!" }) });
      expect(login.response.status).toBe(200);

      const customer = await request("/api/customers", { method: "POST", body: JSON.stringify({ name: `عميل تكامل ${suffix}`, openingBalance: 0 }) });
      expect(customer.response.status).toBe(201);
      createdIds.customer = String(customer.body._id);
      const productA = await request("/api/products", { method: "POST", body: JSON.stringify({ name: `صنف تكامل أ ${suffix}`, sku: `INT-A-${suffix}`, category: "اختبار", defaultSellingPrice: 10, defaultPurchaseCost: 6, stockQuantity: 10, minimumStock: 1, unit: "قطعة" }) });
      const productB = await request("/api/products", { method: "POST", body: JSON.stringify({ name: `صنف تكامل ب ${suffix}`, sku: `INT-B-${suffix}`, category: "اختبار", defaultSellingPrice: 8, defaultPurchaseCost: 4, stockQuantity: 10, minimumStock: 1, unit: "قطعة" }) });
      expect(productA.response.status).toBe(201);
      expect(productB.response.status).toBe(201);
      createdIds.productA = String(productA.body._id);
      createdIds.productB = String(productB.body._id);

      const invoice = await request("/api/invoices", { method: "POST", body: JSON.stringify({ clientOperationId: `int-create-${suffix}`, customerId: createdIds.customer, customerName: customer.body.name, items: [{ productId: createdIds.productA, quantity: 1, sellingPrice: 10 }, { productId: createdIds.productB, quantity: 1, sellingPrice: 8 }], discount: 0, paidAmount: 0 }) });
      expect(invoice.response.status).toBe(201);
      createdIds.invoice = String(invoice.body._id);
      expect(invoice.body.items).toHaveLength(2);

      const edited = await request(`/api/invoices/${createdIds.invoice}`, { method: "PUT", body: JSON.stringify({ items: [{ productId: createdIds.productA, quantity: 2, sellingPrice: 12 }, { productId: createdIds.productB, quantity: 1, sellingPrice: 8 }], discount: 2, paidAmount: 5 }) });
      expect(edited.response.status).toBe(200);
      expect(edited.body.items.map((item: any) => item.quantity)).toEqual([2, 1]);
      expect(edited.body.total).toBe(30);
      expect(edited.body.remainingAmount).toBe(25);

      const products = await Product.find({ _id: { $in: [createdIds.productA, createdIds.productB] } }).lean();
      expect(products.find(item => String(item._id) === createdIds.productA)?.stockQuantity).toBe(8);
      expect(products.find(item => String(item._id) === createdIds.productB)?.stockQuantity).toBe(9);
      expect(await Customer.findById(createdIds.customer).then(item => item?.balance)).toBe(25);
      expect(await StockMovement.countDocuments({ reference: invoice.body.invoiceNumber, type: "INVOICE_EDIT" })).toBe(1);

      const removed = await request(`/api/invoices/${createdIds.invoice}`, { method: "PUT", body: JSON.stringify({ items: [{ productId: createdIds.productA, quantity: 2, sellingPrice: 12 }], discount: 2, paidAmount: 5 }) });
      expect(removed.response.status).toBe(200);
      expect(removed.body.items).toHaveLength(1);
      expect(await Product.findById(createdIds.productB).then(item => item?.stockQuantity)).toBe(10);
      expect(await Customer.findById(createdIds.customer).then(item => item?.balance)).toBe(17);
      expect(await StockMovement.countDocuments({ reference: invoice.body.invoiceNumber, type: "INVOICE_EDIT" })).toBe(2);

      const cancelled = await request(`/api/invoices/${createdIds.invoice}`, { method: "PUT", body: JSON.stringify({ status: "CANCELLED" }) });
      expect(cancelled.response.status).toBe(200);
      expect(cancelled.body.status).toBe("CANCELLED");
      expect(await Customer.findById(createdIds.customer).then(item => item?.balance)).toBe(0);
      const restored = await Product.find({ _id: { $in: [createdIds.productA, createdIds.productB] } }).lean();
      expect(restored.find(item => String(item._id) === createdIds.productA)?.stockQuantity).toBe(10);
      expect(restored.find(item => String(item._id) === createdIds.productB)?.stockQuantity).toBe(10);

      const newCustomerInvoice = await request("/api/invoices", { method: "POST", body: JSON.stringify({ clientOperationId: `int-new-customer-${suffix}`, customerName: `عميل جديد تكامل ${suffix}`, items: [{ productId: createdIds.productA, quantity: 1, sellingPrice: 10 }], discount: 0, paidAmount: 0 }) });
      expect(newCustomerInvoice.response.status).toBe(201);
      createdIds.invoiceNew = String(newCustomerInvoice.body._id);
      createdIds.customerNew = String(newCustomerInvoice.body.customerId);
      expect(newCustomerInvoice.body.customerNameSnapshot).toContain(`عميل جديد تكامل ${suffix}`);
      const newCustomer = await Customer.findById(createdIds.customerNew);
      expect(newCustomer?.balance).toBe(10);
      const cancelledNew = await request(`/api/invoices/${createdIds.invoiceNew}`, { method: "PUT", body: JSON.stringify({ status: "CANCELLED" }) });
      expect(cancelledNew.response.status).toBe(200);
      expect(await Customer.findById(createdIds.customerNew).then(item => item?.balance)).toBe(0);
    } finally {
      if (createdIds.invoice) await Invoice.findByIdAndDelete(createdIds.invoice);
      if (createdIds.invoiceNew) await Invoice.findByIdAndDelete(createdIds.invoiceNew);
      if (createdIds.customer) await Customer.findByIdAndDelete(createdIds.customer);
      if (createdIds.customerNew) await Customer.findByIdAndDelete(createdIds.customerNew);
      if (createdIds.productA || createdIds.productB) await Product.deleteMany({ _id: { $in: [createdIds.productA, createdIds.productB].filter(Boolean) } });
      if (createdIds.invoice) await StockMovement.deleteMany({ reference: { $regex: createdIds.invoice } });
      if (createdIds.invoiceNew) await StockMovement.deleteMany({ reference: { $regex: createdIds.invoiceNew } });
    }
  }, 30000);
});
