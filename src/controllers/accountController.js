
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const {
  createAccount,
  addTransaction,
  transferMoney
} = require('../services/ledgerService');
const { parseAmount } = require('../utils/money');

const validId = id => mongoose.isValidObjectId(id);

async function create(req, res) {
  const name = req.body?.name;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name is required and must be a non-empty string'
      }
    });
  }

  const account = await createAccount(name);
  return res.status(201).json({ data: account.toJSON() });
}

async function balance(req, res) {
  if (!validId(req.params.accountId)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ACCOUNT_ID',
        message: 'Invalid account ID'
      }
    });
  }

  const account = await Account.findById(req.params.accountId);

  if (!account) {
    return res.status(404).json({
      error: {
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found'
      }
    });
  }

  return res.json({
    data: {
      account_id: account.id,
      balance: Number(account.balance.toString())
    }
  });
}

async function transaction(req, res) {
  const {
    type,
    amount,
    description = '',
    reference_id: referenceId
  } = req.body || {};

  if (!validId(req.params.accountId)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ACCOUNT_ID',
        message: 'Invalid account ID'
      }
    });
  }

  if (!['credit', 'debit'].includes(type)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'type must be either credit or debit'
      }
    });
  }

  const parsed = parseAmount(amount);

  if (parsed === null) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'amount must be greater than 0 and have at most 2 decimal places'
      }
    });
  }

  if (typeof referenceId !== 'string' || !referenceId.trim()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'reference_id is required'
      }
    });
  }

  if (typeof description !== 'string') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'description must be a string'
      }
    });
  }

  const created = await addTransaction({
    accountId: req.params.accountId,
    type,
    amount: parsed,
    description,
    referenceId: referenceId.trim()
  });

  return res.status(201).json({ data: created.toJSON() });
}

async function history(req, res) {
  const { accountId } = req.params;

  // 1. Validate account ID first
  if (!validId(accountId)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ACCOUNT_ID',
        message: 'Invalid account ID'
      }
    });
  }

  // 2. Validate transaction type before database access
  const type = req.query.type;

  if (type !== undefined && !['credit', 'debit'].includes(type)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'type must be credit or debit'
      }
    });
  }

  // 3. Validate pagination before database access
  const page = req.query.page === undefined
    ? 1
    : Number(req.query.page);

  const limit = req.query.limit === undefined
    ? 10
    : Number(req.query.limit);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PAGINATION',
        message: 'page must be >= 1 and limit must be between 1 and 100'
      }
    });
  }

  // 4. Query database only after request validation passes
  const account = await Account.findById(accountId).select('_id');

  if (!account) {
    return res.status(404).json({
      error: {
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found'
      }
    });
  }

  const filter = { account_id: accountId };

  if (type) {
    filter.type = type;
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter)
  ]);

  return res.json({
    data: transactions.map(t => t.toJSON()),
    pagination: {
      current_page: page,
      page_size: limit,
      total_records: total,
      total_pages: Math.ceil(total / limit)
    }
  });
}

async function transfer(req, res) {
  const {
    from_account_id: from,
    to_account_id: to,
    amount,
    reference_id: referenceId,
    description = 'Money transfer'
  } = req.body || {};

  if (!validId(from) || !validId(to)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Valid from_account_id and to_account_id are required'
      }
    });
  }

  const parsed = parseAmount(amount);

  if (parsed === null) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'amount must be greater than 0 and have at most 2 decimal places'
      }
    });
  }

  if (typeof referenceId !== 'string' || !referenceId.trim()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'reference_id is required'
      }
    });
  }

  if (typeof description !== 'string') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'description must be a string'
      }
    });
  }

  const result = await transferMoney({
    fromAccountId: from,
    toAccountId: to,
    amount: parsed,
    referenceId: referenceId.trim(),
    description
  });

  return res.status(201).json({ data: result });
}

module.exports = {
  create,
  balance,
  transaction,
  history,
  transfer
};
