import mongoose, { Schema, type Model } from "mongoose";

const uri = process.env.MONGODB_URI;
const configuredDbName = process.env.MONGODB_DB || (() => { try { const path = new URL(uri || "").pathname.replace(/^\//, ""); return path || "fatora"; } catch { return "fatora"; } })();
let connectionPromise: Promise<typeof mongoose> | null = null;
export function getMongo() {
  if (!uri) {
    console.error("[MongoDB] ❌ الاتصال فشل: MONGODB_URI غير مضبوط");
    throw new Error("MONGODB_URI غير مضبوط");
  }
  connectionPromise ??= mongoose
    .connect(uri, { dbName: configuredDbName })
    .then(connection => {
      console.info(`[MongoDB] ✅ الاتصال ناجح - قاعدة البيانات: ${connection.connection.name}`);
      return connection;
    })
    .catch(error => {
      connectionPromise = null;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[MongoDB] ❌ الاتصال فشل: ${message}`);
      throw error;
    });
  return connectionPromise;
}

const userSchema = new Schema({ username: { type: String, required: true, unique: true, index: true }, name: { type: String, required: true }, passwordHash: { type: String, required: true }, role: { type: String, enum: ["ADMIN", "USER"], default: "USER", index: true }, active: { type: Boolean, default: true }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const customerSchema = new Schema({ name: { type: String, required: true, index: true }, phone: { type: String, index: true }, address: String, notes: String, openingBalance: { type: Number, default: 0 }, balance: { type: Number, default: 0 }, createdBy: String, createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now } }, { versionKey: false });
const productSchema = new Schema({ name: { type: String, required: true, index: true }, sku: { type: String, index: true }, category: { type: String, index: true }, defaultSellingPrice: { type: Number, required: true }, defaultPurchaseCost: { type: Number, required: true }, stockQuantity: { type: Number, default: 0 }, minimumStock: { type: Number, default: 0 }, unit: { type: String, default: "قطعة" }, active: { type: Boolean, default: true }, createdBy: String, createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now } }, { versionKey: false });
const invoiceItemSchema = new Schema({ productId: String, productNameSnapshot: String, quantity: { type: Number, min: 1 }, sellingPriceAtSale: Number, purchaseCostAtSale: Number, total: Number }, { _id: false });
const invoiceSchema = new Schema({ invoiceNumber: { type: String, index: true }, clientOperationId: { type: String, unique: true, index: true }, customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true }, customerNameSnapshot: String, items: [invoiceItemSchema], subtotal: Number, discount: Number, total: Number, paidAmount: Number, remainingAmount: Number, status: { type: String, enum: ["PAID", "PARTIALLY_PAID", "UNPAID", "CANCELLED"], index: true }, createdBy: { type: Schema.Types.ObjectId, ref: "User" }, createdByName: String, createdAt: { type: Date, default: Date.now, index: true }, updatedAt: { type: Date, default: Date.now } }, { versionKey: false });
const paymentSchema = new Schema({ clientOperationId: { type: String, unique: true, index: true }, customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true }, amount: Number, method: String, reference: String, createdBy: { type: Schema.Types.ObjectId, ref: "User" }, createdByName: String, createdAt: { type: Date, default: Date.now, index: true } }, { versionKey: false });
const stockMovementSchema = new Schema({ productId: { type: Schema.Types.ObjectId, ref: "Product", index: true }, type: String, quantity: Number, reference: String, createdBy: String, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const expenseSchema = new Schema({ title: String, category: String, amount: Number, date: Date, notes: String, createdBy: String, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const syncOperationSchema = new Schema({ clientOperationId: { type: String, required: true, unique: true, index: true }, entity: String, processedAt: { type: Date, default: Date.now } }, { versionKey: false });
const todoSchema = new Schema({ title: { type: String, required: true, trim: true }, notes: { type: String, default: "" }, status: { type: String, enum: ["OPEN", "DONE"], default: "OPEN", index: true }, priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM", index: true }, dueDate: { type: Date }, createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true }, createdByName: String, createdAt: { type: Date, default: Date.now, index: true }, updatedAt: { type: Date, default: Date.now } }, { versionKey: false });

export const User = (mongoose.models.User || mongoose.model("User", userSchema)) as Model<any>;
export const Customer = (mongoose.models.Customer || mongoose.model("Customer", customerSchema)) as Model<any>;
export const Product = (mongoose.models.Product || mongoose.model("Product", productSchema)) as Model<any>;
export const Invoice = (mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema)) as Model<any>;
export const Payment = (mongoose.models.Payment || mongoose.model("Payment", paymentSchema)) as Model<any>;
export const StockMovement = (mongoose.models.StockMovement || mongoose.model("StockMovement", stockMovementSchema)) as Model<any>;
export const Expense = (mongoose.models.Expense || mongoose.model("Expense", expenseSchema)) as Model<any>;
export const SyncOperation = (mongoose.models.SyncOperation || mongoose.model("SyncOperation", syncOperationSchema)) as Model<any>;
export const Todo = (mongoose.models.Todo || mongoose.model("Todo", todoSchema)) as Model<any>;
