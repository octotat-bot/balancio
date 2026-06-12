import Expense from '../models/Expense.js';
import DirectExpense from '../models/DirectExpense.js';
import Friend from '../models/Friend.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { normalizePhone, phoneLookupVariants } from '../utils/phone.js';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getPeriodStart = (period, today = new Date()) => {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    if (period === '3mo') {
        const start = new Date(end);
        start.setMonth(start.getMonth() - 2);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    if (period === '6mo') {
        const start = new Date(end);
        start.setMonth(start.getMonth() - 5);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    const start = new Date(end.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
};

const buildMonthBuckets = (start, end) => {
    const monthlyData = {};
    const cursor = new Date(start);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= end) {
        const key = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
        monthlyData[key] = 0;
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return monthlyData;
};

export const getAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;
        const period = req.query.period || 'year';
        const { start: startDate, end: endDate } = getPeriodStart(period);

        const groupExpenses = await Expense.find({
            'splits.user': userId,
            date: { $gte: startDate, $lte: endDate },
        }).select('amount date category splits paidBy');

        const friendships = await Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
        }).select('_id');

        const friendshipIds = friendships.map(f => f._id);

        const directExpenses = await DirectExpense.find({
            friendship: { $in: friendshipIds },
            date: { $gte: startDate, $lte: endDate },
        }).select('amount date category payerShare friendShare paidBy');

        const monthlyData = buildMonthBuckets(startDate, endDate);
        const categoryData = {};

        const processExpense = (amount, category, date) => {
            const cat = category || 'General';
            categoryData[cat] = (categoryData[cat] || 0) + amount;

            const d = new Date(date);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            if (Object.prototype.hasOwnProperty.call(monthlyData, key)) {
                monthlyData[key] += amount;
            }
        };

        groupExpenses.forEach(exp => {
            const mySplit = exp.splits.find(s => {
                const splitUserId = s.user?._id ?? s.user;
                return splitUserId && splitUserId.toString() === userId.toString();
            });
            if (mySplit) {
                processExpense(mySplit.amount, exp.category, exp.date);
            }
        });

        directExpenses.forEach(exp => {
            let myShare = 0;
            if (exp.paidBy.toString() === userId.toString()) {
                myShare = exp.payerShare;
            } else {
                myShare = exp.friendShare;
            }
            processExpense(myShare, exp.category, exp.date);
        });

        const categories = Object.entries(categoryData)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const totalGroupExpenses = await Expense.countDocuments({ 'splits.user': userId });
        const totalDirectExpenses = await DirectExpense.countDocuments({ friendship: { $in: friendshipIds } });
        const totalSpend = categories.reduce((sum, c) => sum + c.value, 0);

        res.json({
            history: Object.entries(monthlyData).map(([month, amount]) => ({ month, amount })),
            categories,
            totalExpenses: totalGroupExpenses + totalDirectExpenses,
            totalSpend,
            period,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
};

export const lookupPhone = async (req, res) => {
    try {
        const { phone } = req.query;
        const normalized = normalizePhone(phone);

        if (!normalized || normalized.length < 10) {
            return res.json({ found: false, normalizedPhone: normalized || '' });
        }

        const user = await User.findOne({ phone: { $in: phoneLookupVariants(phone) } })
            .select('name phone avatar');

        if (user) {
            return res.json({
                found: true,
                user: { _id: user._id, name: user.name, phone: user.phone, avatar: user.avatar },
                normalizedPhone: normalized,
            });
        }

        res.json({ found: false, normalizedPhone: normalized });
    } catch (error) {
        res.status(500).json({ message: 'Lookup failed' });
    }
};

export const searchUsers = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email || email.length < 3) return res.json({ users: [] });

        const User = mongoose.model('User');
        const users = await User.find({
            email: { $regex: email, $options: 'i' },
            _id: { $ne: req.user._id },
        }).select('name email').limit(10);

        res.json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Search failed' });
    }
};
