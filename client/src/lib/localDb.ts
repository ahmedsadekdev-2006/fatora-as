import Dexie, { type Table } from "dexie";

export type Role = "ADMIN" | "USER";
export type Product = { id: string; name: string; sku: string; category: string; salePrice: number; cost: number; stock: number; minimumStock: number; unit: string; active: boolean; updatedAt: number };
export type Customer = { id: string; name: string; phone: string; address?: string; openingBalance: number; balance: number; updatedAt: number };
export type InvoiceItem = { productId: string; name: string; quantity: number; price: number; cost: number; total: number };
export type Invoice = { id: string; number: string; customerId: string; customerName: string; createdByName?: string; items: InvoiceItem[]; subtotal: number; discount: number; total: number; paid: number; remaining: number; status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "CANCELLED"; createdAt: number };
export type Expense = { id: string; title: string; category: string; amount: number; date: number; notes?: string };
export type Payment = { id: string; clientOperationId: string; customerId: string; amount: number; method: "نقدي" | "تحويل بنكي" | "أخرى"; date: number; invoiceId?: string };
export type StockMovement = { id: string; productId: string; type: "SALE" | "PURCHASE" | "ADJUSTMENT" | "RETURN"; quantity: number; reference: string; date: number };
export type Todo = { id: string; title: string; notes: string; status: "OPEN" | "DONE"; priority: "LOW" | "MEDIUM" | "HIGH"; dueDate?: number; createdByName?: string; createdAt: number; updatedAt: number };
export type SyncOperation = { id: string; clientOperationId: string; type: string; entity: string; payload: unknown; status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT"; createdAt: number; retryCount: number; lastError?: string; syncedAt?: number };

class BusinessDB extends Dexie {
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  invoices!: Table<Invoice, string>;
  expenses!: Table<Expense, string>;
  payments!: Table<Payment, string>;
  stockMovements!: Table<StockMovement, string>;
  todos!: Table<Todo, string>;
  syncQueue!: Table<SyncOperation, string>;
  constructor() {
    super("arabic-business-manager");
    this.version(1).stores({ products: "id, name, sku, category, updatedAt", customers: "id, name, phone, updatedAt", invoices: "id, number, customerId, createdAt, status", expenses: "id, category, date", payments: "id, customerId, date", stockMovements: "id, productId, date", syncQueue: "id, status, createdAt" });
    this.version(2).stores({ products: "id, name, sku, category, updatedAt", customers: "id, name, phone, updatedAt", invoices: "id, number, customerId, createdAt, status", expenses: "id, category, date", payments: "id, customerId, date", stockMovements: "id, productId, date", syncQueue: "id, clientOperationId, status, createdAt" });
    this.version(3).stores({ products: "id, name, sku, category, updatedAt", customers: "id, name, phone, updatedAt", invoices: "id, number, customerId, createdAt, status", expenses: "id, category, date", payments: "id, customerId, date", stockMovements: "id, productId, date", todos: "id, status, priority, dueDate, updatedAt", syncQueue: "id, clientOperationId, entity, status, createdAt" });
  }
}

export const db = new BusinessDB();
const now = Date.now();
const id = () => crypto.randomUUID();

export async function seedIfEmpty() {
  if (await db.products.count()) return;
  const customers: Customer[] = [
    { id: id(), name: "أحمد محمد", phone: "01012345678", address: "مدينة نصر", openingBalance: 500, balance: 2500, updatedAt: now },
    { id: id(), name: "محمود للتجارة", phone: "01123456789", address: "العبور", openingBalance: 0, balance: 0, updatedAt: now },
    { id: id(), name: "ورشة النور", phone: "01234567890", address: "المعادي", openingBalance: 1200, balance: 3900, updatedAt: now },
  ];
  const products: Product[] = [
    { id: id(), name: "زيت موتور 5W-30", sku: "OIL-530", category: "زيوت", salePrice: 420, cost: 315, stock: 42, minimumStock: 10, unit: "عبوة", active: true, updatedAt: now },
    { id: id(), name: "فلتر زيت", sku: "FLT-001", category: "فلاتر", salePrice: 185, cost: 120, stock: 8, minimumStock: 12, unit: "قطعة", active: true, updatedAt: now },
    { id: id(), name: "فلتر هواء", sku: "FLT-002", category: "فلاتر", salePrice: 260, cost: 175, stock: 24, minimumStock: 8, unit: "قطعة", active: true, updatedAt: now },
    { id: id(), name: "تيل فرامل أمامي", sku: "BRK-101", category: "فرامل", salePrice: 740, cost: 510, stock: 6, minimumStock: 6, unit: "طقم", active: true, updatedAt: now },
    { id: id(), name: "سائل تبريد", sku: "CLN-050", category: "سوائل", salePrice: 135, cost: 78, stock: 55, minimumStock: 15, unit: "عبوة", active: true, updatedAt: now },
  ];
  const invoice: Invoice = { id: id(), number: "#1048", customerId: customers[0].id, customerName: customers[0].name, items: [{ productId: products[0].id, name: products[0].name, quantity: 4, price: products[0].salePrice, cost: products[0].cost, total: products[0].salePrice * 4 }], subtotal: 1680, discount: 0, total: 1680, paid: 800, remaining: 880, status: "PARTIALLY_PAID", createdAt: now - 86400000 };
  await db.transaction("rw", db.products, db.customers, db.invoices, db.expenses, async () => { await db.products.bulkAdd(products); await db.customers.bulkAdd(customers); await db.invoices.add(invoice); await db.expenses.bulkAdd([{ id: id(), title: "بنزين توصيلات", category: "بنزين", amount: 320, date: now - 86400000 }, { id: id(), title: "صيانة المحل", category: "صيانة", amount: 450, date: now - 172800000 }]); });
}

export async function queue(type: string, entity: string, payload: any) { if (entity === "todo" && (type === "UPDATE" || type === "DELETE") && payload?.id) { const pendingCreate = await db.syncQueue.where("entity").equals("todo").filter(operation => operation.type === "CREATE" && operation.status === "PENDING" && (operation.payload as any)?.id === payload.id).first(); if (pendingCreate) { if (type === "DELETE") await db.syncQueue.delete(pendingCreate.id); else await db.syncQueue.update(pendingCreate.id, { payload }); return; } } const operationId = id(); await db.syncQueue.add({ id: operationId, clientOperationId: operationId, type, entity, payload, status: "PENDING", createdAt: Date.now(), retryCount: 0 }); }
export async function recordPayment(payment: Omit<Payment, "id" | "clientOperationId">) { const item = { ...payment, id: id(), clientOperationId: id() }; await db.payments.add(item); await queue("CREATE", "payment", item); return item; }
export async function recordStockMovement(movement: Omit<StockMovement, "id">) { const item = { ...movement, id: id() }; await db.stockMovements.add(item); await queue("CREATE", "stockMovement", item); return item; }

export function getSyncRetryDelay(retryCount: number) { return Math.min(30000, 1000 * (2 ** Math.max(0, retryCount))); }
export function syncOutcomeFromStatus(status: number): "SYNCED" | "CONFLICT" | "FAILED" { if (status === 409) return "CONFLICT"; return status >= 200 && status < 300 ? "SYNCED" : "FAILED"; }

export async function syncPending() {
  if (!navigator.onLine) return 0;
  const pending = await db.syncQueue.where("status").anyOf("PENDING", "FAILED").toArray();
  let synced = 0;
  for (const op of pending) {
    if (op.retryCount >= 5) continue;
    const delay = getSyncRetryDelay(op.retryCount);
    if (op.retryCount > 0) await new Promise(resolve => window.setTimeout(resolve, delay));
    await db.syncQueue.update(op.id, { status: "SYNCING" });
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": op.clientOperationId }, body: JSON.stringify(op) });
      const outcome = syncOutcomeFromStatus(response.status);
      if (outcome === "CONFLICT") { await db.syncQueue.update(op.id, { status: "CONFLICT", lastError: "يوجد تعديل أحدث على الخادم ويحتاج مراجعة" }); continue; }
      if (outcome === "FAILED") throw new Error("sync_failed");
      await db.syncQueue.update(op.id, { status: "SYNCED", syncedAt: Date.now(), lastError: undefined }); synced++;
    } catch { await db.syncQueue.update(op.id, { status: "FAILED", retryCount: op.retryCount + 1, lastError: "تعذر الاتصال بالخادم" }); }
  }
  return synced;
}
export function money(value: number) { return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.round(value)); }
export function makeId() { return id(); }
