
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');

let mongo;
let senderId;
let receiverId;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 }
  });

  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;

  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }

  const sender = await request(app)
    .post('/api/accounts')
    .send({ name: 'Test Sender' });

  const receiver = await request(app)
    .post('/api/accounts')
    .send({ name: 'Test Receiver' });

  expect(sender.status).toBe(201);
  expect(receiver.status).toBe(201);

  senderId = sender.body.data.id;
  receiverId = receiver.body.data.id;
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongo) {
    await mongo.stop();
  }
});

describe('Ledger integration tests', () => {
  test('new accounts start with zero balance', async () => {
    const response = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    expect(response.status).toBe(200);
    expect(response.body.data.balance).toBe(0);
  });

  test('credit increases the account balance', async () => {
    const transaction = await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send({
        type: 'credit',
        amount: 1000,
        reference_id: 'credit-001'
      });

    expect(transaction.status).toBe(201);

    const balance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    expect(balance.body.data.balance).toBe(1000);
  });

  test('debit decreases the account balance', async () => {
    await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send({
        type: 'credit',
        amount: 1000,
        reference_id: 'credit-for-debit'
      });

    const debit = await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send({
        type: 'debit',
        amount: 300,
        reference_id: 'debit-001'
      });

    expect(debit.status).toBe(201);

    const balance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    expect(balance.body.data.balance).toBe(700);
  });

  test('duplicate reference is rejected without changing balance', async () => {
    const payload = {
      type: 'credit',
      amount: 100,
      reference_id: 'duplicate-001'
    };

    const first = await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send(payload);

    const duplicate = await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send(payload);

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);

    const balance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    expect(balance.body.data.balance).toBe(100);
  });

  test('insufficient debit leaves balance unchanged', async () => {
    const debit = await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send({
        type: 'debit',
        amount: 100,
        reference_id: 'insufficient-001'
      });

    expect(debit.status).toBe(422);

    const balance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    expect(balance.body.data.balance).toBe(0);
  });

  test('transfer updates both balances', async () => {
    await request(app)
      .post(`/api/accounts/${senderId}/transactions`)
      .send({
        type: 'credit',
        amount: 500,
        reference_id: 'transfer-funding-001'
      });

    const transfer = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: senderId,
        to_account_id: receiverId,
        amount: 200,
        reference_id: 'transfer-001'
      });

    expect(transfer.status).toBe(201);

    const senderBalance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    const receiverBalance = await request(app)
      .get(`/api/accounts/${receiverId}/balance`);

    expect(senderBalance.body.data.balance).toBe(300);
    expect(receiverBalance.body.data.balance).toBe(200);
  });

  test('failed transfer leaves both balances unchanged', async () => {
    const transfer = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: senderId,
        to_account_id: receiverId,
        amount: 100,
        reference_id: 'transfer-fail-001'
      });

    expect(transfer.status).toBe(422);

    const senderBalance = await request(app)
      .get(`/api/accounts/${senderId}/balance`);

    const receiverBalance = await request(app)
      .get(`/api/accounts/${receiverId}/balance`);

    expect(senderBalance.body.data.balance).toBe(0);
    expect(receiverBalance.body.data.balance).toBe(0);
  });
});
