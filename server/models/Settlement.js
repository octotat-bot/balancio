import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema(
    {
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            required: true,
        },
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        note: {
            type: String,
            maxlength: 200,
        },
        confirmedByRecipient: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

settlementSchema.index({ group: 1, createdAt: -1 });

// MIGRATION NEEDED: run db.settlements.createIndex(
//   { from: 1, to: 1, confirmedByRecipient: 1 },
//   { unique: true, partialFilterExpression: { confirmedByRecipient: false } }
// ) on your Atlas / local MongoDB instance to enforce the uniqueness at the
// database level. Mongoose will create this index automatically on next
// server start for development, but Atlas requires explicit creation.
//
// This partial unique index ensures only ONE pending settlement can exist
// between any (from, to) pair at a time, preventing race conditions.
settlementSchema.index(
    { from: 1, to: 1, confirmedByRecipient: 1 },
    {
        unique: true,
        partialFilterExpression: { confirmedByRecipient: false },
        name: 'unique_pending_settlement'
    }
);

const Settlement = mongoose.model('Settlement', settlementSchema);

export default Settlement;
