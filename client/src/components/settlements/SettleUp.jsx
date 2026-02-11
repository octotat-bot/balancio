import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Check, X, DollarSign,
    FileText, Clock, CheckCircle, AlertCircle,
    Send, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { useSettlementStore } from '../../stores/settlementStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { useChatStore } from '../../stores/chatStore';
import { formatCurrency, formatDate } from '../../utils/helpers';

export function SettleUp({ groupId, members, isAdmin = false, onClose }) {
    const { user } = useAuthStore();
    const {
        settlements,
        simplifiedDebts,
        detailedDebts,
        fetchSettlements,
        fetchBalances,
        createSettlement,
        confirmSettlement,
        deleteSettlement,
        isLoading,
        isSimplified,
        toggleSimplify
    } = useSettlementStore();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('debts');
    const [expandedDebt, setExpandedDebt] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [note, setNote] = useState('');
    const [isPartial, setIsPartial] = useState(false);
    const [showAllSettlements, setShowAllSettlements] = useState(false); // Admin toggle for all settlements
    const [isProcessing, setIsProcessing] = useState(false); // Prevent double-clicks
    const [customPaymentId, setCustomPaymentId] = useState(null);

    useEffect(() => {
        fetchSettlements(groupId);
        // We rely on GroupDetail or Store state for balances to avoid race conditions.
        // But if we want to ensure fresh data on open:
        fetchBalances(groupId);
    }, [groupId]);

    // Payer marks as paid

    const handleMarkAsPaid = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const amount = isPartial ? parseFloat(paymentAmount) : debt.amount;

        if (isPartial && (!amount || amount <= 0)) {
            toast.error('Invalid amount', 'Please enter a valid amount');
            setIsProcessing(false);
            return;
        }

        if (amount > debt.amount) {
            toast.error('Amount too high', 'Cannot pay more than owed');
            setIsProcessing(false);
            return;
        }

        const result = await createSettlement(groupId, {
            from: debt.from._id,
            to: debt.to._id,
            amount: amount,
            note: note || (amount < debt.amount ? `Partial: ${formatCurrency(amount)}` : 'Payment sent'),
        });

        if (result.success) {
            toast.success('💸 Payment recorded!', `Awaiting ${debt.to.name}'s confirmation`);
            resetForm();
            fetchBalances(groupId);
            fetchSettlements(groupId);
        } else {
            toast.error('Failed', result.message || 'Please try again');
        }
        setIsProcessing(false);
    };

    // Receiver confirms payment directly (one click for full amount)

    const handleQuickConfirm = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await createSettlement(groupId, {
            from: debt.from._id,
            to: debt.to._id,
            amount: debt.amount,
            note: 'Payment confirmed',
        });

        if (result.success) {
            const confirmResult = await confirmSettlement(groupId, result.settlement._id);
            if (confirmResult.success) {
                toast.success('✅ Payment confirmed!', 'Settlement complete');
                fetchBalances(groupId);
                fetchSettlements(groupId);
            }
        } else {
            toast.error('Failed', result.message || 'Please try again');
        }
        setIsProcessing(false);
    };

    // Receiver confirms with custom amount

    const handleConfirmWithAmount = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const amount = parseFloat(paymentAmount);

        if (!amount || amount <= 0) {
            toast.error('Invalid amount', 'Please enter a valid amount');
            setIsProcessing(false);
            return;
        }

        if (amount > debt.amount) {
            toast.error('Amount too high', 'Cannot be more than owed');
            setIsProcessing(false);
            return;
        }

        const result = await createSettlement(groupId, {
            from: debt.from._id,
            to: debt.to._id,
            amount: amount,
            note: note || `Partial: ${formatCurrency(amount)}`,
        });

        if (result.success) {
            const confirmResult = await confirmSettlement(groupId, result.settlement._id);
            if (confirmResult.success) {
                toast.success('✅ Payment confirmed!', 'Settlement complete');
                resetForm();
                fetchBalances(groupId);
                fetchSettlements(groupId);
            }
        } else {
            toast.error('Failed', result.message || 'Please try again');
        }
        setIsProcessing(false);
    };

    const handleConfirmPending = async (settlementId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await confirmSettlement(groupId, settlementId);
        if (result.success) {
            toast.success('✅ Confirmed!', 'Settlement complete');
            fetchBalances(groupId);
            fetchSettlements(groupId);
        } else {
            toast.error('Failed', result.message);
        }
        setIsProcessing(false);
    };

    const handleReject = async (settlementId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await deleteSettlement(groupId, settlementId);
        if (result.success) {
            toast.info('❌ Rejected', 'Payer notified');
            fetchBalances(groupId);
            fetchSettlements(groupId);
        } else {
            toast.error('Failed', result.message);
        }
        setIsProcessing(false);
    };

    const resetForm = () => {
        setExpandedDebt(null);
        setPaymentAmount('');
        setNote('');
        setIsPartial(false);
    };

    const toggleExpand = (debtKey) => {
        if (expandedDebt === debtKey) {
            resetForm();
        } else {
            setExpandedDebt(debtKey);
            setPaymentAmount('');
            setNote('');
            setIsPartial(false);
        }
    };

    // Use the correct debt data based on simplification state
    // Backend returns detailedDebts for pairwise view and simplifiedDebts for simplified view
    const debtsToDisplay = isSimplified ? simplifiedDebts : detailedDebts;

    // Safe accessors: simplifiedDebts use from/to, detailedDebts use personA/personB
    // Only compute filtered versions for simplifiedDebts (which have from/to structure)
    const filteredDebts = isSimplified
        ? ((isAdmin && showAllSettlements)
            ? simplifiedDebts
            : (simplifiedDebts || []).filter(d => d.from?._id === user?._id || d.to?._id === user?._id))
        : [];

    const myDebts = filteredDebts.filter(d => d.from?._id === user?._id);
    const owedToMe = filteredDebts.filter(d => d.to?._id === user?._id);
    const otherDebts = (isAdmin && showAllSettlements) ? filteredDebts.filter(d =>
        d.from?._id !== user?._id && d.to?._id !== user?._id
    ) : [];

    const pendingConfirmations = (settlements || []).filter(s =>
        s.to?._id === user?._id && !s.confirmedByRecipient
    );

    const myPendingPayments = (settlements || []).filter(s =>
        s.from?._id === user?._id && !s.confirmedByRecipient
    );

    // Helper function to check if there's a pending settlement for a specific debt
    const hasPendingSettlement = (fromUserId, toUserId) => {
        return (settlements || []).some(s =>
            s.from?._id === fromUserId &&
            s.to?._id === toUserId &&
            !s.confirmedByRecipient
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#f5f5f5',
                padding: '4px',
                borderRadius: '12px'
            }}>
                {[
                    { id: 'debts', label: 'Settle Up' },
                    { id: 'history', label: 'History' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
                            fontWeight: activeTab === tab.id ? '600' : '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {/* Simplify Debts Toggle */}
            {activeTab === 'debts' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '36px', height: '20px', borderRadius: '10px',
                            backgroundColor: isSimplified ? '#16a34a' : '#e5e5e5',
                            position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                        }} onClick={() => toggleSimplify(groupId)}>
                            <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff',
                                position: 'absolute', top: '2px', left: isSimplified ? '18px' : '2px',
                                transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#525252' }}>Simplify debts</span>
                    </div>

                    {/* Admin: Show All Settlements Toggle */}
                    {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '36px', height: '20px', borderRadius: '10px',
                                backgroundColor: showAllSettlements ? '#3b82f6' : '#e5e5e5',
                                position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                            }} onClick={() => setShowAllSettlements(!showAllSettlements)}>
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff',
                                    position: 'absolute', top: '2px', left: showAllSettlements ? '18px' : '2px',
                                    transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#3b82f6' }}>👑 Show all settlements</span>
                        </div>
                    )}
                </div>
            )
            }

            {/* Pending Confirmations - Priority Alert */}
            {/* Pending Confirmations - Priority Alert */}
            {
                pendingConfirmations.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            padding: '16px',
                            borderRadius: '16px',
                            backgroundColor: '#fef9c3',
                            border: '2px solid #fde047'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <AlertCircle size={20} style={{ color: '#ca8a04' }} />
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: '#854d0e' }}>
                                {pendingConfirmations.length} Payment{pendingConfirmations.length > 1 ? 's' : ''} Awaiting Confirmation
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {pendingConfirmations.map((s) => (
                                <div
                                    key={s._id}
                                    style={{
                                        padding: '14px',
                                        backgroundColor: '#fff',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <Avatar name={s.from.name} size="sm" />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                                            {s.from.name} paid you
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#737373' }}>
                                            {formatDate(s.createdAt, 'short')}
                                        </p>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>
                                        {formatCurrency(s.amount)}
                                    </p>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleReject(s._id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '2px solid #fecaca',
                                                backgroundColor: '#fff',
                                                color: '#dc2626',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✕
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleConfirmPending(s._id)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: '#16a34a',
                                                color: '#fff',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✓ Confirm
                                        </motion.button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )
            }

            {/* My Pending Payments */}
            {
                myPendingPayments.length > 0 && (
                    <div style={{
                        padding: '14px',
                        borderRadius: '12px',
                        backgroundColor: '#fef2f2',
                        border: '2px solid #fecaca'
                    }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>
                            ⏳ {myPendingPayments.length} payment{myPendingPayments.length > 1 ? 's' : ''} awaiting confirmation
                        </p>
                    </div>
                )
            }

            <AnimatePresence mode="wait">
                {activeTab === 'debts' && (
                    <motion.div
                        key="debts"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                    >
                        {/* DETAILED VIEW - Show pairwise relationships */}
                        {!isSimplified && detailedDebts && detailedDebts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '12px 16px', backgroundColor: '#f5f5f5', borderRadius: '12px' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#737373', fontWeight: '500' }}>
                                        💡 <strong>Detailed View:</strong> See all debts between each pair of people
                                    </p>
                                </div>

                                {(detailedDebts || []).map((pair, idx) => {
                                    if (!pair?.personA || !pair?.personB) return null;
                                    const isUserInvolved = pair.personA._id === user?._id || pair.personB._id === user?._id;
                                    // Hide debts not involving user unless admin has "show all" toggle ON
                                    if (!isUserInvolved && !(isAdmin && showAllSettlements)) return null;

                                    const pairKey = `pair-${pair.personA._id}-${pair.personB._id}`;
                                    const isExpanded = expandedDebt === pairKey;

                                    return (
                                        <motion.div
                                            key={pairKey}
                                            layout
                                            style={{
                                                borderRadius: '16px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e5e5',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Pair Header */}
                                            <div style={{ padding: '16px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                    <Avatar name={pair.personA.name} size="sm" />
                                                    <ArrowRight size={16} color="#a3a3a3" />
                                                    <Avatar name={pair.personB.name} size="sm" />
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#0a0a0a' }}>
                                                            {pair.personA.name} ↔ {pair.personB.name}
                                                        </h4>
                                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#737373' }}>
                                                            {pair.expenseCount} expense{pair.expenseCount !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Both Directions */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {pair.aOwesB > 0.01 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                                                            <span style={{ fontSize: '13px', color: '#dc2626' }}>
                                                                {pair.personA.name} owes {pair.personB.name}
                                                            </span>
                                                            <span style={{ fontSize: '15px', fontWeight: '700', color: '#dc2626' }}>
                                                                {formatCurrency(pair.aOwesB)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {pair.bOwesA > 0.01 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                                                            <span style={{ fontSize: '13px', color: '#16a34a' }}>
                                                                {pair.personB.name} owes {pair.personA.name}
                                                            </span>
                                                            <span style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>
                                                                {formatCurrency(pair.bOwesA)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Net Amount */}
                                                {pair.netAmount > 0.01 && (
                                                    <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #e5e5e5' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#525252' }}>
                                                                Net: {pair.netDirection === 'AtoB' ? pair.personA.name : pair.personB.name} owes {pair.netDirection === 'AtoB' ? pair.personB.name : pair.personA.name}
                                                            </span>
                                                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0a0a0a' }}>
                                                                {formatCurrency(pair.netAmount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expense Details (Expandable) */}
                                            <div style={{ padding: '12px 16px' }}>
                                                <button
                                                    onClick={() => setExpandedDebt(isExpanded ? null : pairKey)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        backgroundColor: '#f5f5f5',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        color: '#525252'
                                                    }}
                                                >
                                                    <span>📋 View transactions ({pair.expenses.length})</span>
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>

                                                <AnimatePresence>
                                                    {isExpanded && pair.expenses && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {pair.expenses.map((exp, i) => (
                                                                    <div
                                                                        key={`${exp.id}-${i}`}
                                                                        style={{
                                                                            padding: '10px 12px',
                                                                            backgroundColor: exp.isPayment ? '#ecfdf5' : '#fafafa',
                                                                            borderRadius: '8px',
                                                                            fontSize: '12px',
                                                                            border: exp.isPayment ? '1px solid #d1fae5' : 'none'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                            <span style={{ fontWeight: '600', color: exp.isPayment ? '#047857' : '#0a0a0a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                {exp.isPayment && <Check size={12} />}
                                                                                {exp.description}
                                                                            </span>
                                                                            <span style={{ fontWeight: '700', color: exp.isPayment ? '#047857' : '#525252' }}>
                                                                                {exp.isPayment ? '-' : ''}{formatCurrency(exp.amount)}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: exp.isPayment ? '#059669' : '#737373' }}>
                                                                            <span>{exp.isPayment ? 'Paid by' : 'Paid by'} {exp.paidBy}</span>
                                                                            <span>{formatDate(exp.date, 'short')}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Action Buttons */}
                                            {isUserInvolved && pair.netAmount > 0.01 && (
                                                <div style={{ padding: '0 16px 16px' }}>
                                                    {(() => {
                                                        const debtor = pair.netDirection === 'AtoB' ? pair.personA : pair.personB;
                                                        const creditor = pair.netDirection === 'AtoB' ? pair.personB : pair.personA;
                                                        const isPayer = debtor._id === user?._id;
                                                        const pending = hasPendingSettlement(debtor._id, creditor._id);
                                                        const isCustom = customPaymentId === pairKey;

                                                        if (pending) {
                                                            return (
                                                                <div style={{
                                                                    padding: '12px',
                                                                    borderRadius: '12px',
                                                                    backgroundColor: '#fef9c3',
                                                                    border: '1px solid #fde047',
                                                                    textAlign: 'center',
                                                                    width: '100%'
                                                                }}>
                                                                    <span style={{ fontSize: '13px', color: '#a16207', fontWeight: '500' }}>
                                                                        ⏳ Payment pending confirmation
                                                                    </span>
                                                                </div>
                                                            );
                                                        }

                                                        if (isCustom && isPayer) {
                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                                                                    <div style={{ position: 'relative' }}>
                                                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '600', color: '#525252' }}>₹</span>
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Enter amount"
                                                                            value={paymentAmount}
                                                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '10px 12px 10px 28px',
                                                                                borderRadius: '10px',
                                                                                border: '1px solid #d4d4d4',
                                                                                outline: 'none',
                                                                                fontSize: '14px',
                                                                                transition: 'border-color 0.2s'
                                                                            }}
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                                        <Button
                                                                            disabled={isProcessing || !paymentAmount}
                                                                            onClick={() => {
                                                                                const debt = {
                                                                                    from: debtor,
                                                                                    to: creditor,
                                                                                    amount: pair.netAmount
                                                                                };
                                                                                handleMarkAsPaid(debt);
                                                                                setCustomPaymentId(null);
                                                                                setIsPartial(false);
                                                                            }}
                                                                            style={{ flex: 1, height: '36px' }}
                                                                        >
                                                                            {isProcessing ? 'Sending...' : 'Pay'}
                                                                        </Button>
                                                                        <Button
                                                                            variant="secondary"
                                                                            onClick={() => {
                                                                                setCustomPaymentId(null);
                                                                                setIsPartial(false);
                                                                                setPaymentAmount('');
                                                                            }}
                                                                            style={{ height: '36px', padding: '0 12px' }}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return isPayer ? (
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                                                                <Button
                                                                    disabled={isProcessing}
                                                                    onClick={() => {
                                                                        setIsPartial(false);
                                                                        const debt = {
                                                                            from: debtor,
                                                                            to: creditor,
                                                                            amount: pair.netAmount
                                                                        };
                                                                        handleMarkAsPaid(debt);
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        justifyContent: 'center',
                                                                        backgroundColor: '#0a0a0a',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    {isProcessing ? 'Processing...' : <><Send size={15} style={{ marginRight: '6px' }} /> Pay Full {formatCurrency(pair.netAmount)}</>}
                                                                </Button>
                                                                {!isProcessing && (
                                                                    <Button
                                                                        variant="secondary"
                                                                        onClick={() => {
                                                                            setCustomPaymentId(pairKey);
                                                                            setIsPartial(true);
                                                                            setPaymentAmount('');
                                                                        }}
                                                                        style={{
                                                                            padding: '0 16px',
                                                                            backgroundColor: '#f5f5f5',
                                                                            color: '#525252',
                                                                            fontWeight: '600',
                                                                            border: '1px solid #e5e5e5'
                                                                        }}
                                                                    >
                                                                        Partial
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="secondary"
                                                                disabled={isProcessing}
                                                                onClick={() => {
                                                                    const debt = {
                                                                        from: debtor,
                                                                        to: creditor,
                                                                        amount: pair.netAmount
                                                                    };
                                                                    handleQuickConfirm(debt);
                                                                }}
                                                                style={{ width: '100%' }}
                                                            >
                                                                {isProcessing ? 'Processing...' : <><Check size={16} /> Mark Received</>}
                                                            </Button>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : isSimplified && detailedDebts && detailedDebts.length > 0 ? (
                            /* SIMPLIFIED VIEW - Show net amounts in same card design */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>
                                        ✨ <strong>Simplified View:</strong> Showing net amounts between each pair
                                    </p>
                                </div>

                                {(detailedDebts || []).map((pair, idx) => {
                                    if (!pair?.personA || !pair?.personB) return null;
                                    // Only show pairs with net debt
                                    if (pair.netAmount <= 0.01) return null;

                                    const isUserInvolved = pair.personA._id === user?._id || pair.personB._id === user?._id;
                                    // Hide debts not involving user unless admin has "show all" toggle ON
                                    if (!isUserInvolved && !(isAdmin && showAllSettlements)) return null;

                                    const pairKey = `pair-simplified-${pair.personA._id}-${pair.personB._id}`;
                                    const isExpanded = expandedDebt === pairKey;

                                    const debtor = pair.netDirection === 'AtoB' ? pair.personA : pair.personB;
                                    const creditor = pair.netDirection === 'AtoB' ? pair.personB : pair.personA;
                                    const isUserDebtor = debtor._id === user?._id;
                                    const isPendingPayment = hasPendingSettlement(debtor._id, creditor._id);

                                    return (
                                        <motion.div
                                            key={pairKey}
                                            layout
                                            style={{
                                                borderRadius: '16px',
                                                backgroundColor: '#fff',
                                                border: `1px solid ${isUserDebtor ? '#fecaca' : '#bbf7d0'}`,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Main Row */}
                                            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <Avatar name={isUserDebtor ? creditor.name : debtor.name} size="md" />

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0a0a0a' }}>
                                                            {isUserDebtor ? creditor.name : debtor.name}
                                                        </h4>
                                                    </div>
                                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: isUserDebtor ? '#dc2626' : '#16a34a', fontWeight: '500' }}>
                                                        {isUserInvolved
                                                            ? (isUserDebtor ? 'you owe' : 'owes you')
                                                            : `owes ${creditor.name}`
                                                        }
                                                    </p>
                                                </div>

                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: isUserDebtor ? '#dc2626' : '#16a34a' }}>
                                                        {formatCurrency(pair.netAmount)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div style={{ padding: '0 16px 16px' }}>
                                                {isPendingPayment ? (
                                                    <div style={{
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        backgroundColor: '#fef9c3',
                                                        border: '1px solid #fde047',
                                                        textAlign: 'center'
                                                    }}>
                                                        <span style={{ fontSize: '13px', color: '#a16207', fontWeight: '500' }}>
                                                            ⏳ Payment pending confirmation
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {isUserDebtor ? (
                                                            <motion.button
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => toggleExpand(pairKey)}
                                                                style={{
                                                                    flex: 1, padding: '10px', borderRadius: '10px',
                                                                    backgroundColor: '#dc2626', color: '#fff', border: 'none',
                                                                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                                }}
                                                            >
                                                                {isExpanded ? <ChevronUp size={16} /> : <Send size={16} />}
                                                                {isExpanded ? 'Cancel' : 'Pay'}
                                                            </motion.button>
                                                        ) : (
                                                            <>
                                                                <motion.button
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => {
                                                                        const debt = { from: debtor, to: creditor, amount: pair.netAmount };
                                                                        handleQuickConfirm(debt);
                                                                    }}
                                                                    style={{
                                                                        flex: 1, padding: '10px', borderRadius: '10px',
                                                                        backgroundColor: '#16a34a', color: '#fff', border: 'none',
                                                                        fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                                    }}
                                                                >
                                                                    <Check size={16} /> Mark Received
                                                                </motion.button>
                                                                <motion.button
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => {
                                                                        const { sendNudge, connect, isConnected } = useChatStore.getState();
                                                                        if (!isConnected) connect();
                                                                        sendNudge(groupId, debtor._id, user.name);
                                                                        toast.success('👋 Nudged!', `Reminded ${debtor.name}`);
                                                                    }}
                                                                    style={{
                                                                        padding: '10px 14px', borderRadius: '10px',
                                                                        backgroundColor: '#fef9c3', color: '#a16207', border: '1px solid #fde047',
                                                                        fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    👋
                                                                </motion.button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expanded Payment Form */}
                                            <AnimatePresence>
                                                {isExpanded && isUserDebtor && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ overflow: 'hidden', borderTop: '1px solid #fecaca' }}
                                                    >
                                                        <div style={{ padding: '16px', backgroundColor: '#fef2f2', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isPartial}
                                                                    onChange={(e) => setIsPartial(e.target.checked)}
                                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                                />
                                                                <label style={{ fontSize: '14px', color: '#525252', cursor: 'pointer' }} onClick={() => setIsPartial(!isPartial)}>
                                                                    Partial payment
                                                                </label>
                                                            </div>
                                                            {isPartial && (
                                                                <div style={{ position: 'relative' }}>
                                                                    <DollarSign size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3' }} />
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Amount"
                                                                        value={paymentAmount}
                                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                                        style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '10px', border: '1px solid #d4d4d4', outline: 'none' }}
                                                                    />
                                                                </div>
                                                            )}
                                                            <div style={{ position: 'relative' }}>
                                                                <FileText size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#a3a3a3' }} />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add a note (optional)"
                                                                    value={note}
                                                                    onChange={(e) => setNote(e.target.value)}
                                                                    style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '10px', border: '1px solid #d4d4d4', outline: 'none' }}
                                                                />
                                                            </div>
                                                            <Button
                                                                onClick={() => {
                                                                    const debt = { from: debtor, to: creditor, amount: pair.netAmount };
                                                                    handleMarkAsPaid(debt);
                                                                }}
                                                                disabled={isPartial && !paymentAmount}
                                                            >
                                                                Pay
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}

                                {/* All Settled */}
                                {detailedDebts.filter(d => d.netAmount > 0.01).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0', marginTop: '20px' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                            <CheckCircle size={40} />
                                        </div>
                                        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>All Settled Up!</h3>
                                        <p style={{ margin: 0, fontSize: '15px', color: '#64748b' }}>Everyone is square. No pending payments.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* NO DEBTS */
                            <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0', marginTop: '20px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <CheckCircle size={40} />
                                </div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>All Settled Up!</h3>
                                <p style={{ margin: 0, fontSize: '15px', color: '#64748b' }}>Everyone is square. No pending payments.</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                    >
                        {settlements.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: '#737373'
                            }}>
                                <Clock size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '15px' }}>No settlement history yet</p>
                            </div>
                        ) : (
                            settlements.map((s) => (
                                <div
                                    key={s._id}
                                    style={{
                                        padding: '14px',
                                        borderRadius: '12px',
                                        backgroundColor: s.confirmedByRecipient ? '#f0fdf4' : '#fefce8',
                                        border: '2px solid',
                                        borderColor: s.confirmedByRecipient ? '#bbf7d0' : '#fde68a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <Avatar name={s.from.name} size="sm" />
                                    <ArrowRight size={14} style={{ color: '#a3a3a3' }} />
                                    <Avatar name={s.to.name} size="sm" />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
                                            {s.from.name} → {s.to.name}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#737373' }}>
                                            {formatDate(s.createdAt, 'short')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            color: s.confirmedByRecipient ? '#16a34a' : '#ca8a04'
                                        }}>
                                            {formatCurrency(s.amount)}
                                        </p>
                                        <Badge
                                            size="sm"
                                            variant={s.confirmedByRecipient ? 'success' : 'warning'}
                                        >
                                            {s.confirmedByRecipient ? 'Complete' : 'Pending'}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </motion.div>
                )
                }
            </AnimatePresence >
        </div >
    );
}

export default SettleUp;
