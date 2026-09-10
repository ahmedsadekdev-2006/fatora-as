import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'fatora';

if (!uri) {
  throw new Error('MONGODB_URI is missing');
}

await mongoose.connect(uri, { dbName });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER', index: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const username = 'ahmed-sadek';
const name = 'ahmed sadek';
const password = 'medo2006';
const passwordHash = await bcrypt.hash(password, 10);

const result = await User.findOneAndUpdate(
  { username },
  {
    $set: {
      name,
      passwordHash,
      role: 'ADMIN',
      active: true,
      createdAt: new Date()
    }
  },
  {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true
  }
);

console.log(JSON.stringify({
  _id: String(result._id),
  username: result.username,
  name: result.name,
  role: result.role,
  active: result.active,
  createdAt: result.createdAt.toISOString()
}, null, 2));

await mongoose.disconnect();
