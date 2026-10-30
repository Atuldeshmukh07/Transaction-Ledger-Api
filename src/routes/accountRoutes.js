const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/accountController');
const router = express.Router();

router.post('/accounts', asyncHandler(controller.create));
router.get('/accounts/:accountId/balance', asyncHandler(controller.balance));
router.post('/accounts/:accountId/transactions', asyncHandler(controller.transaction));
router.get('/accounts/:accountId/transactions', asyncHandler(controller.history));
router.post('/transfers', asyncHandler(controller.transfer));
module.exports = router;
