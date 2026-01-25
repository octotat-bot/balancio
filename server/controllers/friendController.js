import Friend from '../models/Friend.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import DirectExpense from '../models/DirectExpense.js';
import DirectSettlement from '../models/DirectSettlement.js';
import { normalizePhone } from '../utils/phone.js';
import { sendNotificationToUser } from '../socket/index.js';

export const addFriend = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const requesterId = req.user._id;

        if (!name || !phone) {
            return res.status(400).json({ message: 'Name and phone number are required' });
        }

        const cleanPhone = normalizePhone(phone);
        const userPhone = normalizePhone(req.user.phone);

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
        const userId = req.user._id;
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

        const accepted = [];
        const pendingReceived = [];
        const pendingSent = [];

        for (const friendship of allFriendships) {
            if (friendship.status === 'accepted') {
                accepted.push(friendship);
            } else if (friendship.status === 'pending') {
                const recipientPhoneClean = normalizePhone(friendship.recipientPhone);
                const isRecipient = recipientPhoneClean === userPhone ||
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
        const userId = req.user._id;
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

        const friendship = await Friend.findById(friendshipId).populate('requester', 'name email phone');

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        const userPhone = normalizePhone(req.user.phone);
        const recipientPhoneClean = normalizePhone(friendship.recipientPhone);

        if (friendship.recipient?.toString() !== userId.toString() &&
            recipientPhoneClean !== userPhone) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        friendship.status = 'accepted';
        friendship.recipient = userId;
        friendship.acceptedAt = new Date();
        await friendship.save();

        await friendship.populate('requester', 'name email phone');
        await friendship.populate('recipient', 'name email phone');

        sendNotificationToUser(friendship.requester._id, 'friendAccepted', {
            _id: friendship._id,
            friend: friendship.recipient,
            notificationType: 'friendAccepted'
        });

        res.json({
            message: 'Friend request accepted!',
            friendship
        });
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

        if (friendship.recipient?.toString() !== userId.toString() &&
            friendship.recipientPhone !== req.user.phone) {
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

        const friendship = await Friend.findById(friendshipId);

        if (!friendship) {
            return res.status(404).json({ message: 'Friend not found' });
        }

        if (friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const expenses = await DirectExpense.find({ friendship: friendshipId, isSettled: false });

        if (expenses.length > 0) {
            let balance = 0;
            expenses.forEach(exp => {
                if (exp.paidBy.toString() === userId.toString()) {
                    balance += exp.friendShare;
                } else {
                    balance -= exp.payerShare;
                }
            });

            if (Math.abs(balance) > 0.01) {
                return res.status(400).json({
                    message: `Cannot remove friend with outstanding balance of $${Math.abs(balance).toFixed(2)}. Please settle up first.`,
                    balance: balance
                });
            }
        }

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

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (friendship.linkedGroup) {
            return res.json({
                message: 'Linked group already exists',
                groupId: friendship.linkedGroup
            });
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

        const group = new Group({
            name: `${friendship.requester.name} & ${friendship.recipient.name}`,
            description: 'Direct expenses between friends',
            icon: '👥',
            creator: friendship.requester._id,
            members: [friendship.requester._id, friendship.recipient._id],
            admins: [friendship.requester._id, friendship.recipient._id],
            isLinkedFriendshipGroup: true
        });

        await group.save();

        friendship.linkedGroup = group._id;
        await friendship.save();

        res.json({
            message: 'Expense group created!',
            groupId: group._id,
            group
        });
    } catch (error) {
        console.error('Create linked group error:', error);
        res.status(500).json({ message: 'Failed to create expense group' });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()) {
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

        if (friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()) {
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

export const getFriendBalance = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name')
            .populate('recipient', 'name')
            .populate('linkedGroup');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!friendship.linkedGroup) {
            return res.json({ balance: 0, expenses: [] });
        }

        const Expense = (await import('../models/Expense.js')).default;
        const expenses = await Expense.find({ group: friendship.linkedGroup._id })
            .populate('paidBy', 'name')
            .sort({ date: -1 })
            .limit(20);

        let balance = 0;
        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        for (const expense of expenses) {
            const userSplit = expense.splits.find(s => s.user.toString() === userId.toString());
            const friendSplit = expense.splits.find(s => s.user.toString() === friendId.toString());

            if (expense.paidBy._id.toString() === userId.toString()) {
                balance += friendSplit?.amount || 0;
            } else if (expense.paidBy._id.toString() === friendId.toString()) {
                balance -= userSplit?.amount || 0;
            }
        }

        res.json({
            balance,
            expenses,
            linkedGroupId: friendship.linkedGroup._id,
            friend: friendship.requester._id.toString() === userId.toString()
                ? friendship.recipient
                : friendship.requester
        });
    } catch (error) {
        console.error('Get friend balance error:', error);
        res.status(500).json({ message: 'Failed to get friend balance' });
    }
};

export const addDirectExpense = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { description, amount, splitType, payerShare, friendShare, category, notes, date } = req.body;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name')
            .populate('recipient', 'name');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (friendship.status !== 'accepted') {
            return res.status(400).json({ message: 'Friendship must be accepted first' });
        }

        let calculatedPayerShare = payerShare;
        let calculatedFriendShare = friendShare;

        if (splitType === 'dutch') {
            calculatedPayerShare = amount / 2;
            calculatedFriendShare = amount / 2;
        }

        const expense = new DirectExpense({
            friendship: friendshipId,
            description,
            amount,
            paidBy: userId,
            splitType: splitType || 'dutch',
            payerShare: calculatedPayerShare,
            friendShare: calculatedFriendShare,
            category: category || 'General',
            notes: notes || '',
            date: date || new Date()
        });

        await expense.save();
        await expense.populate('paidBy', 'name');

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        sendNotificationToUser(friendId, 'friendExpenseAdded', {
            friendshipId: friendshipId,
            expense: expense,
            addedBy: req.user.name
        });

        res.status(201).json({
            message: 'Expense added!',
            expense
        });
    } catch (error) {
        console.error('Add direct expense error:', error);
        res.status(500).json({ message: 'Failed to add expense' });
    }
};

export const getDirectExpenses = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        let expenses = [];
        if (friendship.linkedGroup) {
            expenses = await (await import('../models/Expense.js')).default.find({ group: friendship.linkedGroup })
                .populate('paidBy', 'name')
                .populate('splits.user', 'name')
                .sort({ date: -1 });
        } else {
            expenses = await DirectExpense.find({ friendship: friendshipId })
                .populate('paidBy', 'name')
                .sort({ date: -1 });
        }

        res.json({ expenses });
    } catch (error) {
        console.error('Get direct expenses error:', error);
        res.status(500).json({ message: 'Failed to get expenses' });
    }
};

export const getDirectBalance = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name')
            .populate('recipient', 'name');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        let balance = 0;
        let youOwe = 0;
        let theyOwe = 0;

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        if (friendship.linkedGroup) {
            const Expense = (await import('../models/Expense.js')).default;
            const Settlement = (await import('../models/Settlement.js')).default;

            const groupExpenses = await Expense.find({ group: friendship.linkedGroup });
            const groupSettlements = await Settlement.find({ group: friendship.linkedGroup, confirmedByRecipient: true });

            for (const expense of groupExpenses) {
                const mySplit = expense.splits.find(s => s.user.toString() === userId.toString());
                const friendSplit = expense.splits.find(s => s.user.toString() === friendId.toString());

                if (!mySplit && !friendSplit) continue;

                if (expense.paidBy.toString() === userId.toString()) {
                    if (friendSplit) {
                        balance += friendSplit.amount;
                        theyOwe += friendSplit.amount;
                    }
                } else if (expense.paidBy.toString() === friendId.toString()) {
                    if (mySplit) {
                        balance -= mySplit.amount;
                        youOwe += mySplit.amount;
                    }
                }
            }

            for (const settlement of groupSettlements) {
                if (settlement.from.toString() === userId.toString() && settlement.to.toString() === friendId.toString()) {
                    balance += settlement.amount;
                } else if (settlement.from.toString() === friendId.toString() && settlement.to.toString() === userId.toString()) {
                    balance -= settlement.amount;
                }
            }

            if (balance > 0) {
                theyOwe = balance;
                youOwe = 0;
            } else {
                youOwe = Math.abs(balance);
                theyOwe = 0;
            }

        } else {
            const DirectSettlement = (await import('../models/DirectSettlement.js')).default;

            const expenses = await DirectExpense.find({
                friendship: friendshipId,
                isSettled: false
            });

            for (const expense of expenses) {
                if (expense.paidBy.toString() === userId.toString()) {
                    theyOwe += expense.friendShare;
                    balance += expense.friendShare;
                } else {
                    youOwe += expense.friendShare;
                    balance -= expense.friendShare;
                }
            }

            const settlements = await DirectSettlement.find({
                friendship: friendshipId,
                confirmedByRecipient: true
            });

            for (const settlement of settlements) {
                if (settlement.from.toString() === userId.toString()) {
                    balance += settlement.amount;
                } else {
                    balance -= settlement.amount;
                }
            }

            if (balance > 0) {
                theyOwe = balance;
                youOwe = 0;
            } else if (balance < 0) {
                youOwe = Math.abs(balance);
                theyOwe = 0;
            } else {
                youOwe = 0;
                theyOwe = 0;
            }
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

export const deleteDirectExpense = async (req, res) => {
    try {
        const { friendshipId, expenseId } = req.params;
        const userId = req.user._id;

        const expense = await DirectExpense.findById(expenseId);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.friendship.toString() !== friendshipId) {
            return res.status(400).json({ message: 'Expense does not belong to this friendship' });
        }

        if (expense.paidBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the payer can delete this expense' });
        }

        await DirectExpense.findByIdAndDelete(expenseId);

        res.json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Delete direct expense error:', error);
        res.status(500).json({ message: 'Failed to delete expense' });
    }
};

export const settleFriendship = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { amount: partialAmount } = req.body;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name')
            .populate('recipient', 'name');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const expenses = await DirectExpense.find({
            friendship: friendshipId,
            isSettled: false
        });

        let balance = 0;
        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        for (const expense of expenses) {
            if (expense.paidBy.toString() === userId.toString()) {
                balance += expense.friendShare;
            } else {
                balance -= expense.friendShare;
            }
        }

        if (Math.abs(balance) < 0.01) {
            return res.status(400).json({ message: 'Nothing to settle' });
        }

        const isPartial = partialAmount && partialAmount < Math.abs(balance);
        const settlementAmount = isPartial ? parseFloat(partialAmount) : Math.abs(balance);

        if (partialAmount && partialAmount > Math.abs(balance)) {
            return res.status(400).json({ message: 'Amount exceeds balance owed' });
        }

        let payer, recipient;
        if (balance > 0) {
            payer = friendId;
            recipient = userId;
        } else {
            payer = userId;
            recipient = friendId;
        }

        const settlement = new DirectExpense({
            friendship: friendshipId,
            description: isPartial ? `Partial Settlement (₹${settlementAmount})` : 'Settlement',
            amount: settlementAmount,
            paidBy: payer,
            splitType: 'custom',
            payerShare: 0,
            friendShare: settlementAmount,
            category: 'Settlement',
            date: new Date(),
            isSettled: true
        });

        await settlement.save();

        if (!isPartial) {
            await DirectExpense.updateMany(
                { friendship: friendshipId, isSettled: false, _id: { $ne: settlement._id } },
                { isSettled: true }
            )
        }

        res.json({
            message: isPartial ? `Partial payment of ₹${settlementAmount} recorded!` : 'All settled up!',
            settlement,
            isPartial
        });

    } catch (error) {
        console.error('Settle friendship error:', error);
        res.status(500).json({ message: 'Failed to settle up' });
    }
};

export const createDirectSettlement = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const { amount, note, isReceiverMarking } = req.body;
        const userId = req.user._id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const friendship = await Friend.findById(friendshipId)
            .populate('requester', 'name')
            .populate('recipient', 'name');

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester._id.toString() !== userId.toString() &&
            friendship.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const friendId = friendship.requester._id.toString() === userId.toString()
            ? friendship.recipient._id
            : friendship.requester._id;

        let settlement;

        if (isReceiverMarking) {
            settlement = new DirectSettlement({
                friendship: friendshipId,
                from: friendId,
                to: userId,
                amount: parseFloat(amount),
                note: note || 'Payment received',
                confirmedByRecipient: true
            });

            await settlement.save();

            const populatedSettlement = await DirectSettlement.findById(settlement._id)
                .populate('from', 'name')
                .populate('to', 'name');

            sendNotificationToUser(friendId, 'friendBalanceUpdated', {
                friendshipId: friendshipId,
                message: 'Balance updated'
            });

            res.status(201).json({
                message: 'Payment marked as received!',
                settlement: populatedSettlement
            });
        } else {
            const pendingSettlement = await DirectSettlement.findOne({
                friendship: friendshipId,
                confirmedByRecipient: false
            });

            if (pendingSettlement) {
                return res.status(400).json({
                    message: 'There is already a pending payment awaiting confirmation. Please wait for the receiver to confirm or reject before creating a new payment.',
                    pendingSettlement: {
                        amount: pendingSettlement.amount,
                        createdAt: pendingSettlement.createdAt
                    }
                });
            }

            settlement = new DirectSettlement({
                friendship: friendshipId,
                from: userId,
                to: friendId,
                amount: parseFloat(amount),
                note: note || 'Payment sent',
                confirmedByRecipient: false
            });

            await settlement.save();

            const populatedSettlement = await DirectSettlement.findById(settlement._id)
                .populate('from', 'name')
                .populate('to', 'name');

            sendNotificationToUser(friendId, 'friendSettlement', {
                ...populatedSettlement.toObject(),
                friendshipId: friendshipId,
                friendName: populatedSettlement.from.name,
                notificationType: 'friendSettlement'
            });

            res.status(201).json({
                message: 'Payment sent! Awaiting confirmation',
                settlement: populatedSettlement
            });
        }

    } catch (error) {
        console.error('Create direct settlement error:', error);
        res.status(500).json({ message: 'Failed to create settlement' });
    }
};

export const getDirectSettlements = async (req, res) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user._id;

        const friendship = await Friend.findById(friendshipId);
        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        if (friendship.requester.toString() !== userId.toString() &&
            friendship.recipient?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const settlements = await DirectSettlement.find({ friendship: friendshipId })
            .populate('from', 'name')
            .populate('to', 'name')
            .sort({ createdAt: -1 });

        const pending = settlements.filter(s => !s.confirmedByRecipient);
        const confirmed = settlements.filter(s => s.confirmedByRecipient);

        res.json({ pending, confirmed, all: settlements });

    } catch (error) {
        console.error('Get direct settlements error:', error);
        res.status(500).json({ message: 'Failed to get settlements' });
    }
};

export const confirmDirectSettlement = async (req, res) => {
    try {
        const { friendshipId, settlementId } = req.params;
        const userId = req.user._id;

        const settlement = await DirectSettlement.findById(settlementId)
            .populate('from', 'name')
            .populate('to', 'name');

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        if (settlement.friendship.toString() !== friendshipId) {
            return res.status(400).json({ message: 'Settlement does not belong to this friendship' });
        }

        if (settlement.to._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the receiver can confirm this payment' });
        }

        if (settlement.confirmedByRecipient) {
            return res.status(400).json({ message: 'Already confirmed' });
        }

        settlement.confirmedByRecipient = true;
        await settlement.save();

        const expense = new DirectExpense({
            friendship: friendshipId,
            description: `Settlement: ${settlement.note || 'Payment confirmed'}`,
            amount: settlement.amount,
            paidBy: settlement.from._id,
            splitType: 'custom',
            payerShare: 0,
            friendShare: settlement.amount,
            category: 'Settlement',
            date: new Date(),
            isSettled: true
        });
        await expense.save();

        sendNotificationToUser(settlement.from._id, 'friendBalanceUpdated', {
            friendshipId: friendshipId,
            message: 'Payment confirmed'
        });

        res.json({
            message: 'Payment confirmed!',
            settlement
        });

    } catch (error) {
        console.error('Confirm direct settlement error:', error);
        res.status(500).json({ message: 'Failed to confirm settlement' });
    }
};

export const rejectDirectSettlement = async (req, res) => {
    try {
        const { friendshipId, settlementId } = req.params;
        const userId = req.user._id;

        const settlement = await DirectSettlement.findById(settlementId);

        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        if (settlement.friendship.toString() !== friendshipId) {
            return res.status(400).json({ message: 'Settlement does not belong to this friendship' });
        }

        if (settlement.to.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the receiver can reject this payment' });
        }

        if (settlement.confirmedByRecipient) {
            return res.status(400).json({ message: 'Cannot reject - already confirmed' });
        }

        await DirectSettlement.findByIdAndDelete(settlementId);

        res.json({ message: 'Payment rejected' });

    } catch (error) {
        console.error('Reject direct settlement error:', error);
        res.status(500).json({ message: 'Failed to reject settlement' });
    }
};
