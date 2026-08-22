import mongoose from "mongoose";
import { hash } from "bcryptjs";
import { User, Customer, Product, Invoice, Payment, StockMovement, Expense, getMongo } from "./server/mongodb.ts";

await getMongo();
await Promise.all([User.deleteMany({}), Customer.deleteMany({}), Product.deleteMany({}), Invoice.deleteMany({}), Payment.deleteMany({}), StockMovement.deleteMany({}), Expense.deleteMany({})]);
const [admin, cashier] = await User.create([
  { username: "admin", name: "مدير الحساب", passwordHash: await hash("Admin123!", 12), role: "ADMIN", active: true },
  { username: "sales", name: "موظف المبيعات", passwordHash: await hash("Sales123!", 12), role: "USER", active: true },
]);
const customers = await Customer.create([
  { name: "مؤسسة النور للتوريدات", phone: "01000000001", address: "القاهرة", openingBalance: 0, balance: 0, createdBy: String(admin._id) },
  { name: "أحمد محمد", phone: "01000000002", address: "الجيزة", openingBalance: 0, balance: 0, createdBy: String(admin._id) },
  { name: "شركة الأمل التجارية", phone: "01000000003", address: "القليوبية", openingBalance: 0, balance: 0, createdBy: String(admin._id) },
]);
const products = await Product.create([
  { name: "سكر أبيض 1 كجم", sku: "GROC-SUGAR-1", category: "بقالة", defaultSellingPrice: 35, defaultPurchaseCost: 28, stockQuantity: 96, minimumStock: 15, unit: "كيس", createdBy: String(admin._id) },
  { name: "زيت طعام 1 لتر", sku: "GROC-OIL-1", category: "بقالة", defaultSellingPrice: 78, defaultPurchaseCost: 66, stockQuantity: 48, minimumStock: 10, unit: "زجاجة", createdBy: String(admin._id) },
  { name: "منظف أرضيات 1 لتر", sku: "HOME-CLEAN-1", category: "منظفات", defaultSellingPrice: 92, defaultPurchaseCost: 74, stockQuantity: 30, minimumStock: 8, unit: "زجاجة", createdBy: String(admin._id) },
  { name: "كرتونة مناديل ورقية", sku: "HOME-TISSUE-BOX", category: "مستلزمات منزلية", defaultSellingPrice: 145, defaultPurchaseCost: 120, stockQuantity: 18, minimumStock: 5, unit: "كرتونة", createdBy: String(admin._id) },
]);
const now = Date.now();
const invoiceOneItems = [{ productId: String(products[0]._id), productNameSnapshot: products[0].name, quantity: 6, sellingPriceAtSale: 35, purchaseCostAtSale: 28, total: 210 }, { productId: String(products[1]._id), productNameSnapshot: products[1].name, quantity: 2, sellingPriceAtSale: 78, purchaseCostAtSale: 66, total: 156 }];
const invoiceTwoItems = [{ productId: String(products[2]._id), productNameSnapshot: products[2].name, quantity: 3, sellingPriceAtSale: 92, purchaseCostAtSale: 74, total: 276 }];
const [invoiceOne, invoiceTwo] = await Invoice.create([
  { invoiceNumber: "INV-1001", clientOperationId: "seed-invoice-1001", customerId: customers[0]._id, customerNameSnapshot: customers[0].name, items: invoiceOneItems, subtotal: 366, discount: 16, total: 350, paidAmount: 350, remainingAmount: 0, status: "PAID", createdBy: admin._id, createdByName: admin.name, createdAt: new Date(now - 86400000) },
  { invoiceNumber: "INV-1002", clientOperationId: "seed-invoice-1002", customerId: customers[1]._id, customerNameSnapshot: customers[1].name, items: invoiceTwoItems, subtotal: 276, discount: 0, total: 276, paidAmount: 100, remainingAmount: 176, status: "PARTIALLY_PAID", createdBy: cashier._id, createdByName: cashier.name, createdAt: new Date(now - 3600000) },
]);
await Customer.updateOne({ _id: customers[1]._id }, { $set: { balance: 176 } });
await Product.updateOne({ _id: products[0]._id }, { $inc: { stockQuantity: -6 } });
await Product.updateOne({ _id: products[1]._id }, { $inc: { stockQuantity: -2 } });
await Product.updateOne({ _id: products[2]._id }, { $inc: { stockQuantity: -3 } });
await StockMovement.create([
  { productId: products[0]._id, type: "SALE", quantity: -6, reference: invoiceOne.invoiceNumber, createdBy: admin.name },
  { productId: products[1]._id, type: "SALE", quantity: -2, reference: invoiceOne.invoiceNumber, createdBy: admin.name },
  { productId: products[2]._id, type: "SALE", quantity: -3, reference: invoiceTwo.invoiceNumber, createdBy: cashier.name },
]);
await Payment.create({ clientOperationId: "seed-payment-1002", customerId: customers[1]._id, amount: 100, method: "نقدي", reference: invoiceTwo.invoiceNumber, createdBy: cashier._id, createdByName: cashier.name });
await Expense.create([
  { title: "إيجار المحل", category: "إيجار", amount: 4500, date: new Date(now - 2 * 86400000), notes: "إيجار الشهر الحالي", createdBy: admin.name },
  { title: "وقود التوصيل", category: "بنزين", amount: 650, date: new Date(now - 86400000), notes: "تعبئة سيارة التوصيل", createdBy: cashier.name },
  { title: "صيانة رفوف العرض", category: "صيانة", amount: 400, date: new Date(now - 3 * 86400000), notes: "صيانة دورية", createdBy: admin.name },
]);
console.log(JSON.stringify({ users: 2, customers: 3, products: 4, invoices: 2, payments: 1, expenses: 3 }));
await mongoose.disconnect();
