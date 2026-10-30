const mongoose = require('mongoose');
const transferSchema = new mongoose.Schema({
  reference_id: { type: String, required: true, unique: true, trim: true },
  from_account_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Account' },
  to_account_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Account' },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false });
module.exports = mongoose.model('Transfer', transferSchema);
