const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Account name is required'], trim: true, minlength: 1, maxlength: 120 },
  balance: { type: mongoose.Schema.Types.Decimal128, required: true, default: () => mongoose.Types.Decimal128.fromString('0.00') }
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false });

accountSchema.set('toJSON', { transform: (_doc, ret) => {
  ret.id = ret._id.toString(); delete ret._id;
  ret.balance = Number(ret.balance.toString());
  return ret;
}});

module.exports = mongoose.model('Account', accountSchema);
