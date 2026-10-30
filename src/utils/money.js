function parseAmount(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}
function decimal(value) {
  // Monetary values are limited to two decimal places by validation.
  return require('mongoose').Types.Decimal128.fromString(Number(value).toFixed(2));
}
function asNumber(value) { return Number(value.toString()); }
module.exports = { parseAmount, decimal, asNumber };
