import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'fatora' });
const names = await mongoose.connection.db.listCollections().toArray();
for (const item of names) {
  const collection = mongoose.connection.db.collection(item.name);
  const count = await collection.countDocuments();
  const sample = await collection.find({}).limit(2).project({ passwordHash: 0 }).toArray();
  console.log(JSON.stringify({ collection: item.name, count, sample }));
}
await mongoose.disconnect();
