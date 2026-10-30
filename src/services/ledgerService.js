const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Transfer = require('../models/Transfer');
const { decimal, asNumber } = require('../utils/money');

const cents = (n) => Math.round(Number(n) * 100);
const money = (c) => Number((c / 100).toFixed(2));

async function createAccount(name) {
  const account = await Account.create({ name: name.trim(), balance: decimal(0) });
  return account;
}

async function addTransaction({ accountId, type, amount, description = '', referenceId }) {
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const account = await Account.findById(accountId).session(session);
      if (!account) { const e = new Error('Account not found'); e.status = 404; e.code = 'ACCOUNT_NOT_FOUND'; throw e; }
      const existing = await Transaction.findOne({ account_id: accountId, reference_id: referenceId }).session(session);
      if (existing) { const e = new Error('A transaction with this reference_id already exists for this account'); e.status = 409; e.code = 'DUPLICATE_TRANSACTION'; throw e; }
      const current = cents(asNumber(account.balance));
      const delta = cents(amount);
      if (type === 'debit' && current < delta) { const e = new Error('Insufficient balance'); e.status = 422; e.code = 'INSUFFICIENT_BALANCE'; throw e; }
      const next = type === 'credit' ? current + delta : current - delta;
      account.balance = decimal(money(next));
      await account.save({ session });
      const [transaction] = await Transaction.create([{ account_id: accountId, type, amount: decimal(amount), description, reference_id: referenceId }], { session });
      created = transaction;
    });
    return created;
  } catch (error) {
    if (error.code === 11000) { const e = new Error('A transaction with this reference_id already exists for this account'); e.status = 409; e.code = 'DUPLICATE_TRANSACTION'; throw e; }
    throw error;
  } finally { await session.endSession(); }
}

async function transferMoney({ fromAccountId, toAccountId, amount, referenceId, description = 'Money transfer' }) {
  if (fromAccountId === toAccountId) { const e = new Error('Source and destination accounts must be different'); e.status = 400; e.code = 'SAME_ACCOUNT_TRANSFER'; throw e; }
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const existing = await Transfer.findOne({ reference_id: referenceId }).session(session);
      if (existing) { const e = new Error('A transfer with this reference_id already exists'); e.status = 409; e.code = 'DUPLICATE_TRANSFER'; throw e; }
      const ids = [fromAccountId, toAccountId];
      const accounts = await Account.find({ _id: { $in: ids } }).session(session);
      const from = accounts.find(a => a._id.toString() === fromAccountId);
      const to = accounts.find(a => a._id.toString() === toAccountId);
      if (!from || !to) { const e = new Error('Source account or destination account not found'); e.status = 404; e.code = 'ACCOUNT_NOT_FOUND'; throw e; }
      const amountCents = cents(amount);
      const fromCents = cents(asNumber(from.balance));
      if (fromCents < amountCents) { const e = new Error('Insufficient balance in source account'); e.status = 422; e.code = 'INSUFFICIENT_BALANCE'; throw e; }
      from.balance = decimal(money(fromCents - amountCents));
      to.balance = decimal(money(cents(asNumber(to.balance)) + amountCents));
      await from.save({ session }); await to.save({ session });
      const transferId = new mongoose.Types.ObjectId().toString();
      await Transaction.create([
        { account_id: from._id, type: 'debit', amount: decimal(amount), description, reference_id: `${referenceId}:debit`, transfer_id: transferId },
        { account_id: to._id, type: 'credit', amount: decimal(amount), description, reference_id: `${referenceId}:credit`, transfer_id: transferId }
      ], { session, ordered: true });
      await Transfer.create([{ reference_id: referenceId, from_account_id: from._id, to_account_id: to._id, amount: decimal(amount) }], { session });
      result = { transfer_id: transferId, reference_id: referenceId, from_account_id: fromAccountId, to_account_id: toAccountId, amount };
    });
    return result;
  } catch (error) {
    if (error.code === 11000) { const e = new Error('A transfer or transaction with this reference_id already exists'); e.status = 409; e.code = 'DUPLICATE_TRANSFER'; throw e; }
    throw error;
  } finally { await session.endSession(); }
}

module.exports = { createAccount, addTransaction, transferMoney };
