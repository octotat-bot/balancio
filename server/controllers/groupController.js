import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import Settlement from '../models/Settlement.js';

export const createGroup = async (req, res, next) => {
    try {
        const { name, description, icon, members } = req.body;

        const group = await Group.create({
            name,
            description,
            icon,
            creator: req.userId,
            admins: [req.userId],
            members: [req.userId],
            pendingMembers: [],
        });

        if (members && members.length > 0) {
            for (const member of members) {
                const user = await User.findOne({ phone: member.phone });

                if (user) {
                    if (!group.members.includes(user._id)) {
                        group.members.push(user._id);
                    }
                } else {
                    group.pendingMembers.push({
                        name: member.name,
                        phone: member.phone,
                    });
                }
            }
            await group.save();
        }

        await group.populate('members', 'name email phone');
        await group.populate('creator', 'name email phone');
        await group.populate('admins', 'name email phone');

        if (req.io) {
            group.members.forEach(member => {
                req.io.to(`user_${member._id}`).emit('group_added', group);
            });
        }

        res.status(201).json({
            message: 'Group created successfully',
            group,
        });
    } catch (error) {
        next(error);
    }
};

export const getGroups = async (req, res, next) => {
    try {
        const groups = await Group.find({
            members: req.userId,
            isLinkedFriendshipGroup: { $ne: true }
        })
            .populate('members', 'name email')
            .populate('creator', 'name email')
            .sort({ updatedAt: -1 });

        const groupsWithBalances = await Promise.all(
            groups.map(async (group) => {
                const expenses = await Expense.find({ group: group._id }).populate('paidBy splits.user');
                const settlements = await Settlement.find({ group: group._id, confirmedByRecipient: true });

                let userBalance = 0;

                expenses.forEach((expense) => {
                    const isPayer = expense.paidBy._id.toString() === req.userId.toString();

                    if (isPayer) {
                        expense.splits.forEach((split) => {
                            if (split.user._id.toString() !== req.userId.toString()) {
                                userBalance += split.amount;
                            }
                        });
                    } else {
                        const mySplit = expense.splits.find(s => s.user._id.toString() === req.userId.toString());
                        if (mySplit) {
                            userBalance -= mySplit.amount;
                        }
                    }
                });

                settlements.forEach(settlement => {
                    const fromId = settlement.from.toString();
                    const toId = settlement.to.toString();
                    const myId = req.userId.toString();

                    if (fromId === myId) {
                        userBalance += settlement.amount;
                    } else if (toId === myId) {
                        userBalance -= settlement.amount;
                    }
                });

                return {
                    ...group.toObject(),
                    userBalance: Math.round(userBalance * 100) / 100,
                };
            })
        );

        res.json({ groups: groupsWithBalances });
    } catch (error) {
        next(error);
    }
};

export const getGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('members', 'name email phone')
            .populate('creator', 'name email phone')
            .populate('admins', 'name email phone');

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isMember = group.members.some((m) => m._id.toString() === req.userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        res.json({ group });
    } catch (error) {
        next(error);
    }
};

export const updateGroup = async (req, res, next) => {
    try {
        const { name, description, icon, isArchived } = req.body;

        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (group.creator.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: 'Only the creator can update this group' });
        }

        group.name = name || group.name;
        group.description = description !== undefined ? description : group.description;
        group.icon = icon || group.icon;
        group.isArchived = isArchived !== undefined ? isArchived : group.isArchived;

        await group.save();
        await group.populate('members', 'name email');

        res.json({ group });
    } catch (error) {
        next(error);
    }
};

export const deleteGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can delete this group' });
        }

        await Expense.deleteMany({ group: group._id });
        await Settlement.deleteMany({ group: group._id });

        await Group.findByIdAndDelete(req.params.groupId);

        res.json({ message: 'Group and all associated data deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const addMember = async (req, res, next) => {
    try {
        const { name, phone } = req.body;

        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        const user = await User.findOne({ phone });

        if (user) {
            if (group.members.includes(user._id)) {
                return res.status(400).json({ message: 'User is already a member' });
            }
            group.members.push(user._id);
        } else {
            const alreadyPending = group.pendingMembers.some(pm => pm.phone === phone);
            if (alreadyPending) {
                return res.status(400).json({ message: 'User is already a pending member' });
            }
            group.pendingMembers.push({ name, phone });
        }

        await group.save();
        await group.populate('members', 'name email phone');
        await group.populate('admins', 'name email phone');

        res.json({
            group,
            message: user ? 'Member added successfully' : 'Pending member added successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const removeMember = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can remove members' });
        }

        const memberId = req.params.memberId;
        const memberIndex = group.members.indexOf(memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Member not found in group' });
        }

        if (memberId === group.creator.toString()) {
            return res.status(400).json({ message: 'Cannot remove the group creator' });
        }

        const expenses = await Expense.find({ group: group._id }).populate('paidBy splits.user');
        const settlements = await Settlement.find({ group: group._id, confirmedByRecipient: true });

        let memberBalance = 0;

        expenses.forEach((expense) => {
            const isPayer = expense.paidBy._id.toString() === memberId;

            if (isPayer) {
                expense.splits.forEach((split) => {
                    if (split.user._id.toString() !== memberId) {
                        memberBalance += split.amount;
                    }
                });
            } else {
                const memberSplit = expense.splits.find(s => s.user._id.toString() === memberId);
                if (memberSplit) {
                    memberBalance -= memberSplit.amount;
                }
            }
        });

        settlements.forEach(settlement => {
            const fromId = settlement.from.toString();
            const toId = settlement.to.toString();

            if (fromId === memberId) {
                memberBalance += settlement.amount;
            } else if (toId === memberId) {
                memberBalance -= settlement.amount;
            }
        });

        memberBalance = Math.round(memberBalance * 100) / 100;

        if (Math.abs(memberBalance) > 0.01) {
            const status = memberBalance > 0 ? 'is owed' : 'owes';
            return res.status(400).json({
                message: `Cannot remove member who ${status} $${Math.abs(memberBalance).toFixed(2)}. Please settle up first.`,
                balance: memberBalance
            });
        }

        group.members.splice(memberIndex, 1);
        group.admins = group.admins.filter(adminId => adminId.toString() !== memberId);

        await group.save();
        await group.populate('members', 'name email phone');
        await group.populate('admins', 'name email phone');

        res.json({ group, message: 'Member removed successfully' });
    } catch (error) {
        next(error);
    }
};

export const promoteToAdmin = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can promote members' });
        }

        const memberId = req.params.memberId;

        const isMember = group.members.some(m => m.toString() === memberId);
        if (!isMember) {
            return res.status(404).json({ message: 'Member not found in group' });
        }

        const isAlreadyAdmin = group.admins.some(adminId => adminId.toString() === memberId);
        if (isAlreadyAdmin) {
            return res.status(400).json({ message: 'User is already an admin' });
        }

        group.admins.push(memberId);
        await group.save();
        await group.populate('members', 'name email phone');
        await group.populate('admins', 'name email phone');

        res.json({
            group,
            message: 'Member promoted to admin successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getExpenses = async (req, res, next) => {
    try {
        const expenses = await Expense.find({ group: req.params.groupId })
            .populate('paidBy', 'name email')
            .populate('splits.user', 'name email')
            .populate('createdBy', 'name email')
            .sort({ date: -1 });

        res.json({ expenses });
    } catch (error) {
        next(error);
    }
};

export const createExpense = async (req, res, next) => {
    try {
        const { description, amount, paidBy, category, date, splitType, splits, notes, items } = req.body;
        const { groupId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isMember = group.members.some((m) => m.toString() === req.userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        const finalPaidBy = isAdmin && paidBy ? paidBy : req.userId;

        const expense = await Expense.create({
            group: groupId,
            description,
            amount,
            paidBy: finalPaidBy,
            category,
            date: date || new Date(),
            splitType,
            splits,
            items: items || [],
            notes,
            createdBy: req.userId,
        });

        await expense.populate('paidBy', 'name email');
        await expense.populate('splits.user', 'name email');

        group.updatedAt = new Date();
        await group.save();

        let warning = null;
        if (group.budgets && group.budgets.length > 0) {
            const budget = group.budgets.find(b => b.category === category);
            if (budget) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const stats = await Expense.aggregate([
                    {
                        $match: {
                            group: new mongoose.Types.ObjectId(groupId),
                            category: category,
                            date: { $gte: startOfMonth }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$amount" }
                        }
                    }
                ]);

                const totalSpent = (stats[0]?.total || 0);

                if (totalSpent > budget.limit) {
                    warning = `Budget Alert: You've spent ${totalSpent} on ${category} this month (Limit: ${budget.limit})`;
                }
            }
        }

        if (req.io) {
            const populatedExpenseForSocket = await Expense.findById(expense._id)
                .populate('paidBy', 'name email')
                .populate('splits.user', 'name email');

            req.io.to(groupId).emit('expense_added', populatedExpenseForSocket);
            req.io.to(groupId).emit('group_update', { type: 'EXPENSE_ADDED', groupId, expense: populatedExpenseForSocket });
        }

        res.status(201).json({
            message: 'Expense added successfully',
            expense,
            warning
        });
    } catch (error) {
        next(error);
    }
};

export const updateExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.expenseId);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const group = await Group.findById(expense.group);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isCreator = expense.createdBy.toString() === req.userId.toString();
        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ message: 'Only the creator or an admin can update this expense' });
        }

        const { description, amount, paidBy, category, date, splitType, splits, notes, items } = req.body;

        expense.description = description || expense.description;
        expense.amount = amount || expense.amount;

        if (isAdmin && paidBy) {
            expense.paidBy = paidBy;
        }

        expense.category = category || expense.category;
        expense.date = date || expense.date;
        expense.splitType = splitType || expense.splitType;
        expense.splits = splits || expense.splits;
        expense.items = items || expense.items;
        expense.notes = notes !== undefined ? notes : expense.notes;

        await expense.save();
        await expense.populate('paidBy', 'name email');
        await expense.populate('splits.user', 'name email');

        res.json({ expense });

        if (req.io) {
            req.io.to(expense.group.toString()).emit('expense_updated', expense);
            req.io.to(expense.group.toString()).emit('group_update', { type: 'EXPENSE_UPDATED', groupId: expense.group, expense });
        }
    } catch (error) {
        next(error);
    }
};

export const deleteExpense = async (req, res, next) => {
    try {
        const { expenseId } = req.params;
        const expense = await Expense.findById(expenseId);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const group = await Group.findById(expense.group);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());

        if (expense.paidBy.toString() !== req.userId.toString() && !isAdmin) {
            return res.status(403).json({ message: 'Only the payer or an admin can delete this expense' });
        }

        await Expense.findByIdAndDelete(expenseId);

        if (req.io) {
            req.io.to(group._id.toString()).emit('expense_deleted', expenseId);
            req.io.to(group._id.toString()).emit('group_update', { type: 'EXPENSE_DELETED', groupId: group._id, expenseId });
        }

        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const exportGroupExpenses = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isMember = group.members.some(m => m.toString() === req.userId) || group.admins.some(a => a.toString() === req.userId);
        if (!isMember) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const expenses = await Expense.find({ group: groupId })
            .populate('paidBy', 'name')
            .populate('createdBy', 'name')
            .sort({ date: -1 });

        let csv = 'Date,Description,Category,Amount,Paid By,Created By,Split Type,Notes\n';

        expenses.forEach(expense => {
            const date = new Date(expense.date).toISOString().split('T')[0];
            const paidBy = expense.paidBy ? expense.paidBy.name : 'Unknown';
            const createdBy = expense.createdBy ? expense.createdBy.name : 'Unknown';
            const notes = expense.notes ? `"${expense.notes.replace(/"/g, '""')}"` : '';

            csv += `${date},"${expense.description}",${expense.category},${expense.amount},"${paidBy}","${createdBy}",${expense.splitType},${notes}\n`;
        });

        res.status(200).send(csv);

    } catch (error) {
        next(error);
    }
};

export const updateGroupBudgets = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { budgets } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(a => a.toString() === req.userId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can manage budgets' });
        }

        group.budgets = budgets;
        await group.save();

        res.json({ message: 'Budgets updated', group });
    } catch (error) {
        next(error);
    }
};
