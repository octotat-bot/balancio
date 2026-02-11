import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { generateToken } from '../middleware/auth.js';
import { normalizePhone } from '../utils/phone.js';

export const signup = async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;

        const normalizedPhone = normalizePhone(phone);

        const existingUser = await User.findOne({
            $or: [{ email }, { phone: normalizedPhone }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already registered' });
            }
            if (existingUser.phone === normalizedPhone) {
                return res.status(400).json({ message: 'Phone number already registered' });
            }
        }

        const user = await User.create({ name, email, phone: normalizedPhone, password });

        const groupsWithPendingMember = await Group.find({
            $or: [
                { 'pendingMembers.phone': normalizedPhone },
                { 'pendingMembers.phone': phone }
            ]
        });

        if (groupsWithPendingMember.length > 0) {
            for (const group of groupsWithPendingMember) {
                // Find the pending member entry to get its _id
                const pendingMember = group.pendingMembers.find(
                    pm => normalizePhone(pm.phone) === normalizedPhone || pm.phone === phone
                );
                
                if (pendingMember) {
                    const pendingMemberId = pendingMember._id;
                    
                    // Migrate expenses where this pending member paid
                    await Expense.updateMany(
                        { 
                            group: group._id, 
                            paidByPending: pendingMemberId 
                        },
                        { 
                            $set: { paidBy: user._id },
                            $unset: { paidByPending: 1 }
                        }
                    );
                    
                    // Migrate expenses where this pending member is in splits
                    const expensesWithPendingSplits = await Expense.find({
                        group: group._id,
                        'splits.pendingMemberId': pendingMemberId
                    });
                    
                    for (const expense of expensesWithPendingSplits) {
                        expense.splits = expense.splits.map(split => {
                            if (split.pendingMemberId?.toString() === pendingMemberId.toString()) {
                                return {
                                    user: user._id,
                                    amount: split.amount
                                };
                            }
                            return split;
                        });
                        await expense.save();
                    }
                    
                    // Migrate itemized expenses where pending member was involved
                    const expensesWithPendingItems = await Expense.find({
                        group: group._id,
                        'items.involvedPending': pendingMemberId
                    });
                    
                    for (const expense of expensesWithPendingItems) {
                        expense.items = expense.items.map(item => {
                            if (item.involvedPending && item.involvedPending.some(
                                pmId => pmId.toString() === pendingMemberId.toString()
                            )) {
                                // Add to involved (registered users)
                                if (!item.involved.some(uid => uid.toString() === user._id.toString())) {
                                    item.involved.push(user._id);
                                }
                                // Remove from involvedPending
                                item.involvedPending = item.involvedPending.filter(
                                    pmId => pmId.toString() !== pendingMemberId.toString()
                                );
                            }
                            return item;
                        });
                        await expense.save();
                    }
                }
                
                // Add user to group members
                if (!group.members.includes(user._id)) {
                    group.members.push(user._id);
                }
                
                // Remove from pendingMembers
                group.pendingMembers = group.pendingMembers.filter(
                    pm => normalizePhone(pm.phone) !== normalizedPhone
                );
                await group.save();
            }
        }

        const token = generateToken(user._id);

        res.status(201).json({
            message: 'Account created successfully',
            user: user.toJSON(),
            token,
        });
    } catch (error) {
        next(error);
    }
};


export const login = async (req, res, next) => {
    try {
        const { identifier, password, type } = req.body;

        let user;
        if (type === 'phone' || !identifier.includes('@')) {
            const normalizedPhone = normalizePhone(identifier);
            user = await User.findOne({ phone: normalizedPhone }).select('+password');
        } else {
            user = await User.findOne({ email: identifier }).select('+password');
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            message: 'Login successful',
            user: user.toJSON(),
            token,
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res) => {
    res.json({ user: req.user });
};

export const updateProfile = async (req, res, next) => {
    try {
        const { name, username, phone, currency, notifications, avatar } = req.body;

        // Build update object with only provided fields
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (username !== undefined) {
            if (username !== req.user.username) {
                const existingUser = await User.findOne({ username });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username already taken' });
                }
            }
            updateData.username = username;
        }
        if (phone !== undefined) {
            const normalizedPhone = normalizePhone(phone);
            if (normalizedPhone !== req.user.phone) {
                const existingUser = await User.findOne({ phone: normalizedPhone });
                if (existingUser) {
                    return res.status(400).json({ message: 'Phone number already registered' });
                }
            }
            updateData.phone = normalizedPhone;
        }
        if (currency !== undefined) updateData.currency = currency;
        if (notifications !== undefined) updateData.notifications = notifications;
        if (avatar !== undefined) updateData.avatar = avatar;

        const user = await User.findByIdAndUpdate(
            req.userId,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({ user });
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.userId).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
};

export const deleteAccount = async (req, res, next) => {
    try {
        await User.findByIdAndDelete(req.userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        next(error);
    }
};
