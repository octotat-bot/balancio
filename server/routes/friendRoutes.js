import express from 'express';
import { auth } from '../middleware/auth.js';
import {
    addFriend,
    getFriends,
    getPendingRequests,
    acceptFriend,
    rejectFriend,
    removeFriend,
    getMessages,
    sendMessage,
    getUnreadCount,
    getFriendBalance,
    createLinkedGroup,
    addDirectExpense,
    getDirectExpenses,
    getDirectBalance,
    getAllFriendBalances,
    deleteDirectExpense,
    settleFriendship,
    createDirectSettlement,
    getDirectSettlements,
    confirmDirectSettlement,
    rejectDirectSettlement
} from '../controllers/friendController.js';

const router = express.Router();

router.use(auth);

router.post('/add', addFriend);
router.get('/', getFriends);
router.get('/balances', getAllFriendBalances);
router.get('/pending', getPendingRequests);
router.get('/unread', getUnreadCount);
router.post('/:friendshipId/accept', acceptFriend);
router.post('/:friendshipId/reject', rejectFriend);
router.delete('/:friendshipId', removeFriend);

router.post('/:friendshipId/expenses', addDirectExpense);
router.get('/:friendshipId/expenses', getDirectExpenses);
router.get('/:friendshipId/direct-balance', getDirectBalance);
router.delete('/:friendshipId/expenses/:expenseId', deleteDirectExpense);
router.post('/:friendshipId/settle', settleFriendship);

router.post('/:friendshipId/settlements', createDirectSettlement);
router.get('/:friendshipId/settlements', getDirectSettlements);
router.post('/:friendshipId/settlements/:settlementId/confirm', confirmDirectSettlement);
router.delete('/:friendshipId/settlements/:settlementId', rejectDirectSettlement);

router.get('/:friendshipId/balance', getFriendBalance);
router.post('/:friendshipId/create-group', createLinkedGroup);

router.get('/:friendshipId/messages', getMessages);
router.post('/:friendshipId/messages', sendMessage);

export default router;
