import express from 'express';
import {
    getSettlements,
    createSettlement,
    confirmSettlement,
    deleteSettlement,
    getBalances,
    getGlobalSummary,
} from '../controllers/settlementController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/global/summary', getGlobalSummary);

router.get('/:groupId/settlements', getSettlements);
router.post('/:groupId/settlements', createSettlement);
router.put('/:groupId/settlements/:settlementId/confirm', confirmSettlement);
router.delete('/:groupId/settlements/:settlementId', deleteSettlement);

router.get('/:groupId/balances', getBalances);

export default router;
