// DEPRECATED: use Group + Settlement models instead.
// This model is kept for read-only access to legacy direct-settlement records.
// Do NOT create new DirectSettlement documents — route all new friend settlements
// through settlementController using the linked Group record.
import mongoose from 'mongoose';

const directSettlementSchema = new mongoose.Schema(
    {
        friendship: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Friend',
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
            default: ''
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

directSettlementSchema.index({ friendship: 1, createdAt: -1 });

const DirectSettlement = mongoose.model('DirectSettlement', directSettlementSchema);

export default DirectSettlement;
