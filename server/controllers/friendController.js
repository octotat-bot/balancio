import Friend from '../models/Friend.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
// DirectExpense and DirectSettlement imported ONLY for cascade-delete in removeFriend.
// Do NOT use them in any read/write path — all new data flows through Group + Expense + Settlement.
import DirectExpense from '../models/DirectExpense.js';
import DirectSettlement from '../models/DirectSettlement.js';
import { normalizePhone } from '../utils/phone.js';
import { sendNotificationToUser, getIO } from '../socket/index.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
/**
 * Create (or retrieve) the linked 'direct' Group for a friendship.
 * IDEMPOTENT: safe to call multiple times or concurrently — only one Group
 * will ever be created per friendship, and the friendship.linkedGroup ref will
 * only be set once using a conditional findOneAndUpdate.
 *
 * Race safety guarantee:
 *   1. If friendship.linkedGroup is already set in memory → fast path, no writes.
 *   2. If another request already created a Group and saved the ref to the DB
 *      (but our in-memory doc is stale) → findOneAndUpdate with { linkedGroup: null }
 *      condition will fail to update, we reload and return the existing group.
 *   3. If we genuinely win the race → create Group, conditionally set ref;
 *      if the conditional update fails, clean up the duplicate group we created.
 *
 * @param {Object} friendship  Populated friendship doc (requester + recipient)
 * @returns {Promise<Object|null>}  The Group document, or null if recipient unregistered
 */
const ensureLinkedGroup = async (friendship) => {
    // Fast path: already linked in memory
    if (friendship.linkedGroup) {
        return Group.findById(friendship.linkedGroup);
    }

    if (!friendship.recipient) return null; // recipient not yet registered

    // --- Atomic check-then-set using a conditional update ---
    // Re-read the friendship from DB with a filter that only matches when
    // linkedGroup is still null. If another request beat us here, this resolves
    // to null and we fall through to reload.
    const alreadyLinked = await Friend.findOne({
        _id: friendship._id,
        linkedGroup: { $ne: null },
    }).select('linkedGroup');

    if (alreadyLinked?.linkedGroup) {
        // Another request created the group before us — reuse it
        friendship.linkedGroup = alreadyLinked.linkedGroup;
        return Group.findById(alreadyLinked.linkedGroup);
    }

    // Create the Group
    const group = await Group.create({
        name: `${friendship.requester.name} & ${friendship.recipient.name}`,
        description: 'Direct expenses between friends',
        icon: '👥',
        creator: friendship.requester._id,
        members: [friendship.requester._id, friendship.recipient._id],
        admins: [friendship.requester._id, friendship.recipient._id],
        isLinkedFriendshipGroup: true, // kept for backwards compat
        type: 'direct',               // new canonical field
    });

    // Conditionally update the friendship ref only if it is still null
    // (prevents overwriting a ref that another concurrent request just set)
    const updated = await Friend.findOneAndUpdate(
        { _id: friendship._id, linkedGroup: null },
        { linkedGroup: group._id },
        { new: true }
    );

    if (!updated) {
        // We lost the race — another request saved a different group first.
        // Clean up the duplicate we just created and return the winner's group.
        await Group.findByIdAndDelete(group._id);
        const reloaded = await Friend.findById(friendship._id).select('linkedGroup');
        friendship.linkedGroup = reloaded.linkedGroup;
        return Group.findById(reloaded.linkedGroup);
    }

    friendship.linkedGroup = group._id;
    return group;
};

// ─── Friend management ────────────────────────────────────────────────────────

export const addFriend = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const requesterId = req.user._id;

        if (!name || !phone) {
            return res.status(400).json({ message: 'Name and phone number are required' });
        }

        const cleanPhone = normalizePhone(phone);
        const userPhone  = normalizePhone(req.user.phone);

        if (userPhone === cleanPhone) {
            return res.status(400).json({ message: 'You cannot add yourself as a friend' });
        }

        const existingFriendship = await Friend.findOne({
            $or: [
                { requester: requesterId, recipientPhone: cleanPhone },
                { recipient: requesterId, recipientPhone: req.user.phone }
            ]
        });

        if (existingFriendship) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        const recipientUser = await User.findOne({ phone: cleanPhone });

        const friendship = new Friend({
            requester: requesterId,
            recipient: recipientUser?._id || null,
            recipientPhone: cleanPhone,
            recipientName: name,
            status: 'pending'
        });

        await friendship.save();
        await friendship.populate('requester', 'name email phone');
        if (recipientUser) {
            await friendship.populate('recipient', 'name email phone');

            sendNotificationToUser(recipientUser._id, 'friendRequest', {
                _id: friendship._id,
                requester: friendship.requester,
                notificationType: 'friendRequest'
            });
        }

        res.status(201).json({
            message: recipientUser
                ? 'Friend request sent!'
                : 'Friend added! They will see your request when they sign up.',
            friendship
        });
    } catch (error) {
        console.error('Add friend error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }
        res.status(500).json({ message: 'Failed to add friend' });
    }
};

export const getFriends = async (req, res) => {
    try {
        const userId    = req.user._id;
        const userPhone = normalizePhone(req.user.phone);

        const friendships = await Friend.find({
            $or: [
                { requester: userId },
                { recipient: userId },
                { recipientPhone: userPhone, status: 'pending' }
            ]
        })
            .populate('requester', 'name email phone')
            .populate('recipient', 'name email phone')
            .populate('linkedGroup')
            .sort({ createdAt: -1 });

        const pendingByPhone = await Friend.find({
            recipientPhone: { $in: [userPhone, req.user.phone] },
            status: 'pending',
            requester: { $ne: userId }
        })
            .populate('requester', 'name email phone')
            .populate('recipient', 'name email phone');

        const allFriendships = [...friendships];
        for (const pending of pendingByPhone) {
            if (!allFriendships.some(f => f._id.toString() === pending._id.toString())) {
                allFriendships.push(pending);
            }
        }

        const accepted        = [];
        const pendingReceived = [];
        const pendingSent     = [];

        for (const friendship of allFriendships) {
            if (friendship.status === 'accepted') {
                accepted.push(friendship);
            } else if (friendship.status === 'pending') {
                const recipientPhoneClean = normalizePhone(friendship.recipientPhone);
                const isRecipient =
                    recipientPhoneClean === userPhone ||
                    friendship.recipientPhone === req.user.phone ||
                    (friendship.recipient && friendship.recipient._id.toString() === userId.toString());

                if (isRecipient && friendship.requester._id.toString() !== userId.toString()) {
                    pendingReceived.push(friendship);
                } else if (friendship.requester._id.toString() === userId.toString()) {
                    pendingSent.push(friendship);
                }
            }
        }

        res.json({
            accepted,
            pendingReceived,
            pendingSent,
            totalFriends: accepted.length
        });
    } catch (error) {
        console.error('Fetch friends error:', error);
        res.status(500).json({ message: 'Failed to fetch friends' });
    }
};

export const getPendingRequests = async (req, res) => {
    try {
        const userId    = req.user._id;
        const userPhone = req.user.phone;

        const pendingRequests = await Friend.find({
            $or: [
                { recipient: userId, status: 'pending' },
                { recipientPhone: userPhone, recipient: null, status: 'pending' }
            ]
        })
            .populate('requester', 'name email phone')
            .sort({ createdAt: -1 });

        for (const request of pendingRequests) {
            if (!request.recipient && request.recipientPhone === userPhone) {
                request.recipient = userId;
                await request.save();
            }
        }

        res.json({ pendingRequests, count: pendingRequests.length });
    } catch (error) {
        console.error('Fetch pending requests error:', error);
        res.status(500).json({ message: 'Failed to fetch pending requests' });
    }
};

export const acceptFriend = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email phone')
            .populate('recipient', 'name email phone');

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        const userPhone           = normalizePhone(req.user.phone);
        const recipientPhoneClean = normalizePhone(friendship.recipientPhone);

        if (
            friendship.recipient?.toString() !== userId.toString() &&
            recipientPhoneClean !== userPhone
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        friendship.status     = 'accepted';
        friendship.recipient  = userId;
        friendship.acceptedAt = new Date();
        await friendship.save();

        // Reload with populated fields after save
        await friendship.populate('requester', 'name email phone');
        await friendship.populate('recipient', 'name email phone');

        // Auto-create the linked direct Group on acceptance
        await ensureLinkedGroup(friendship);

        sendNotificationToUser(friendship.requester._id, 'friendAccepted', {
            _id: friendship._id,
            friend: friendship.recipient,
            notificationType: 'friendAccepted'
        });

        res.json({ message: 'Friend request accepted!', friendship });
    } catch (error) {
        console.error('Accept friend error:', error);
        res.status(500).json({ message: 'Failed to accept friend request' });
    }
};

export const rejectFriend = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        if (
            friendship.recipient?.toString() !== userId.toString() &&
            friendship.recipientPhone !== req.user.phone
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        friendship.status = 'rejected';
        await friendship.save();

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject friend error:', error);
        res.status(500).json({ message: 'Failed to reject friend request' });
    }
};

export const removeFriend = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId).populate('linkedGroup');

        if (!friendship) {
            return res.status(404).json({ message: 'Friend not found' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Check outstanding balance via the linked Group's expenses
        if (friendship.linkedGroup) {
            const groupId = friendship.linkedGroup._id || friendship.linkedGroup;
            const friendId = friendship.requester.toString() === userId.toString()
                ? friendship.recipient
                : friendship.requester;

            const expenses    = await Expense.find({ group: groupId });
            const settlements = await Settlement.find({ group: groupId, confirmedByRecipient: true });

            let balance = 0;
            for (const exp of expenses) {
                const mySplit     = exp.splits.find(s => s.user?.toString() === userId.toString());
                const friendSplit = exp.splits.find(s => s.user?.toString() === friendId?.toString());
                if (exp.paidBy?.toString() === userId.toString()) {
                    balance += friendSplit?.amount || 0;
                } else if (exp.paidBy?.toString() === friendId?.toString()) {
                    balance -= mySplit?.amount || 0;
                }
            }
            for (const s of settlements) {
                if (s.from.toString() === userId.toString()) balance += s.amount;
                else if (s.to.toString() === userId.toString()) balance -= s.amount;
            }

            if (Math.abs(balance) > 0.01) {
                return res.status(400).json({
                    message: `Cannot remove friend with outstanding balance of $${Math.abs(balance).toFixed(2)}. Please settle up first.`,
                    balance
                });
            }
        }

        // Cascade delete legacy records (read-only models — safe to remove)
        await DirectExpense.deleteMany({ friendship: friendshipId });
        await DirectSettlement.deleteMany({ friendship: friendshipId });
        await Message.deleteMany({ friendship: friendshipId });
        await Friend.findByIdAndDelete(friendshipId);

        res.json({ message: 'Friend removed and all associated data cleaned up' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ message: 'Failed to remove friend' });
    }
};

// ─── Linked Group ─────────────────────────────────────────────────────────────

/**
 * POST /api/friends/:friendshipId/create-group
 *
 * Previously created a brand-new linked Group. Now it simply upgrades the
 * existing 'direct' Group to type:'group', allowing more members to be added.
 * If no linked group exists yet, it creates one (handles legacy friendships).
 */
export const createLinkedGroup = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email phone')
            .populate('recipient', 'name email phone');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (friendship.status !== 'accepted') {
            return res.status(400).json({ message: 'Friendship must be accepted first' });
        }

        if (!friendship.recipient) {
            return res.status(400).json({
                message: 'Friend not registered',
                detail: 'Your friend needs to sign up on Balncio before you can create expenses together.'
            });
        }

        // Ensure the linked group exists (creates it if missing)
        const group = await ensureLinkedGroup(friendship);

        if (!group) {
            return res.status(500).json({ message: 'Failed to create or retrieve linked group' });
        }

        // Upgrade from 'direct' to 'group' so more members can be added
        if (group.type !== 'group') {
            group.type = 'group';
            group.isLinkedFriendshipGroup = false; // no longer purely direct
            await group.save();
        }

        res.json({
            message: 'Expense group ready!',
            groupId: group._id,
            group
        });
    } catch (error) {
        console.error('Create linked group error:', error);
        res.status(500).json({ message: 'Failed to create expense group' });
    }
};

// ─── Direct Expenses (unified via Group + Expense) ────────────────────────────

/**
 * POST /api/friends/:friendshipId/expenses
 *
 * Creates an expense in the friendship's linked Group using the unified
 * Group + Expense pipeline. No new DirectExpense records are created.
 */
export const addDirectExpense = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { description, amount, splitType, payerShare, friendShare, category, notes, date } = req.body;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email phone')
            .populate('recipient', 'name email phone');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (friendship.status !== 'accepted') {
            return res.status(400).json({ message: 'Friendship must be accepted first' });
        }

        if (!friendship.recipient) {
            return res.status(400).json({
                message: 'Friend not registered',
                detail: 'Your friend needs to sign up on Balncio before you can add expenses.'
            });
        }

        // Ensure linked group exists
        const group = await ensureLinkedGroup(friendship);
        if (!group) {
            return res.status(500).json({ message: 'Could not create or find linked group' });
        }

        const totalAmount  = parseFloat(amount);
        const friendId     = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        // Compute splits server-side
        let payerAmt, friendAmt;
        if (splitType === 'dutch' || !splitType) {
            payerAmt  = Math.round((totalAmount / 2) * 100) / 100;
            friendAmt = Math.round((totalAmount - payerAmt) * 100) / 100;
        } else {
            // custom — accept client values but validate
            payerAmt  = Math.round(parseFloat(payerShare)  * 100) / 100;
            friendAmt = Math.round(parseFloat(friendShare) * 100) / 100;
            if (Math.abs(payerAmt + friendAmt - totalAmount) > 0.01) {
                return res.status(400).json({ message: 'Splits do not sum to expense total' });
            }
        }

        const splits = [
            { user: userId.toString(),     amount: payerAmt  },
            { user: friendId.toString(),   amount: friendAmt },
        ];

        const expense = await Expense.create({
            group: group._id,
            description,
            amount: totalAmount,
            paidBy: userId,
            splitType: splitType === 'dutch' ? 'equal' : 'unequal',
            splits,
            category: category || 'other',
            notes: notes || '',
            date: date || new Date(),
            createdBy: userId,
        });

        await expense.populate('paidBy', 'name email');
        await expense.populate('splits.user', 'name email');

        sendNotificationToUser(friendId, 'friendExpenseAdded', {
            friendshipId,
            expense,
            addedBy: req.user.name
        });

        res.status(201).json({ message: 'Expense added!', expense });
    } catch (error) {
        console.error('Add direct expense error:', error);
        res.status(500).json({ message: 'Failed to add expense' });
    }
};

/**
 * GET /api/friends/:friendshipId/expenses
 * Returns expenses from the linked Group (unified path).
 */
export const getDirectExpenses = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!friendship.linkedGroup) {
            return res.json({ expenses: [] });
        }

        const expenses = await Expense.find({ group: friendship.linkedGroup })
            .populate('paidBy', 'name email')
            .populate('splits.user', 'name email')
            .sort({ date: -1 });

        res.json({ expenses });
    } catch (error) {
        console.error('Get direct expenses error:', error);
        res.status(500).json({ message: 'Failed to get expenses' });
    }
};

/**
 * DELETE /api/friends/:friendshipId/expenses/:expenseId
 * Deletes an expense from the linked Group (unified path only).
 */
export const deleteDirectExpense = async (req, res) => {
    try {
        const { friendshipId, expenseId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!friendship.linkedGroup) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const expense = await Expense.findById(expenseId);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });
        if (expense.group.toString() !== friendship.linkedGroup.toString()) {
            return res.status(400).json({ message: 'Expense does not belong to this friendship' });
        }
        if (expense.paidBy?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the payer can delete this expense' });
        }
        await Expense.findByIdAndDelete(expenseId);

        res.json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Delete direct expense error:', error);
        res.status(500).json({ message: 'Failed to delete expense' });
    }
};

// ─── Direct Balance ────────────────────────────────────────────────────────────

/**
 * GET /api/friends/:friendshipId/direct-balance
 * Computes the net balance between two friends using the unified Group + Expense
 * + Settlement models. Returns zero balance if no linked group exists yet.
 */
export const getDirectBalance = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email')
            .populate('recipient', 'name email');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        let balance = 0;
        let youOwe  = 0;
        let theyOwe = 0;

        if (friendship.linkedGroup) {
            const groupExpenses    = await Expense.find({ group: friendship.linkedGroup });
            const groupSettlements = await Settlement.find({ group: friendship.linkedGroup, confirmedByRecipient: true });

            for (const exp of groupExpenses) {
                const mySplit     = exp.splits.find(s => s.user?.toString() === userId.toString());
                const friendSplit = exp.splits.find(s => s.user?.toString() === friendId.toString());

                if (!mySplit && !friendSplit) continue;

                if (exp.paidBy?.toString() === userId.toString()) {
                    balance += friendSplit?.amount || 0;
                } else if (exp.paidBy?.toString() === friendId.toString()) {
                    balance -= mySplit?.amount || 0;
                }
            }

            for (const s of groupSettlements) {
                if (s.from.toString() === userId.toString() && s.to.toString() === friendId.toString()) {
                    balance += s.amount;
                } else if (s.from.toString() === friendId.toString() && s.to.toString() === userId.toString()) {
                    balance -= s.amount;
                }
            }
        }
        // No linkedGroup → balance stays 0 (no data to compute from)

        balance = Math.round(balance * 100) / 100;
        if (balance > 0) {
            theyOwe = balance;
            youOwe  = 0;
        } else if (balance < 0) {
            youOwe  = Math.abs(balance);
            theyOwe = 0;
        }

        res.json({
            balance,
            youOwe,
            theyOwe,
            friend: friendship.requester._id.toString() === userId.toString()
                ? friendship.recipient
                : friendship.requester,
            totalExpenses: 0
        });
    } catch (error) {
        console.error('Get direct balance error:', error);
        res.status(500).json({ message: 'Failed to get balance' });
    }
};

// ─── getFriendBalance (legacy alias — kept for route compatibility) ────────────

export const getFriendBalance = async (req, res) => {
    // Delegate to the unified getDirectBalance handler
    return getDirectBalance(req, res);
};

// ─── Settle-up (deprecated simple flow — kept for backwards compat) ───────────

/**
 * POST /api/friends/:friendshipId/settle
 * Legacy settle-up shortcut. Creates a Settlement in the linked Group and
 * marks it as immediately confirmed (single-step).
 * NOTE: For the two-step flow, use POST /api/friends/:friendshipId/settlements
 */
export const settleFriendship = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { amount: partialAmount } = req.body;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email')
            .populate('recipient', 'name email');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const group = friendship.linkedGroup
            ? await Group.findById(friendship.linkedGroup)
            : null;

        if (!group) {
            return res.status(400).json({ message: 'No linked group found. Please create expenses first.' });
        }

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        // Compute current balance
        const expenses    = await Expense.find({ group: group._id });
        const settlements = await Settlement.find({ group: group._id, confirmedByRecipient: true });

        let balance = 0;
        for (const exp of expenses) {
            const mySplit     = exp.splits.find(s => s.user?.toString() === userId.toString());
            const friendSplit = exp.splits.find(s => s.user?.toString() === friendId.toString());
            if (exp.paidBy?.toString() === userId.toString()) {
                balance += friendSplit?.amount || 0;
            } else if (exp.paidBy?.toString() === friendId.toString()) {
                balance -= mySplit?.amount || 0;
            }
        }
        for (const s of settlements) {
            if (s.from.toString() === userId.toString()) balance += s.amount;
            else if (s.to.toString() === userId.toString()) balance -= s.amount;
        }

        if (Math.abs(balance) < 0.01) {
            return res.status(400).json({ message: 'Nothing to settle' });
        }

        const isPartial      = partialAmount && parseFloat(partialAmount) < Math.abs(balance);
        const settlementAmt  = isPartial ? parseFloat(partialAmount) : Math.abs(balance);

        if (partialAmount && parseFloat(partialAmount) > Math.abs(balance)) {
            return res.status(400).json({ message: 'Amount exceeds balance owed' });
        }

        const payer     = balance > 0 ? friendId  : userId;
        const recipient = balance > 0 ? userId    : friendId;

        // Create and immediately confirm a Settlement in the linked Group
        const settlement = await Settlement.create({
            group: group._id,
            from: payer,
            to: recipient,
            amount: settlementAmt,
            note: isPartial ? `Partial settlement (${settlementAmt})` : 'Settled up',
            confirmedByRecipient: true, // single-step: immediately confirmed
        });

        const io = getIO();
        if (io) {
            io.to(group._id.toString()).emit('settlement_confirmed', settlement);
        }

        res.json({
            message: isPartial ? `Partial payment of ${settlementAmt} recorded!` : 'All settled up!',
            settlement,
            isPartial,
        });
    } catch (error) {
        console.error('Settle friendship error:', error);
        res.status(500).json({ message: 'Failed to settle up' });
    }
};

// ─── Direct Settlements (two-step flow via unified Group + Settlement) ─────────

/**
 * POST /api/friends/:friendshipId/settlements
 * Creates a pending Settlement in the linked Group (two-step flow).
 */
export const createDirectSettlement = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { amount, note, isReceiverMarking } = req.body;
        const userId = req.user._id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name email')
            .populate('recipient', 'name email');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!friendship.recipient) {
            return res.status(400).json({
                message: 'Friend not registered',
                detail: 'Your friend needs to sign up on Balncio first.'
            });
        }

        const group = await ensureLinkedGroup(friendship);
        if (!group) {
            return res.status(500).json({ message: 'Could not create or find linked group' });
        }

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        let settlement;

        if (isReceiverMarking) {
            // Receiver marks that they already got paid → immediately confirmed
            settlement = await Settlement.create({
                group: group._id,
                from: friendId,
                to: userId,
                amount: parseFloat(amount),
                note: note || 'Payment received',
                confirmedByRecipient: true,
            });

            sendNotificationToUser(friendId, 'friendBalanceUpdated', {
                friendshipId,
                message: 'Balance updated',
            });

            const populated = await Settlement.findById(settlement._id)
                .populate('from', 'name')
                .populate('to', 'name');

            return res.status(201).json({
                message: 'Payment marked as received!',
                settlement: populated,
            });
        }

        // Sender marks that they paid → pending, awaiting receiver confirmation
        const existing = await Settlement.findOne({
            group: group._id,
            from: userId,
            to: friendId,
            confirmedByRecipient: false,
        });

        if (existing) {
            return res.status(409).json({
                message: 'There is already a pending payment awaiting confirmation. Please wait for the receiver to confirm or reject.',
                pendingSettlement: { amount: existing.amount, createdAt: existing.createdAt },
            });
        }

        settlement = await Settlement.create({
            group: group._id,
            from: userId,
            to: friendId,
            amount: parseFloat(amount),
            note: note || 'Payment sent',
            confirmedByRecipient: false,
        });

        const populated = await Settlement.findById(settlement._id)
            .populate('from', 'name')
            .populate('to', 'name');

        sendNotificationToUser(friendId, 'friendSettlement', {
            ...populated.toObject(),
            friendshipId,
            friendName: populated.from.name,
            notificationType: 'friendSettlement',
        });

        res.status(201).json({
            message: 'Payment sent! Awaiting confirmation',
            settlement: populated,
        });
    } catch (error) {
        console.error('Create direct settlement error:', error);
        res.status(500).json({ message: 'Failed to create settlement' });
    }
};

/**
 * GET /api/friends/:friendshipId/settlements
 */
export const getDirectSettlements = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!friendship.linkedGroup) {
            return res.json({ pending: [], confirmed: [], all: [] });
        }

        const settlements = await Settlement.find({ group: friendship.linkedGroup })
            .populate('from', 'name')
            .populate('to', 'name')
            .sort({ createdAt: -1 });

        const pending   = settlements.filter(s => !s.confirmedByRecipient);
        const confirmed = settlements.filter(s => s.confirmedByRecipient);

        res.json({ pending, confirmed, all: settlements });
    } catch (error) {
        console.error('Get direct settlements error:', error);
        res.status(500).json({ message: 'Failed to get settlements' });
    }
};

/**
 * POST /api/friends/:friendshipId/settlements/:settlementId/confirm
 */
export const confirmDirectSettlement = async (req, res) => {
    try {
        const { friendshipId, settlementId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (!friendship.linkedGroup) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        const settlement = await Settlement.findById(settlementId)
            .populate('from', 'name')
            .populate('to', 'name');

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        if (settlement.to._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the receiver can confirm this payment' });
        }

        if (settlement.confirmedByRecipient) {
            return res.status(400).json({ message: 'Already confirmed' });
        }

        settlement.confirmedByRecipient = true;
        await settlement.save();

        sendNotificationToUser(settlement.from._id, 'friendBalanceUpdated', {
            friendshipId,
            message: 'Payment confirmed',
        });

        const io = getIO();
        if (io) {
            io.to(friendship.linkedGroup.toString()).emit('settlement_confirmed', settlement);
        }

        res.json({ message: 'Payment confirmed!', settlement });
    } catch (error) {
        console.error('Confirm direct settlement error:', error);
        res.status(500).json({ message: 'Failed to confirm settlement' });
    }
};

/**
 * DELETE /api/friends/:friendshipId/settlements/:settlementId
 */
export const rejectDirectSettlement = async (req, res) => {
    try {
        const { friendshipId, settlementId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (!friendship.linkedGroup) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        const settlement = await Settlement.findById(settlementId);

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        if (settlement.to.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the receiver can reject this payment' });
        }

        if (settlement.confirmedByRecipient) {
            return res.status(400).json({ message: 'Cannot reject - already confirmed' });
        }

        await Settlement.findByIdAndDelete(settlementId);

        res.json({ message: 'Payment rejected' });
    } catch (error) {
        console.error('Reject direct settlement error:', error);
        res.status(500).json({ message: 'Failed to reject settlement' });
    }
};

// ─── Messaging ────────────────────────────────────────────────────────────────

export const getMessages = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const messages = await Message.find({ friendship: friendshipId })
            .populate('sender', 'name')
            .sort({ createdAt: 1 })
            .limit(100);

        await Message.updateMany(
            { friendship: friendshipId, sender: { $ne: userId }, read: false },
            { read: true }
        );

        res.json({ messages });
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        const friendship = await Friend.findById(friendshipId);
        if (!friendship || friendship.status !== 'accepted') {
            return res.status(404).json({ message: 'Friendship not found or not accepted' });
        }

        if (
            friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const message = new Message({
            friendship: friendshipId,
            sender: userId,
            content: content.trim()
        });

        await message.save();
        await message.populate('sender', 'name');

        res.status(201).json({ message });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        const friendships = await Friend.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        });

        const friendshipIds = friendships.map(f => f._id);

        const unreadCount = await Message.countDocuments({
            friendship: { $in: friendshipIds },
            sender: { $ne: userId },
            read: false
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
};
