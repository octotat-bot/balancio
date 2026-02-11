import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, FileText, Users, Check, Percent, Hash,
    Receipt, User, Plus, Trash2, ArrowLeft, LayoutGrid
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
    amount: z.string().optional(), // Make optional here, we manually validate
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

const splitTypes = [
    { id: 'equal', label: 'Equal', icon: '=' },
    { id: 'unequal', label: 'Exact', icon: '₹' },
    { id: 'percentage', label: 'Percent', icon: '%' },
    { id: 'shares', label: 'Shares', icon: '#' },
    { id: 'itemized', label: 'By Item', icon: '🧾' },
];

export function AddExpense({ groupId, members, allMembers, onSuccess, onCancel, onSubmit, isAdmin = true, hidePaidBy = false }) {
    const { createExpense, isLoading } = useExpenseStore();
    const { user } = useAuthStore();
    const toast = useToast();

    // Use allMembers if provided (includes pending), otherwise fall back to members
    const memberList = allMembers || members;

    // Mode State: 'simple' | 'receipt'
    const [mode, setMode] = useState('simple');

    // Split State
    const [splitType, setSplitType] = useState('equal');
    const [selectedMembers, setSelectedMembers] = useState(memberList.map((m) => m._id));
    const [customSplits, setCustomSplits] = useState({});

    // Itemized State
    const [items, setItems] = useState([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [newItemMembers, setNewItemMembers] = useState([]);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            description: '',
            amount: '',
            paidBy: user?._id || memberList[0]?._id,
            category: 'other',
            date: new Date().toISOString().split('T')[0],
            notes: '',
        },
    });

    const watchAmount = watch('amount');
    const watchCategory = watch('category');

    // Derived Amount: Input for simple, Sum of items for receipt
    const totalItemsAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const amount = mode === 'receipt' ? totalItemsAmount : (parseFloat(watchAmount) || 0);

    // Sync splitType with mode
    useEffect(() => {
        if (splitType === 'itemized') {
            setMode('receipt');
        } else {
            setMode('simple');
        }
    }, [splitType]);

    // --- Logic ---

    const toggleMember = (memberId) => {
        setSelectedMembers((prev) =>
            prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        );
    };

    const toggleItemMember = (memberId) => {
        setNewItemMembers((prev) =>
            prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        );
    };

    const addItem = () => {
        if (!newItemName || !newItemAmount || newItemMembers.length === 0) return;
        setItems([
            ...items,
            {
                id: Date.now(),
                name: newItemName,
                amount: parseFloat(newItemAmount),
                involved: newItemMembers
            }
        ]);
        setNewItemName('');
        setNewItemAmount('');
        setNewItemMembers([]);
    };

    const removeItem = (itemId) => {
        setItems(items.filter(i => i.id !== itemId));
    };

    const calculateSplit = (memberId) => {
        if (mode === 'receipt') return 0; // Handled differently

        if (!selectedMembers.includes(memberId)) return 0;
        const count = selectedMembers.length;
        if (count === 0) return 0;

        switch (splitType) {
            case 'equal': return roundToTwo(amount / count);
            case 'percentage': return roundToTwo(amount * (customSplits[memberId] || 0) / 100);
            case 'shares':
                const totalShares = selectedMembers.reduce((sum, id) => sum + (customSplits[id] || 1), 0);
                return totalShares === 0 ? 0 : roundToTwo(amount * (customSplits[memberId] || 1) / totalShares);
            case 'unequal': return customSplits[memberId] || 0;
            default: return 0;
        }
    };

    const totalSplit = mode === 'receipt'
        ? totalItemsAmount
        : selectedMembers.reduce((sum, id) => sum + calculateSplit(id), 0);

    const splitDifference = roundToTwo(amount - totalSplit);
    const isSplitValid = Math.abs(splitDifference) <= 0.05;

    // Submit Handler
    const handleFormSubmit = async (data) => {
        // Validation updates
        if (mode === 'simple' && (!data.amount || parseFloat(data.amount) <= 0)) {
            toast.error('Amount missing', 'Please enter a valid amount');
            return;
        }
        if (mode === 'receipt' && items.length === 0) {
            toast.error('No items', 'Please add at least one item');
            return;
        }

        if (mode === 'simple' && splitType !== 'equal' && Math.abs(splitDifference) > 0.05) {
            toast.error('Mismatch', `Total split is ₹${totalSplit}, but expense is ₹${amount}`);
            return;
        }

        // Helper to check if a member is pending
        const getMemberById = (id) => memberList.find(m => m._id === id);

        // Generate Splits - handle both registered and pending members
        let splits = [];
        if (mode === 'receipt') {
            const userDebts = {};
            items.forEach(item => {
                const share = item.amount / item.involved.length;
                item.involved.forEach(uid => {
                    userDebts[uid] = (userDebts[uid] || 0) + share;
                });
            });
            splits = Object.keys(userDebts).map(uid => {
                const member = getMemberById(uid);
                if (member?.isPending) {
                    return { pendingMemberId: uid, amount: roundToTwo(userDebts[uid]) };
                }
                return { user: uid, amount: roundToTwo(userDebts[uid]) };
            });
        } else {
            splits = selectedMembers.map((memberId) => {
                const member = getMemberById(memberId);
                if (member?.isPending) {
                    return { pendingMemberId: memberId, amount: calculateSplit(memberId) };
                }
                return { user: memberId, amount: calculateSplit(memberId) };
            });
        }

        // Check if paidBy is a pending member
        const payer = getMemberById(data.paidBy);
        const isPendingPayer = payer?.isPending;

        const expenseData = {
            description: data.description,
            amount, // Use the calculated/derived amount
            category: data.category,
            date: data.date,
            notes: data.notes,
            splitType, // 'itemized' if receipt mode
            splits,
        };

        // Set paidBy or paidByPending based on payer type
        if (isPendingPayer) {
            expenseData.paidByPending = data.paidBy;
        } else {
            expenseData.paidBy = data.paidBy;
        }

        // Handle items for receipt mode - separate involved and involvedPending
        if (mode === 'receipt') {
            expenseData.items = items.map(i => {
                const involved = [];
                const involvedPending = [];
                i.involved.forEach(uid => {
                    const member = getMemberById(uid);
                    if (member?.isPending) {
                        involvedPending.push(uid);
                    } else {
                        involved.push(uid);
                    }
                });
                return { name: i.name, amount: i.amount, involved, involvedPending };
            });
        } else {
            expenseData.items = [];
        }

        if (onSubmit) {
            await onSubmit(expenseData);
            return;
        }

        if (!groupId) {
            toast.error('Error', 'No Group ID provided');
            return;
        }

        const result = await createExpense(groupId, expenseData);

        if (result.success) {
            toast.success('💸 Expense added!', 'Recorded successfully');
            if (result.warning) {
                // Short delay to let the first toast appear, or just stack them
                setTimeout(() => {
                    toast.warning('Budget Alert', result.warning);
                }, 500);
            }
            onSuccess?.();
        } else {
            toast.error('Error', result.message || 'Please try again');
        }
    };

    // --- RENDER ---

    // Receipt Mode Render
    if (mode === 'receipt') {
        return (
            <form onSubmit={handleSubmit(handleFormSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header / Mode Switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Receipt Mode</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: '#737373' }}>Add items one by one</p>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => { setSplitType('equal'); setMode('simple'); }}>
                        Simple Mode
                    </Button>
                </div>

                {/* Details Row (Compact) */}
                <div style={{ display: 'grid', gridTemplateColumns: hidePaidBy ? '1.5fr 1fr 1fr' : '1.5fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <Input placeholder="Description (e.g. Dinner)" {...register('description')} icon={FileText} />

                    <div style={{ position: 'relative' }}>
                        <select
                            {...register('category')}
                            style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', appearance: 'none', fontSize: '14px', fontWeight: '500' }}
                        >
                            {categories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                        </select>
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>▼</div>
                    </div>

                    {!hidePaidBy && (
                        <div style={{ position: 'relative' }}>
                            <select
                                {...register('paidBy')}
                                disabled={!isAdmin}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '10px',
                                    border: '1px solid #e5e5e5',
                                    backgroundColor: !isAdmin ? '#f5f5f5' : '#fff',
                                    appearance: 'none',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: !isAdmin ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {memberList.map(m => <option key={m._id} value={m._id}>{m.name}{m.isPending ? ' (pending)' : ''}</option>)}
                            </select>
                        </div>
                    )}

                    <Input type="date" {...register('date')} icon={Calendar} containerStyle={{ marginTop: 0 }} />
                </div>

                {/* Main Content: Items & Builder */}
                <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>

                    {/* Left: Item List */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#737373', marginBottom: '12px' }}>
                            ITEMS ({items.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {items.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', border: '1px solid #e5e5e5', backgroundColor: '#fff' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                            🥣
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>{item.name}</p>
                                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                {item.involved.map(uid => {
                                                    const m = memberList.find(mem => mem._id === uid);
                                                    return <Avatar key={uid} name={m?.name} size="xs" />;
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: '700' }}>{formatCurrency(item.amount)}</span>
                                        <button type="button" onClick={() => removeItem(item.id)} style={{ padding: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', border: '2px dashed #e5e5e5', borderRadius: '16px', color: '#a3a3a3' }}>
                                    <Receipt size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                    <p>No items added yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Item Builder (Sticky) */}
                    <div style={{ width: '380px', backgroundColor: '#f9f9f9', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Add New Item</h4>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                placeholder="Item Name"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '1px solid #e5e5e5', outline: 'none' }}
                            />
                            <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#737373', fontWeight: '600' }}>₹</span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={newItemAmount}
                                    onChange={e => setNewItemAmount(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 28px', borderRadius: '12px', border: '1px solid #e5e5e5', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#737373', marginBottom: '8px', display: 'block' }}>SPLIT BETWEEN</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {memberList.map(m => {
                                    const active = newItemMembers.includes(m._id);
                                    return (
                                        <button
                                            key={m._id}
                                            type="button"
                                            onClick={() => toggleItemMember(m._id)}
                                            style={{
                                                padding: '6px 12px 6px 8px', borderRadius: '20px',
                                                border: active ? '1px solid #000' : '1px solid #e5e5e5',
                                                backgroundColor: active ? '#fff' : '#fff',
                                                color: '#0a0a0a',
                                                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                                boxShadow: active ? '0 0 0 2px #f5f5f5' : '0 1px 2px rgba(0,0,0,0.05)',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                opacity: active ? 1 : 0.7
                                            }}
                                        >
                                            <Avatar name={m.name} size="xs" />
                                            <span>{m.name.split(' ')[0]}{m.isPending ? ' ⏳' : ''}</span>
                                            {active && <Check size={12} strokeWidth={3} />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <Button onClick={addItem} disabled={!newItemName || !newItemAmount || newItemMembers.length === 0} icon={Plus} style={{ width: '100%' }}>
                            Add Item
                        </Button>

                        {/* Running Total */}
                        <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e5e5', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#737373', fontWeight: '500' }}>Receipt Total</span>
                            <span style={{ fontSize: '24px', fontWeight: '800' }}>{formatCurrency(totalItemsAmount)}</span>
                        </div>
                    </div>
                </div>

                <div style={{ paddingTop: '20px', marginTop: '10px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" loading={isLoading} icon={Check}>Save Receipt</Button>
                </div>
            </form>
        );
    }

    // Default Simple Mode Return
    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', gap: '32px', overflow: 'hidden' }}>
                {/* LEFT COLUMN */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#525252' }}>Amount</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '32px', fontWeight: '700', color: '#0a0a0a' }}>₹</span>
                            <input
                                autoFocus
                                type="number"
                                step="any"
                                min="0" placeholder="0.00"
                                {...register('amount')}
                                style={{
                                    padding: '24px 24px 24px 60px', fontSize: '48px', fontWeight: '800',
                                    border: 'none', borderRadius: '24px', outline: 'none', transition: 'all 0.2s',
                                    backgroundColor: '#f5f5f5', color: '#0a0a0a'
                                }}
                                onFocus={(e) => e.target.style.backgroundColor = '#fff'}
                                onBlur={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                            />
                        </div>
                        {errors.amount && <p style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444' }}>{errors.amount.message}</p>}
                    </div>

                    <Input label="Description" placeholder="What's this for?" icon={FileText} error={errors.description?.message} style={{ height: '56px', fontSize: '18px' }} {...register('description')} />

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#525252' }}>Category</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {categories.map((cat) => (
                                <motion.button
                                    key={cat.value} type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => setValue('category', cat.value, { shouldValidate: true })}
                                    style={{
                                        padding: '12px 4px', borderRadius: '12px', border: '2px solid',
                                        borderColor: watchCategory === cat.value ? '#000' : '#e5e5e5',
                                        backgroundColor: watchCategory === cat.value ? '#fafafa' : '#fff',
                                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: '20px' }}>{cat.emoji}</span>
                                    <span style={{ fontSize: '11px', fontWeight: watchCategory === cat.value ? '600' : '500', color: '#0a0a0a' }}>{cat.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: hidePaidBy ? '1fr' : '1fr 1fr', gap: '16px' }}>
                        {!hidePaidBy && (
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#525252' }}>Paid by</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
                                    <select
                                        {...register('paidBy')}
                                        disabled={!isAdmin}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px 12px 36px',
                                            border: '2px solid #e5e5e5',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            outline: 'none',
                                            cursor: !isAdmin ? 'not-allowed' : 'pointer',
                                            backgroundColor: !isAdmin ? '#f5f5f5' : '#fff',
                                            appearance: 'none',
                                            opacity: !isAdmin ? 0.7 : 1
                                        }}
                                    >
                                        {memberList.map((member) => (
                                            <option key={member._id} value={member._id}>
                                                {member.name} {member._id === user?._id ? '(you)' : ''}{member.isPending ? ' (pending)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                        <Input label="Date" type="date" icon={Calendar} error={errors.date?.message} {...register('date')} />
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ width: '450px', borderLeft: '1px solid #f0f0f0', paddingLeft: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#525252' }}>Split Method</label>
                        <div style={{ display: 'flex', padding: '4px', backgroundColor: '#f1f1f1', borderRadius: '14px' }}>
                            {splitTypes.map((type) => (
                                <button
                                    key={type.id} type="button" onClick={() => setSplitType(type.id)}
                                    style={{
                                        flex: 1, padding: '8px 4px', borderRadius: '10px', border: 'none',
                                        backgroundColor: splitType === type.id ? '#fff' : 'transparent',
                                        boxShadow: splitType === type.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                        fontSize: '13px', fontWeight: splitType === type.id ? '700' : '500',
                                        color: splitType === type.id ? '#0a0a0a' : '#737373', cursor: 'pointer', transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <span>{type.icon}</span><span>{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {amount > 0 && !isSplitValid && (
                        <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>⚠️</span><span>Remaining: <b>{formatCurrency(splitDifference)}</b></span>
                        </div>
                    )}
                    {amount > 0 && isSplitValid && (
                        <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Check size={14} /><span>Amounts match total!</span>
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#737373', fontWeight: '500' }}>{selectedMembers.length} selected</span>
                            <button type="button" onClick={() => setSelectedMembers(selectedMembers.length === memberList.length ? [] : memberList.map(m => m._id))} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' }}>
                                {selectedMembers.length === memberList.length ? 'Select None' : 'Select All'}
                            </button>
                        </div>

                        {memberList.map((member) => {
                            const isSelected = selectedMembers.includes(member._id);
                            const splitVal = calculateSplit(member._id);
                            return (
                                <motion.div
                                    key={member._id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => toggleMember(member._id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px',
                                        backgroundColor: isSelected ? '#fff' : '#fafafa', border: '2px solid',
                                        borderColor: isSelected ? '#0a0a0a' : 'transparent', boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                        opacity: isSelected ? 1 : 0.7, cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s'
                                    }}
                                >
                                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: isSelected ? 'none' : '2px solid #d4d4d4', backgroundColor: isSelected ? '#0a0a0a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                        {isSelected && <Check size={12} strokeWidth={4} />}
                                    </div>
                                    <Avatar name={member.name} size="sm" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>
                                            {member.name}
                                            {member.isPending && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#f59e0b' }}>⏳ pending</span>}
                                        </p>
                                    </div>
                                    {isSelected && splitType === 'equal' && <span style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>₹{splitVal}</span>}
                                    {isSelected && splitType !== 'equal' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                            {splitType === 'unequal' && <span style={{ fontSize: '14px', color: '#737373' }}>₹</span>}
                                            <input
                                                type="number" step={splitType === 'shares' ? '1' : '0.01'} min="0"
                                                value={customSplits[member._id] ?? (splitType === 'shares' ? 1 : '')}
                                                onChange={(e) => setCustomSplits({ ...customSplits, [member._id]: parseFloat(e.target.value) || 0 })}
                                                placeholder={splitType === 'unequal' ? '0.00' : '1'}
                                                style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #d4d4d4', fontSize: '14px', fontWeight: '600', textAlign: 'right', outline: 'none' }}
                                            />
                                            {splitType === 'percentage' && <span style={{ fontSize: '12px', color: '#737373' }}>%</span>}
                                            {splitType === 'shares' && <span style={{ fontSize: '12px', color: '#737373' }}>sh</span>}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div style={{ paddingTop: '20px', marginTop: '10px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit" loading={isLoading} icon={Check}>Save Expense</Button>
            </div>
        </form>
    );
}

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

export default AddExpense;
