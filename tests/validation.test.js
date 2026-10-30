process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../src/app');

describe('Transaction Ledger API request validation', () => {
  test('health endpoint responds with ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('account creation requires a name', async () => {
    const res = await request(app).post('/api/accounts').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('invalid account ID is rejected before database access', async () => {
    const res = await request(app).get('/api/accounts/not-an-id/balance');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ACCOUNT_ID');
  });

  test('invalid transaction type is rejected', async () => {
    const res = await request(app).post('/api/accounts/507f1f77bcf86cd799439011/transactions')
      .send({ type: 'transfer', amount: 10, reference_id: 'ref-1' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/credit or debit/);
  });

  test('invalid pagination is rejected', async () => {
    const res = await request(app).get('/api/accounts/507f1f77bcf86cd799439011/transactions?page=0&limit=10');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PAGINATION');
  });
});
