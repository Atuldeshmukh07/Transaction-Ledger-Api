const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  reference_id: { type: String, required: true, trim: true, maxlength: 200 },
  transfer_id: { type: String, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false });

transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });
transactionSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.id = ret._id.toString(); delete ret._id; delete ret.__v;
  ret.account_id = ret.account_id.toString();
  ret.amount = Number(ret.amount.toString());
  if (ret.transfer_id == null) delete ret.transfer_id;
  return ret;
}});

module.exports = mongoose.model('Transaction', transactionSchema);
