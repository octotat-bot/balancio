import mongoose from 'mongoose';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { sendNotificationToUser, getIO } from '../socket/index.js';
import { buildPairwiseMap, deriveSettlementEdges, computeMemberTotals } from '../utils/balanceCalculator.js';

export const getSettlements = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());

        let settlements;
        if (isAdmin) {
            settlements = await Settlement.find({ group: req.params.groupId })
                .populate('from', 'name email phone')
                .populate('to', 'name email phone')
                .sort({ createdAt: -1 });
        } else {
            settlements = await Settlement.find({
                group: req.params.groupId,
                $or: [
                    { from: req.userId },
                    { to: req.userId }
                ]
            })
                .populate('from', 'name email phone')
                .populate('to', 'name email phone')
                .sort({ createdAt: -1 });
        }

        res.json({ settlements, isAdmin });
    } catch (error) {
        next(error);
    }
};

export const createSettlement = async (req, res, next) => {
    // Use a MongoDB session/transaction to prevent race conditions on the
    // anti-collision check + insert.
    //
    // Session lifecycle:
    //   - `committed` flag tracks whether commitTransaction() succeeded.
    //   - `finally` always runs (even on early `return`), aborting the tx
    //     if it was never committed and ending the session unconditionally.
    //   - abort is wrapped in its own try/catch because calling it after the
    //     session has already been closed throws a harmless but noisy error.
    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    try {
        const { from, to, amount, note } = req.body;

        if (!from || !to || !amount) {
            return res.status(400).json({ message: 'From, to, and amount are required' });
        }

        if (from === to) {
            return res.status(400).json({ message: 'Cannot settle with yourself' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        const group = await Group.findById(req.params.groupId).session(session);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isMember = group.members.some(m => m.toString() === req.userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const isFromMember = group.members.some(m => m.toString() === from.toString());
        const isToMember   = group.members.some(m => m.toString() === to.toString());
        if (!isFromMember || !isToMember) {
            return res.status(400).json({ message: 'Both participants must be members of this group' });
        }

        // Anti-collision check inside the transaction — the unique index is a
        // second line of defence; this check gives a friendlier error message.
        const existing = await Settlement.findOne({
            group: req.params.groupId,
            from,
            to,
            confirmedByRecipient: false,
        }).session(session);

        if (existing) {
            return res.status(409).json({
                message: 'A pending settlement already exists between these users',
                pendingSettlement: {
                    amount: existing.amount,
                    createdAt: existing.createdAt,
                },
            });
        }

        const [settlement] = await Settlement.create(
            [{
                group: req.params.groupId,
                from,
                to,
                amount: parsedAmount,
                note,
                confirmedByRecipient: false,
            }],
            { session }
        );

        await session.commitTransaction();
        committed = true;
        // session ended in finally

        await settlement.populate('from', 'name email phone');
        await settlement.populate('to', 'name email phone');

        // Emit settlement_created (new event) + keep existing settlement_added
        const io = getIO();
        if (io) {
            io.to(req.params.groupId).emit('settlement_created', settlement);
            io.to(req.params.groupId).emit('settlement_added', settlement);
            io.to(req.params.groupId).emit('settlement_update', {
                type: 'SETTLEMENT_CREATED',
                groupId: req.params.groupId,
                settlement,
            });
        }

        sendNotificationToUser(to.toString(), 'groupSettlement', {
            _id: settlement._id,
            from: settlement.from,
            to: settlement.to,
            amount: settlement.amount,
            groupId: req.params.groupId,
            groupName: group.name,
            notificationType: 'groupSettlement',
        });

        res.status(201).json({
            message: 'Settlement recorded successfully',
            settlement,
        });
    } catch (error) {
        // Catch unique index violation (two concurrent requests that both pass
        // the findOne check before either can commit)
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'A pending settlement already exists between these users',
            });
        }
        next(error);
    } finally {
        // Always runs — even after early `return` inside try.
        // This guarantees no session is left open regardless of code path.
        if (!committed) {
            try {
                await session.abortTransaction();
            } catch (_) {
                // Swallow: session may already be in an aborted/closed state
            }
        }
        session.endSession();
    }
};


export const confirmSettlement = async (req, res, next) => {
    try {
        const settlement = await Settlement.findById(req.params.settlementId);

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        if (settlement.to.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: 'Only the recipient can confirm this settlement' });
        }

        settlement.confirmedByRecipient = true;
        await settlement.save();

        await settlement.populate('from', 'name email phone');
        await settlement.populate('to', 'name email phone');

        // Emit settlement_confirmed (new event) + keep existing settlement_confirmed room emit
        const io = getIO();
        if (io) {
            io.to(req.params.groupId).emit('settlement_confirmed', settlement);
            io.to(req.params.groupId).emit('settlement_update', {
                type: 'SETTLEMENT_CONFIRMED',
                groupId: req.params.groupId,
                settlement,
            });
        }

        res.json({
            message: 'Settlement confirmed',
            settlement,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteSettlement = async (req, res, next) => {
    try {
        const settlement = await Settlement.findById(req.params.settlementId);

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        const group = await Group.findById(settlement.group);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isPayer    = settlement.from.toString() === req.userId.toString();
        const isRecipient = settlement.to.toString() === req.userId.toString();
        const isAdmin    = group.admins.some(adminId => adminId.toString() === req.userId.toString());

        if (!isPayer && !isRecipient && !isAdmin) {
            return res.status(403).json({ message: 'Only the payer, recipient, or an admin can delete this settlement' });
        }

        await Settlement.findByIdAndDelete(req.params.settlementId);

        const io = getIO();
        if (io) {
            io.to(group._id.toString()).emit('settlement_deleted', req.params.settlementId);
            io.to(group._id.toString()).emit('settlement_update', {
                type: 'SETTLEMENT_DELETED',
                groupId: group._id,
                settlementId: req.params.settlementId,
            });
        }

        res.json({ message: 'Settlement deleted' });
    } catch (error) {
        next(error);
    }
};

export const getBalances = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('members', 'name email phone');

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin       = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        const shouldSimplify = req.query.simplify === 'true';

        // Fetch raw records
        const expenses    = await Expense.find({ group: req.params.groupId }).populate('paidBy', 'name');
        const settlements = await Settlement.find({ group: req.params.groupId, confirmedByRecipient: true })
            .populate('from', 'name')
            .populate('to', 'name');

        // Build member info lookup (registered + pending)
        const memberInfo = {};
        group.members.forEach(m => {
            memberInfo[m._id.toString()] = { _id: m._id, name: m.name, email: m.email, isPending: false };
        });
        (group.pendingMembers || []).forEach(pm => {
            memberInfo[pm._id.toString()] = { _id: pm._id, name: pm.name, phone: pm.phone, isPending: true };
        });

        // ── PHASE 1: build pairwise map ───────────────────────────────────────
        const pairwiseMap = buildPairwiseMap(expenses, settlements);

        // ── PHASE 2: derive settlement edges ─────────────────────────────────
        let settlementEdges = deriveSettlementEdges(pairwiseMap, memberInfo, shouldSimplify);

        // Derive per-member totals from the pairwise map
        const memberTotals = computeMemberTotals(pairwiseMap);

        // Build richly populated balances array (preserve existing response shape)
        const balances = Object.values(memberInfo).map(member => {
            const id = member._id.toString();
            const totals = memberTotals[id] || { paid: 0, owes: 0, balance: 0 };
            return {
                user: member,
                paid: totals.paid,
                owes: totals.owes,
                balance: totals.balance,
                isPending: member.isPending,
            };
        });

        // Filter debts for non-admin users to only show their own debts
        if (!isAdmin) {
            const myId = req.userId.toString();
            settlementEdges = settlementEdges.filter(
                edge =>
                    (edge.from._id || edge.from).toString() === myId ||
                    (edge.to._id   || edge.to).toString()   === myId
            );
        }

        res.json({
            balances,
            simplifiedDebts: settlementEdges,
            // detailedDebts kept for API shape compatibility — populated when
            // simplify=false using the same edge list
            detailedDebts: shouldSimplify ? [] : settlementEdges,
            isAdmin,
        });
    } catch (error) {
        next(error);
    }
};

export default {
    getSettlements,
    createSettlement,
    confirmSettlement,
    deleteSettlement,
    getBalances,
};
