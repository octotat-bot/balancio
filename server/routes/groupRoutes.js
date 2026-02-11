import express from 'express';
import {
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    removePendingMember,
    promoteToAdmin,
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    exportGroupExpenses,
    updateGroupBudgets,
} from '../controllers/groupController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.route('/')
    .get(getGroups)
    .post(createGroup);

router.route('/:groupId')
    .get(getGroup)
    .put(updateGroup)
    .delete(deleteGroup);

router.get('/:groupId/export', exportGroupExpenses);

router.put('/:groupId/budgets', updateGroupBudgets);

router.post('/:groupId/members', addMember);
router.delete('/:groupId/members/:memberId', removeMember);
router.delete('/:groupId/pending-members/:pendingMemberId', removePendingMember);
router.put('/:groupId/members/:memberId/promote', promoteToAdmin);

router.route('/:groupId/expenses')
    .get(getExpenses)
    .post(createExpense);

router.route('/:groupId/expenses/:expenseId')
    .put(updateExpense)
    .delete(deleteExpense);

export default router;
