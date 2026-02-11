import mongoose from 'mongoose';

const splitSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    // For pending (unregistered) members - stores the pendingMember._id from Group
    pendingMemberId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
});

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    involved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // For pending members in itemized splits
    involvedPending: [{ type: mongoose.Schema.Types.ObjectId }]
});

const expenseSchema = new mongoose.Schema(
    {
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            required: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: 100,
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        // For registered users
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        // For pending (unregistered) members - stores the pendingMember._id from Group
        paidByPending: {
            type: mongoose.Schema.Types.ObjectId,
        },
        category: {
            type: String,
            enum: ['food', 'transport', 'entertainment', 'utilities', 'shopping', 'travel', 'health', 'other'],
            default: 'other',
        },
        date: {
            type: Date,
            default: Date.now,
        },
        splitType: {
            type: String,
            enum: ['equal', 'unequal', 'percentage', 'shares', 'itemized'],
            default: 'equal',
        },
        splits: [splitSchema],
        items: [itemSchema],
        notes: {
            type: String,
            maxlength: 500,
        },
        receipt: {
            type: String,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

expenseSchema.index({ group: 1, date: -1 });
expenseSchema.index({ paidBy: 1 });
expenseSchema.index({ paidByPending: 1 });

// Validation: Either paidBy or paidByPending must be set
expenseSchema.pre('validate', function(next) {
    if (!this.paidBy && !this.paidByPending) {
        this.invalidate('paidBy', 'Either paidBy or paidByPending is required');
    }
    if (this.paidBy && this.paidByPending) {
        this.invalidate('paidBy', 'Cannot have both paidBy and paidByPending');
    }
    next();
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
