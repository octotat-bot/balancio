// DEPRECATED: use Group + Expense models instead.
// This model is kept for read-only access to legacy direct-expense records.
// Do NOT create new DirectExpense documents — route all new friend expenses
// through groupController.createExpense using the linked Group record.
import mongoose from 'mongoose';

const directExpenseSchema = new mongoose.Schema({
    friendship: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Friend',
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    splitType: {
        type: String,
        enum: ['dutch', 'custom'],
        default: 'dutch'
    },
    payerShare: {
        type: Number,
        required: true
    },
    friendShare: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        default: 'General'
    },
    date: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        default: ''
    },
    isSettled: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

directExpenseSchema.index({ friendship: 1, date: -1 });

const DirectExpense = mongoose.model('DirectExpense', directExpenseSchema);

export default DirectExpense;
