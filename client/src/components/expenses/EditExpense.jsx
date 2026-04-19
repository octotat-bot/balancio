import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, DollarSign, FileText,
    Check, ArrowLeft, ArrowRight, Trash2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useExpenseStore } from '../../stores/expenseStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { roundToTwo } from '../../utils/helpers';

const expenseSchema = z.object({
    description: z.string().min(1, 'Description is required').max(100, 'Description is too long'),
    amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: 'Please enter a valid amount',
    }),
    paidBy: z.string().min(1, 'Please select who paid'),
    category: z.string().min(1, 'Please select a category'),
    date: z.string().min(1, 'Please select a date'),
    notes: z.string().optional(),
});

const categories = [
    { value: 'food', label: 'Food & Drinks', emoji: '🍔', color: '#FF6B6B' },
    { value: 'transport', label: 'Transport', emoji: '🚗', color: '#4ECDC4' },
    { value: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#95E1D3' },
    { value: 'utilities', label: 'Utilities', emoji: '💡', color: '#FFE66D' },
    { value: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#FF6B9D' },
    { value: 'travel', label: 'Travel', emoji: '✈️', color: '#6BCF7F' },
    { value: 'health', label: 'Health', emoji: '🏥', color: '#A8E6CF' },
    { value: 'other', label: 'Other', emoji: '📦', color: '#B4A7D6' },
];

export function EditExpense({ groupId, expense, members, onSuccess, onCancel, isAdmin, onDelete }) {
    const { updateExpense, isLoading } = useExpenseStore();
    const { user } = useAuthStore();
    const toast = useToast();

    const [splitType, setSplitType] = useState(expense.splitType || 'equal');
    const [selectedMembers, setSelectedMembers] = useState(
        expense.splits?.map(s => s.user._id || s.user) || members.map((m) => m._id)
    );
    const [customSplits, setCustomSplits] = useState(() => {
        const splits = {};
        expense.splits?.forEach(s => {
            const userId = s.user._id || s.user;
            if (splitType === 'unequal') {
                splits[userId] = s.amount;
            } else if (splitType === 'percentage') {
                splits[userId] = (s.amount / expense.amount) * 100;
            } else if (splitType === 'shares') {
                splits[userId] = 1;
            }
        });
        return splits;
    });

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            description: expense.description || '',
            amount: expense.amount?.toString() || '',
            paidBy: expense.paidBy?._id || expense.paidBy || user?._id || '',
            category: expense.category || 'other',
            date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            notes: expense.notes || '',
        },
    });

    const watchAmount = watch('amount');
    const watchCategory = watch('category');
    const amount = parseFloat(watchAmount) || 0;

    const toggleMember = (memberId) => {
        setSelectedMembers((prev) =>
            prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
        );
    };

    const calculateSplit = (memberId) => {
        if (!selectedMembers.includes(memberId)) return 0;
        const count = selectedMembers.length;

        switch (splitType) {
            case 'equal':
                return roundToTwo(amount / count);
            case 'percentage':
                return roundToTwo(amount * (customSplits[memberId] || 0) / 100);
            case 'shares':
                const totalShares = selectedMembers.reduce(
                    (sum, id) => sum + (customSplits[id] || 1),
                    0
                );
                return roundToTwo(amount * (customSplits[memberId] || 1) / totalShares);
            case 'unequal':
                return customSplits[memberId] || 0;
            default:
                return 0;
        }
    };

    const totalSplit = selectedMembers.reduce((sum, id) => sum + calculateSplit(id), 0);
    const splitDifference = roundToTwo(amount - totalSplit);

    const onSubmit = async (data) => {
        if (selectedMembers.length === 0) {
            toast.error('No participants', 'Please select at least one person to split with');
            return;
        }

        if (splitType !== 'equal' && Math.abs(splitDifference) > 0.01) {
            toast.error('Split mismatch', 'Amounts must add up to the total');
            return;
        }

        const splits = selectedMembers.map((memberId) => ({
            user: memberId,
            amount: calculateSplit(memberId),
        }));

        const result = await updateExpense(groupId, expense._id, {
            description: data.description,
            amount: parseFloat(data.amount),
            paidBy: data.paidBy,
            category: data.category,
            date: data.date,
            notes: data.notes,
            splitType,
            splits,
        });

        if (result.success) {
            toast.success('✨ Expense updated!', 'Changes have been saved');
            onSuccess?.();
        } else {
            toast.error('Couldn\'t update expense', result.message || 'Please try again');
        }
    };

    const selectedCategory = categories.find(c => c.value === watchCategory);

    return (
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Amount */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#EDEAE4' }}>
                    Amount
                </label>
                <div style={{ position: 'relative' }}>
                    <span style={{
                        position: 'absolute',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#EDEAE4'
                    }}>₹</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...register('amount')}
                        style={{
                            width: '100%',
                            padding: '20px 20px 20px 50px',
                            fontSize: '32px',
                            fontWeight: '700',
                            border: '2px solid',
                            borderColor: errors.amount ? '#ef4444' : '#252530',
                            borderRadius: '16px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            backgroundColor: '#131316',
                            color: '#EDEAE4'
                        }}
                        onFocus={(e) => { e.target.style.borderColor = '#D4A853'; e.target.style.backgroundColor = '#1A1A1F'; }}
                        onBlur={(e) => { e.target.style.borderColor = errors.amount ? '#ef4444' : '#252530'; e.target.style.backgroundColor = '#131316'; }}
                    />
                </div>
                {errors.amount && (
                    <p style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444' }}>{errors.amount.message}</p>
                )}
            </div>

            {/* Description */}
            <Input
                label="Description"
                placeholder="What's this expense for?"
                icon={FileText}
                error={errors.description?.message}
                {...register('description')}
            />

            {/* Category Selection */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#EDEAE4' }}>
                    Category
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {categories.map((cat) => (
                        <motion.button
                            key={cat.value}
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setValue('category', cat.value, { shouldValidate: true, shouldDirty: true });
                            }}
                            style={{
                                padding: '16px 8px',
                                borderRadius: '12px',
                                border: '2px solid',
                                borderColor: watchCategory === cat.value ? '#D4A853' : '#252530',
                                backgroundColor: watchCategory === cat.value ? '#2A2518' : '#1A1A1F',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '24px' }}>{cat.emoji}</span>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: watchCategory === cat.value ? '600' : '500',
                                color: watchCategory === cat.value ? '#EDEAE4' : '#737373',
                                textAlign: 'center'
                            }}>
                                {cat.label}
                            </span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Paid By & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#EDEAE4' }}>
                        Paid by
                    </label>
                    <select
                        {...register('paidBy')}
                        disabled={!isAdmin}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #252530',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: '500',
                            outline: 'none',
                            cursor: !isAdmin ? 'not-allowed' : 'pointer',
                            backgroundColor: !isAdmin ? '#131316' : '#1A1A1F',
                            color: '#EDEAE4',
                            opacity: !isAdmin ? 0.7 : 1
                        }}
                    >
                        {members.map((member) => (
                            <option key={member._id} value={member._id}>
                                {member.name} {member._id === user?._id ? '(you)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <Input
                    label="Date"
                    type="date"
                    icon={Calendar}
                    error={errors.date?.message}
                    {...register('date')}
                />
            </div>

            {/* Participants */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#EDEAE4' }}>
                    Split between ({selectedMembers.length} people)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {members.map((member) => {
                        const isSelected = selectedMembers.includes(member._id);
                        const splitAmount = calculateSplit(member._id);

                        return (
                            <div
                                key={member._id}
                                style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '2px solid',
                                    borderColor: isSelected ? '#D4A853' : '#252530',
                                    backgroundColor: isSelected ? '#1A1A1F' : '#131316',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleMember(member._id)}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            cursor: 'pointer',
                                            accentcolor: '#EDEAE4'
                                        }}
                                    />
                                    <Avatar name={member.name} size="sm" />
                                    <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>
                                        {member.name} {member._id === user?._id && '(you)'}
                                    </span>
                                    {isSelected && (
                                        <span style={{ fontSize: '14px', fontWeight: '600' }}>
                                            ₹{splitAmount.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Notes */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#EDEAE4' }}>
                    Notes (optional)
                </label>
                <textarea
                    placeholder="Add any additional details..."
                    {...register('notes')}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #252530',
                        borderRadius: '12px',
                        backgroundColor: '#131316',
                        color: '#EDEAE4',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                        minHeight: '80px'
                    }}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid #252530' }}>
                <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" icon={Check} loading={isLoading} style={{ flex: 1 }}>
                    Save Changes
                </Button>
            </div>
        </form>
    );
}

export default EditExpense;
