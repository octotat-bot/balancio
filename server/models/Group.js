import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Group name is required'],
            trim: true,
            maxlength: 50,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        icon: {
            type: String,
            default: '👥',
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        admins: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        pendingMembers: [
            {
                name: {
                    type: String,
                    required: true,
                    trim: true,
                },
                phone: {
                    type: String,
                    required: true,
                    trim: true,
                },
                addedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        isArchived: {
            type: Boolean,
            default: false,
        },
        // MIGRATION NEEDED: existing direct-friendship groups have isLinkedFriendshipGroup:true
        // Run: db.groups.updateMany({ isLinkedFriendshipGroup: true }, { $set: { type: 'direct' } })
        // to backfill the new `type` field for existing records.
        isLinkedFriendshipGroup: {
            type: Boolean,
            default: false,
        },
        // New canonical discriminator — replaces isLinkedFriendshipGroup going forward.
        // 'direct' = 1-on-1 friend expense group; 'group' = multi-member group
        type: {
            type: String,
            enum: ['direct', 'group'],
            default: 'group',
        },
        budgets: [
            {
                category: {
                    type: String,
                    required: true
                },
                limit: {
                    type: Number,
                    required: true
                }
            }
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

groupSchema.virtual('expenses', {
    ref: 'Expense',
    localField: '_id',
    foreignField: 'group',
});

const Group = mongoose.model('Group', groupSchema);

export default Group;
