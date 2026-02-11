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
                    // Skip expenses paid by pending members for current user balance calculation
                    // (pending members can't be the current user)
                    if (expense.paidByPending) {
                        // Check if current user is in the splits
                        const mySplit = expense.splits.find(s => 
                            s.user && (s.user._id?.toString() === req.userId.toString() || s.user.toString() === req.userId.toString())
                        );
                        if (mySplit) {
                            userBalance -= mySplit.amount;
                        }
                        return;
                    }
                    
                    // Handle regular expenses with paidBy
                    if (!expense.paidBy) return;
                    
                    const payerId = expense.paidBy._id?.toString() || expense.paidBy.toString();
                    const isPayer = payerId === req.userId.toString();

                    if (isPayer) {
                        expense.splits.forEach((split) => {
                            // Skip splits for pending members or if split.user is null
                            if (split.pendingMemberId || !split.user) return;
                            
                            const splitUserId = split.user._id?.toString() || split.user.toString();
                            if (splitUserId !== req.userId.toString()) {
                                userBalance += split.amount;
                            }
                        });
                    } else {
                        const mySplit = expense.splits.find(s => {
                            if (s.pendingMemberId || !s.user) return false;
                            const splitUserId = s.user._id?.toString() || s.user.toString();
                            return splitUserId === req.userId.toString();
                        });
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

        // Create a combined list of all members (registered + pending)
        const groupObj = group.toObject();
        
        // Transform registered members
        const registeredMembers = groupObj.members.map(m => ({
            ...m,
            isPending: false
        }));
        
        // Transform pending members to look like regular members
        const pendingMembersTransformed = (groupObj.pendingMembers || []).map(pm => ({
            _id: pm._id, // MongoDB auto-generates _id for subdocuments
            name: pm.name,
            phone: pm.phone,
            email: null,
            isPending: true,
            addedAt: pm.addedAt
        }));
        
        // Combined list for frontend convenience
        groupObj.allMembers = [...registeredMembers, ...pendingMembersTransformed];

        res.json({ group: groupObj });
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
            // Skip expenses paid by pending members
            if (expense.paidByPending) {
                // Check if member is in the splits
                const memberSplit = expense.splits.find(s => {
                    if (s.pendingMemberId || !s.user) return false;
                    const splitUserId = s.user._id?.toString() || s.user.toString();
                    return splitUserId === memberId;
                });
                if (memberSplit) {
                    memberBalance -= memberSplit.amount;
                }
                return;
            }
            
            // Handle regular expenses
            if (!expense.paidBy) return;
            
            const payerId = expense.paidBy._id?.toString() || expense.paidBy.toString();
            const isPayer = payerId === memberId;

            if (isPayer) {
                expense.splits.forEach((split) => {
                    if (split.pendingMemberId || !split.user) return;
                    const splitUserId = split.user._id?.toString() || split.user.toString();
                    if (splitUserId !== memberId) {
                        memberBalance += split.amount;
                    }
                });
            } else {
                const memberSplit = expense.splits.find(s => {
                    if (s.pendingMemberId || !s.user) return false;
                    const splitUserId = s.user._id?.toString() || s.user.toString();
                    return splitUserId === memberId;
                });
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

export const removePendingMember = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admins can remove pending members' });
        }

        const pendingMemberId = req.params.pendingMemberId;
        const pendingMemberIndex = group.pendingMembers.findIndex(
            pm => pm._id.toString() === pendingMemberId
        );
        
        if (pendingMemberIndex === -1) {
            return res.status(404).json({ message: 'Pending member not found in group' });
        }

        // Check if pending member has any expenses
        const expenses = await Expense.find({ group: group._id });
        let pendingMemberBalance = 0;

        expenses.forEach((expense) => {
            // Check if pending member paid
            if (expense.paidByPending && expense.paidByPending.toString() === pendingMemberId) {
                expense.splits.forEach((split) => {
                    if (split.pendingMemberId?.toString() !== pendingMemberId) {
                        pendingMemberBalance += split.amount;
                    }
                });
            }
            
            // Check if pending member is in splits
            const memberSplit = expense.splits.find(
                s => s.pendingMemberId?.toString() === pendingMemberId
            );
            if (memberSplit) {
                if (expense.paidByPending?.toString() !== pendingMemberId) {
                    pendingMemberBalance -= memberSplit.amount;
                }
            }
        });

        pendingMemberBalance = Math.round(pendingMemberBalance * 100) / 100;

        if (Math.abs(pendingMemberBalance) > 0.01) {
            const status = pendingMemberBalance > 0 ? 'is owed' : 'owes';
            return res.status(400).json({
                message: `Cannot remove pending member who ${status} $${Math.abs(pendingMemberBalance).toFixed(2)}. Please settle up first.`,
                balance: pendingMemberBalance
            });
        }

        // Remove from group
        group.pendingMembers.splice(pendingMemberIndex, 1);

        await group.save();
        await group.populate('members', 'name email phone');
        await group.populate('admins', 'name email phone');

        res.json({ group, message: 'Pending member removed successfully' });
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
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const expenses = await Expense.find({ group: req.params.groupId })
            .populate('paidBy', 'name email')
            .populate('splits.user', 'name email')
            .populate('createdBy', 'name email')
            .sort({ date: -1 });

        // Create a map of pending members for quick lookup
        const pendingMembersMap = {};
        (group.pendingMembers || []).forEach(pm => {
            pendingMembersMap[pm._id.toString()] = {
                _id: pm._id,
                name: pm.name,
                phone: pm.phone,
                isPending: true
            };
        });

        // Enrich expenses with pending member info
        const enrichedExpenses = expenses.map(expense => {
            const expenseObj = expense.toObject();
            
            // If paidByPending, add the pending member info
            if (expenseObj.paidByPending) {
                expenseObj.paidByPendingInfo = pendingMembersMap[expenseObj.paidByPending.toString()] || null;
            }

            // Enrich splits with pending member info
            if (expenseObj.splits) {
                expenseObj.splits = expenseObj.splits.map(split => {
                    if (split.pendingMemberId) {
                        split.pendingMemberInfo = pendingMembersMap[split.pendingMemberId.toString()] || null;
                    }
                    return split;
                });
            }

            // Enrich items with pending member info
            if (expenseObj.items) {
                expenseObj.items = expenseObj.items.map(item => {
                    if (item.involvedPending && item.involvedPending.length > 0) {
                        item.involvedPendingInfo = item.involvedPending.map(
                            pmId => pendingMembersMap[pmId.toString()] || null
                        ).filter(Boolean);
                    }
                    return item;
                });
            }

            return expenseObj;
        });

        res.json({ expenses: enrichedExpenses });
    } catch (error) {
        next(error);
    }
};

export const createExpense = async (req, res, next) => {
    try {
        const { description, amount, paidBy, paidByPending, category, date, splitType, splits, notes, items } = req.body;
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
        
        // Handle paidBy - can be a registered user or pending member
        let expenseData = {
            group: groupId,
            description,
            amount,
            category,
            date: date || new Date(),
            splitType,
            notes,
            createdBy: req.userId,
        };

        // If paidByPending is provided (pending member paid), use it
        if (paidByPending) {
            // Verify the pending member exists in this group
            const pendingMemberExists = group.pendingMembers.some(
                pm => pm._id.toString() === paidByPending
            );
            if (!pendingMemberExists) {
                return res.status(400).json({ message: 'Pending member not found in this group' });
            }
            expenseData.paidByPending = paidByPending;
        } else {
            // Regular user paid
            const finalPaidBy = isAdmin && paidBy ? paidBy : req.userId;
            expenseData.paidBy = finalPaidBy;
        }

        // Process splits - separate registered users from pending members
        const processedSplits = [];
        const processedItems = [];

        if (splits && splits.length > 0) {
            for (const split of splits) {
                if (split.pendingMemberId) {
                    // This is a pending member split
                    processedSplits.push({
                        pendingMemberId: split.pendingMemberId,
                        amount: split.amount
                    });
                } else if (split.user) {
                    // This is a registered user split
                    processedSplits.push({
                        user: split.user,
                        amount: split.amount
                    });
                }
            }
        }

        if (items && items.length > 0) {
            for (const item of items) {
                const processedItem = {
                    name: item.name,
                    amount: item.amount,
                    involved: item.involved || [],
                    involvedPending: item.involvedPending || []
                };
                processedItems.push(processedItem);
            }
        }

        expenseData.splits = processedSplits;
        expenseData.items = processedItems;

        const expense = await Expense.create(expenseData);

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
