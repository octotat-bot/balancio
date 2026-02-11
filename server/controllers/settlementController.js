import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { sendNotificationToUser } from '../socket/index.js';

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
    try {
        const { from, to, amount, note } = req.body;

        if (!from || !to || !amount) {
            return res.status(400).json({ message: 'From, to, and amount are required' });
        }

        if (from === to) {
            return res.status(400).json({ message: 'Cannot settle with yourself' });
        }

        // Validate amount is a positive number
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const isMember = group.members.some(m => m.toString() === req.userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        // Validate that both from and to are members of the group
        const isFromMember = group.members.some(m => m.toString() === from.toString());
        const isToMember = group.members.some(m => m.toString() === to.toString());
        if (!isFromMember || !isToMember) {
            return res.status(400).json({ message: 'Both participants must be members of this group' });
        }

        // Check if there's already a pending settlement between the same users
        const existingPendingSettlement = await Settlement.findOne({
            group: req.params.groupId,
            from,
            to,
            confirmedByRecipient: false
        });

        if (existingPendingSettlement) {
            return res.status(400).json({
                message: 'There is already a pending payment between these users. Please wait for confirmation before creating another.',
                pendingSettlement: {
                    amount: existingPendingSettlement.amount,
                    createdAt: existingPendingSettlement.createdAt
                }
            });
        }

        const settlement = await Settlement.create({
            group: req.params.groupId,
            from,
            to,
            amount: parseFloat(amount),
            note,
            confirmedByRecipient: false,
        });

        await settlement.populate('from', 'name email phone');
        await settlement.populate('to', 'name email phone');

        if (req.io) {
            req.io.to(req.params.groupId).emit('settlement_added', settlement);
            req.io.to(req.params.groupId).emit('settlement_update', { type: 'SETTLEMENT_CREATED', groupId: req.params.groupId, settlement });
        }

        sendNotificationToUser(to.toString(), 'groupSettlement', {
            _id: settlement._id,
            from: settlement.from,
            to: settlement.to,
            amount: settlement.amount,
            groupId: req.params.groupId,
            groupName: group.name,
            notificationType: 'groupSettlement'
        });

        res.status(201).json({
            message: 'Settlement recorded successfully',
            settlement,
        });
    } catch (error) {
        next(error);
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

        if (req.io) {
            req.io.to(req.params.groupId).emit('settlement_confirmed', settlement);
            req.io.to(req.params.groupId).emit('settlement_update', { type: 'SETTLEMENT_CONFIRMED', groupId: req.params.groupId, settlement });
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

        const isPayer = settlement.from.toString() === req.userId.toString();
        const isRecipient = settlement.to.toString() === req.userId.toString();
        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());

        if (!isPayer && !isRecipient && !isAdmin) {
            return res.status(403).json({ message: 'Only the payer, recipient, or an admin can delete this settlement' });
        }

        await Settlement.findByIdAndDelete(req.params.settlementId);

        if (req.io) {
            req.io.to(group._id.toString()).emit('settlement_deleted', req.params.settlementId);
            req.io.to(group._id.toString()).emit('settlement_update', { type: 'SETTLEMENT_DELETED', groupId: group._id, settlementId: req.params.settlementId });
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

        const isAdmin = group.admins.some(adminId => adminId.toString() === req.userId.toString());
        const shouldSimplify = req.query.simplify === 'true';

        const expenses = await Expense.find({ group: req.params.groupId }).populate('paidBy', 'name');
        const settlements = await Settlement.find({ group: req.params.groupId, confirmedByRecipient: true })
            .populate('from', 'name')
            .populate('to', 'name');

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

        const balances = {};
        
        // Initialize balances for registered members
        group.members.forEach(member => {
            balances[member._id.toString()] = {
                user: member,
                paid: 0,
                owes: 0,
                balance: 0,
                isPending: false
            };
        });
        
        // Initialize balances for pending members
        (group.pendingMembers || []).forEach(pm => {
            balances[pm._id.toString()] = {
                user: {
                    _id: pm._id,
                    name: pm.name,
                    phone: pm.phone
                },
                paid: 0,
                owes: 0,
                balance: 0,
                isPending: true
            };
        });

        const pairwiseDebts = {};

        expenses.forEach(expense => {
            // Handle payer - could be registered user or pending member
            let payerId;
            let payerName;
            
            if (expense.paidByPending) {
                payerId = expense.paidByPending.toString();
                payerName = pendingMembersMap[payerId]?.name || 'Unknown';
            } else if (expense.paidBy) {
                payerId = expense.paidBy._id.toString();
                payerName = expense.paidBy.name;
            } else {
                return; // Skip if no payer
            }
            
            if (balances[payerId]) {
                balances[payerId].paid += expense.amount;
            }

            expense.splits.forEach(split => {
                // Handle split user - could be registered user or pending member
                let userId;
                
                if (split.pendingMemberId) {
                    userId = split.pendingMemberId.toString();
                } else if (split.user) {
                    userId = split.user.toString();
                } else {
                    return; // Skip if no user
                }
                
                if (balances[userId]) {
                    balances[userId].owes += split.amount;

                    if (payerId !== userId) {
                        const pairKey = [userId, payerId].sort().join('_');
                        if (!pairwiseDebts[pairKey]) {
                            pairwiseDebts[pairKey] = {
                                personA: userId < payerId ? userId : payerId,
                                personB: userId < payerId ? payerId : userId,
                                aOwesB: 0,
                                bOwesA: 0,
                                expenses: []
                            };
                        }

                        if (userId < payerId) {
                            pairwiseDebts[pairKey].aOwesB += split.amount;
                        } else {
                            pairwiseDebts[pairKey].bOwesA += split.amount;
                        }

                        pairwiseDebts[pairKey].expenses.push({
                            id: expense._id,
                            description: expense.description,
                            amount: split.amount,
                            paidBy: payerName,
                            date: expense.createdAt,
                            category: expense.category
                        });
                    }
                }
            });
        });

        Object.values(balances).forEach(member => {
            member.balance = member.paid - member.owes;
        });

        settlements.forEach(settlement => {
            const fromId = (settlement.from._id || settlement.from).toString();
            const toId = (settlement.to._id || settlement.to).toString();

            if (balances[fromId]) {
                balances[fromId].balance += settlement.amount;
            }
            if (balances[toId]) {
                balances[toId].balance -= settlement.amount;
            }

            const pairKey = [fromId, toId].sort().join('_');
            
            // Create pairwiseDebts entry if it doesn't exist (for settlements without prior expenses)
            if (!pairwiseDebts[pairKey]) {
                pairwiseDebts[pairKey] = {
                    personA: fromId < toId ? fromId : toId,
                    personB: fromId < toId ? toId : fromId,
                    aOwesB: 0,
                    bOwesA: 0,
                    expenses: []
                };
            }
            
            if (fromId < toId) {
                pairwiseDebts[pairKey].aOwesB -= settlement.amount;
            } else {
                pairwiseDebts[pairKey].bOwesA -= settlement.amount;
            }

            pairwiseDebts[pairKey].expenses.push({
                id: settlement._id,
                description: `Payment to ${settlement.to.name}`,
                amount: settlement.amount,
                paidBy: settlement.from.name,
                date: settlement.createdAt,
                category: 'payment',
                isPayment: true
            });
        });

        // Helper to get member info (works for both registered and pending members)
        const getMemberInfo = (memberId) => {
            const registeredMember = group.members.find(m => m._id.toString() === memberId);
            if (registeredMember) {
                return { _id: memberId, name: registeredMember.name, isPending: false };
            }
            const pendingMember = pendingMembersMap[memberId];
            if (pendingMember) {
                return { _id: memberId, name: pendingMember.name, isPending: true };
            }
            return null;
        };

        const detailedDebts = [];
        Object.values(pairwiseDebts).forEach(pair => {
            const memberA = getMemberInfo(pair.personA);
            const memberB = getMemberInfo(pair.personB);

            if (!memberA || !memberB) return;

            const netAmount = pair.aOwesB - pair.bOwesA;

            detailedDebts.push({
                personA: memberA,
                personB: memberB,
                aOwesB: Math.round(pair.aOwesB * 100) / 100,
                bOwesA: Math.round(pair.bOwesA * 100) / 100,
                netAmount: Math.round(Math.abs(netAmount) * 100) / 100,
                netDirection: netAmount > 0 ? 'AtoB' : 'BtoA',
                expenses: pair.expenses,
                expenseCount: pair.expenses.length
            });
        });

        let simplifiedDebts = [];
        if (shouldSimplify) {
            detailedDebts.forEach(pair => {
                if (pair.netAmount > 0.01) {
                    const from = pair.netDirection === 'AtoB' ? pair.personA : pair.personB;
                    const to = pair.netDirection === 'AtoB' ? pair.personB : pair.personA;
                    simplifiedDebts.push({
                        from,
                        to,
                        amount: pair.netAmount,
                        expenseCount: pair.expenseCount
                    });
                }
            });
        } else {
            detailedDebts.forEach(pair => {
                if (pair.aOwesB > 0.01) {
                    simplifiedDebts.push({
                        from: pair.personA,
                        to: pair.personB,
                        amount: pair.aOwesB,
                        expenseCount: pair.expenses.filter(e => e.paidBy === pair.personB.name).length
                    });
                }
                if (pair.bOwesA > 0.01) {
                    simplifiedDebts.push({
                        from: pair.personB,
                        to: pair.personA,
                        amount: pair.bOwesA,
                        expenseCount: pair.expenses.filter(e => e.paidBy === pair.personA.name).length
                    });
                }
            });
        }

        // Filter debts for non-admin users to only show their own debts
        if (!isAdmin) {
            simplifiedDebts = simplifiedDebts.filter(debt =>
                debt.from._id.toString() === req.userId.toString() ||
                debt.to._id.toString() === req.userId.toString()
            );
        }

        // Also filter detailedDebts for non-admin users
        let filteredDetailedDebts = detailedDebts;
        if (!isAdmin) {
            filteredDetailedDebts = detailedDebts.filter(pair =>
                pair.personA._id.toString() === req.userId.toString() ||
                pair.personB._id.toString() === req.userId.toString()
            );
        }

        res.json({
            balances: Object.values(balances),
            simplifiedDebts,
            detailedDebts: filteredDetailedDebts,
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
