import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Check, DollarSign,
    FileText, Clock, CheckCircle, AlertCircle,
    Send, ChevronDown, ChevronUp, Wallet, ArrowUpRight, ArrowDownLeft, Bell
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useSettlementStore } from '../../stores/settlementStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { useChatStore } from '../../stores/chatStore';
import { formatCurrency, formatDate } from '../../utils/helpers';

export function SettleUp({ groupId, members, isAdmin = false, onClose }) {
    const { user } = useAuthStore();
    const {
        settlements, simplifiedDebts, detailedDebts, balances,
        fetchSettlements, fetchBalances, createSettlement,
        confirmSettlement, deleteSettlement, isLoading,
        isSimplified, toggleSimplify
    } = useSettlementStore();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('balances');
    const [expandedDebt, setExpandedDebt] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [note, setNote] = useState('');
    const [isPartial, setIsPartial] = useState(false);
    const [showAllSettlements, setShowAllSettlements] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchSettlements(groupId);
        fetchBalances(groupId);
    }, [groupId]);

    // --- Handlers ---

    const handleMarkAsPaid = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const amount = isPartial ? parseFloat(paymentAmount) : debt.amount;
        if (isPartial && (!amount || amount <= 0)) {
            toast.error('Invalid amount', 'Please enter a valid amount');
            setIsProcessing(false); return;
        }
        if (amount > debt.amount) {
            toast.error('Amount too high', 'Cannot pay more than owed');
            setIsProcessing(false); return;
        }
        const result = await createSettlement(groupId, {
            from: debt.from._id, to: debt.to._id, amount,
            note: note || (amount < debt.amount ? `Partial: ${formatCurrency(amount)}` : 'Payment sent'),
        });
        if (result.success) {
            toast.success('Payment recorded!', `Awaiting ${debt.to.name}'s confirmation`);
            resetForm(); fetchBalances(groupId); fetchSettlements(groupId);
        } else { toast.error('Failed', result.message || 'Please try again'); }
        setIsProcessing(false);
    };

    const handleQuickConfirm = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await createSettlement(groupId, {
            from: debt.from._id, to: debt.to._id, amount: debt.amount, note: 'Payment confirmed',
        });
        if (result.success) {
            const confirmResult = await confirmSettlement(groupId, result.settlement._id);
            if (confirmResult.success) {
                toast.success('Payment confirmed!', 'Settlement complete');
                fetchBalances(groupId); fetchSettlements(groupId);
            }
        } else { toast.error('Failed', result.message || 'Please try again'); }
        setIsProcessing(false);
    };

    const handleConfirmPending = async (settlementId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await confirmSettlement(groupId, settlementId);
        if (result.success) {
            toast.success('Confirmed!', 'Settlement complete');
            fetchBalances(groupId); fetchSettlements(groupId);
        } else { toast.error('Failed', result.message); }
        setIsProcessing(false);
    };

    const handleReject = async (settlementId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const result = await deleteSettlement(groupId, settlementId);
        if (result.success) {
            toast.info('Rejected', 'Payment rejected');
            fetchBalances(groupId); fetchSettlements(groupId);
        } else { toast.error('Failed', result.message); }
        setIsProcessing(false);
    };

    const resetForm = () => { setExpandedDebt(null); setPaymentAmount(''); setNote(''); setIsPartial(false); };

    const hasPendingSettlement = (fromUserId, toUserId) => {
        return (settlements || []).some(s => s.from?._id === fromUserId && s.to?._id === toUserId && !s.confirmedByRecipient);
    };

    const pendingConfirmations = (settlements || []).filter(s => s.to?._id === user?._id && !s.confirmedByRecipient);
    const myPendingPayments = (settlements || []).filter(s => s.from?._id === user?._id && !s.confirmedByRecipient);

    // Build debts list
    const sortedDebts = (detailedDebts || [])
        .filter(pair => pair?.personA && pair?.personB && pair.netAmount > 0.01)
        .map(pair => {
            const debtor = pair.netDirection === 'AtoB' ? pair.personA : pair.personB;
            const creditor = pair.netDirection === 'AtoB' ? pair.personB : pair.personA;
            return { from: debtor, to: creditor, amount: pair.netAmount, pairKey: `${debtor._id}-${creditor._id}` };
        })
        .filter(d => (isAdmin && showAllSettlements) || d.from._id === user?._id || d.to._id === user?._id)
        .sort((a, b) => {
            const aRank = a.from._id === user?._id ? 0 : a.to._id === user?._id ? 1 : 2;
            const bRank = b.from._id === user?._id ? 0 : b.to._id === user?._id ? 1 : 2;
            return aRank - bRank;
        });

    const memberBalances = (balances || [])
        .filter(b => (isAdmin && showAllSettlements) || Math.abs(b.balance) > 0.01)
        .sort((a, b) => b.balance - a.balance);

    // Compute the max absolute balance for the bar chart
    const maxAbsBalance = memberBalances.length > 0
        ? Math.max(...memberBalances.map(b => Math.abs(b.balance)), 1) : 1;

    // Summary for user
    const myBalance = (balances || []).find(b => b.user?._id === user?._id);
    const totalOwed = sortedDebts.filter(d => d.to._id === user?._id).reduce((s, d) => s + d.amount, 0);
    const totalIOwe = sortedDebts.filter(d => d.from._id === user?._id).reduce((s, d) => s + d.amount, 0);

    const tabItems = [
        { id: 'balances', label: 'Balances', icon: Wallet },
        { id: 'settle', label: 'Settle Up', icon: Send },
        { id: 'history', label: 'History', icon: Clock },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{
                    padding: '16px', borderRadius: '14px',
                    background: totalIOwe > 0 ? 'linear-gradient(135deg, #fef2f2, #fff1f2)' : '#f8fafc',
                    border: totalIOwe > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <ArrowUpRight size={14} color={totalIOwe > 0 ? '#ef4444' : '#94a3b8'} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>You owe</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: totalIOwe > 0 ? '#dc2626' : '#94a3b8' }}>
                        {formatCurrency(totalIOwe)}
                    </p>
                </div>
                <div style={{
                    padding: '16px', borderRadius: '14px',
                    background: totalOwed > 0 ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' : '#f8fafc',
                    border: totalOwed > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <ArrowDownLeft size={14} color={totalOwed > 0 ? '#16a34a' : '#94a3b8'} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>You're owed</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: totalOwed > 0 ? '#16a34a' : '#94a3b8' }}>
                        {formatCurrency(totalOwed)}
                    </p>
                </div>
            </div>

            {/* Pending Confirmations */}
            {pendingConfirmations.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        borderRadius: '14px', overflow: 'hidden',
                        border: '1px solid #fde68a', backgroundColor: '#fffbeb'
                    }}
                >
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #fde68a' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle size={14} color="#d97706" />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                            Confirm {pendingConfirmations.length} payment{pendingConfirmations.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    {pendingConfirmations.map((s, i) => (
                        <div key={s._id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '12px 16px', backgroundColor: '#fff',
                            borderBottom: i < pendingConfirmations.length - 1 ? '1px solid #fef9c3' : 'none'
                        }}>
                            <Avatar name={s.from?.name} size="sm" />
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>{s.from?.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#a3a3a3' }}>paid you {formatCurrency(s.amount)}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleReject(s._id)}
                                    style={{
                                        padding: '8px 14px', borderRadius: '8px',
                                        border: '1px solid #e5e5e5', backgroundColor: '#fff',
                                        fontSize: '13px', fontWeight: '600', color: '#737373', cursor: 'pointer'
                                    }}
                                >Decline</motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleConfirmPending(s._id)}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px',
                                        border: 'none', backgroundColor: '#16a34a',
                                        fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer'
                                    }}
                                >Confirm</motion.button>
                            </div>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* My Pending Payments */}
            {myPendingPayments.length > 0 && activeTab !== 'history' && (
                <div style={{
                    padding: '12px 16px', borderRadius: '12px',
                    backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <Clock size={14} color="#ef4444" />
                    <span style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>
                        {myPendingPayments.length} payment{myPendingPayments.length > 1 ? 's' : ''} awaiting confirmation
                    </span>
                </div>
            )}

            {/* Tab Bar */}
            <div style={{
                display: 'flex', backgroundColor: '#f5f5f5',
                padding: '3px', borderRadius: '12px', gap: '2px'
            }}>
                {tabItems.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1, padding: '10px 8px', borderRadius: '10px',
                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                backgroundColor: isActive ? '#fff' : 'transparent',
                                fontWeight: isActive ? '600' : '400',
                                fontSize: '13px',
                                color: isActive ? '#0a0a0a' : '#737373',
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Admin toggle */}
            {isAdmin && activeTab !== 'history' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2px' }}>
                    <button
                        onClick={() => setShowAllSettlements(!showAllSettlements)}
                        style={{
                            padding: '5px 12px', borderRadius: '20px',
                            border: showAllSettlements ? '1px solid #93c5fd' : '1px solid #e5e5e5',
                            backgroundColor: showAllSettlements ? '#eff6ff' : '#fff',
                            fontSize: '12px', fontWeight: '500',
                            color: showAllSettlements ? '#2563eb' : '#737373',
                            cursor: 'pointer', transition: 'all 0.15s'
                        }}
                    >
                        {showAllSettlements ? 'All members' : 'Show all'}
                    </button>
                </div>
            )}

            <AnimatePresence mode="wait">

                {/* ==================== BALANCES TAB ==================== */}
                {activeTab === 'balances' && (
                    <motion.div
                        key="balances"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        {memberBalances.length > 0 ? (
                            <div style={{
                                borderRadius: '14px', overflow: 'hidden',
                                border: '1px solid #f0f0f0', backgroundColor: '#fff'
                            }}>
                                {memberBalances.map((b, i) => {
                                    const isMe = b.user?._id === user?._id;
                                    const isPositive = b.balance > 0;
                                    const isZero = Math.abs(b.balance) <= 0.01;
                                    const barWidth = isZero ? 0 : (Math.abs(b.balance) / maxAbsBalance) * 100;

                                    return (
                                        <div
                                            key={b.user?._id || i}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '14px 16px',
                                                borderBottom: i < memberBalances.length - 1 ? '1px solid #f5f5f5' : 'none',
                                                backgroundColor: isMe ? '#fafbff' : '#fff'
                                            }}
                                        >
                                            <Avatar name={b.user?.name} size="sm" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    margin: 0, fontSize: '14px', fontWeight: isMe ? '600' : '500', color: '#0a0a0a',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    {b.user?.name}{isMe ? ' (you)' : ''}
                                                    {b.isPending && (
                                                        <span style={{
                                                            marginLeft: '6px', fontSize: '10px',
                                                            padding: '1px 6px', borderRadius: '4px',
                                                            backgroundColor: '#fef3c7', color: '#d97706', fontWeight: '600'
                                                        }}>PENDING</span>
                                                    )}
                                                </p>
                                                {/* Balance bar */}
                                                {!isZero && (
                                                    <div style={{ marginTop: '6px', height: '4px', backgroundColor: '#f5f5f5', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${barWidth}%` }}
                                                            transition={{ duration: 0.5, delay: i * 0.05 }}
                                                            style={{
                                                                height: '100%', borderRadius: '2px',
                                                                backgroundColor: isPositive ? '#4ade80' : '#f87171'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                {isZero ? (
                                                    <span style={{
                                                        fontSize: '12px', fontWeight: '500',
                                                        padding: '3px 8px', borderRadius: '6px',
                                                        backgroundColor: '#f1f5f9', color: '#94a3b8'
                                                    }}>settled</span>
                                                ) : (
                                                    <p style={{
                                                        margin: 0, fontSize: '15px', fontWeight: '700',
                                                        color: isPositive ? '#16a34a' : '#dc2626'
                                                    }}>
                                                        {isPositive ? '+' : ''}{formatCurrency(b.balance)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState icon={CheckCircle} title="No balances yet" subtitle="Add an expense to get started" />
                        )}
                    </motion.div>
                )}

                {/* ==================== SETTLE UP TAB ==================== */}
                {activeTab === 'settle' && (
                    <motion.div
                        key="settle"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                        {/* Simplify toggle */}
                        <div
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px', borderRadius: '12px',
                                backgroundColor: isSimplified ? '#f0fdf4' : '#f8fafc',
                                border: isSimplified ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                cursor: 'pointer', transition: 'all 0.2s',
                                userSelect: 'none'
                            }}
                            onClick={() => toggleSimplify(groupId)}
                        >
                            <div style={{
                                width: '36px', height: '20px', borderRadius: '10px',
                                backgroundColor: isSimplified ? '#16a34a' : '#cbd5e1',
                                position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
                            }}>
                                <motion.div
                                    animate={{ left: isSimplified ? '18px' : '2px' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    style={{
                                        width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff',
                                        position: 'absolute', top: '2px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '13px', color: '#0a0a0a', fontWeight: '600' }}>Simplify debts</span>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                                    {isSimplified ? 'Minimized number of payments' : 'Showing all individual debts'}
                                </p>
                            </div>
                        </div>

                        {sortedDebts.length > 0 ? (
                            <div style={{
                                borderRadius: '14px', overflow: 'hidden',
                                border: '1px solid #f0f0f0', backgroundColor: '#fff'
                            }}>
                                {sortedDebts.map((debt, i) => {
                                    const isUserDebtor = debt.from._id === user?._id;
                                    const isUserCreditor = debt.to._id === user?._id;
                                    const isUserInvolved = isUserDebtor || isUserCreditor;
                                    const isExpanded = expandedDebt === debt.pairKey;
                                    const pending = hasPendingSettlement(debt.from._id, debt.to._id);

                                    return (
                                        <div
                                            key={debt.pairKey}
                                            style={{
                                                borderBottom: i < sortedDebts.length - 1 ? '1px solid #f5f5f5' : 'none',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Debt Row */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '14px 16px',
                                            }}>
                                                {/* Left side: avatars + text */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <Avatar name={debt.from.name} size="sm" />
                                                        <div style={{
                                                            position: 'absolute', bottom: '-2px', right: '-2px',
                                                            width: '14px', height: '14px', borderRadius: '50%',
                                                            backgroundColor: isUserDebtor ? '#fef2f2' : '#f0fdf4',
                                                            border: '2px solid #fff',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            <ArrowUpRight size={8} color={isUserDebtor ? '#ef4444' : '#22c55e'} />
                                                        </div>
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <p style={{
                                                            margin: 0, fontSize: '14px', fontWeight: '500', color: '#0a0a0a',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>
                                                            {isUserDebtor ? 'You' : debt.from.name}
                                                            <span style={{ color: '#a3a3a3', fontWeight: '400' }}> owes </span>
                                                            {isUserCreditor ? 'you' : debt.to.name}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div style={{
                                                    padding: '4px 10px', borderRadius: '8px', flexShrink: 0,
                                                    backgroundColor: isUserDebtor ? '#fef2f2' : isUserCreditor ? '#f0fdf4' : '#f8fafc'
                                                }}>
                                                    <span style={{
                                                        fontSize: '15px', fontWeight: '700',
                                                        color: isUserDebtor ? '#dc2626' : isUserCreditor ? '#16a34a' : '#525252'
                                                    }}>
                                                        {formatCurrency(debt.amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Row */}
                                            {isUserInvolved && (
                                                <div style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
                                                    {pending ? (
                                                        <div style={{
                                                            flex: 1, padding: '8px 12px', borderRadius: '10px',
                                                            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                                        }}>
                                                            <Clock size={13} color="#d97706" />
                                                            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '500' }}>
                                                                Pending confirmation
                                                            </span>
                                                        </div>
                                                    ) : isUserDebtor ? (
                                                        <>
                                                            <motion.button
                                                                whileTap={{ scale: 0.97 }}
                                                                disabled={isProcessing}
                                                                onClick={() => { setIsPartial(false); handleMarkAsPaid(debt); }}
                                                                style={{
                                                                    flex: 1, padding: '10px 16px', borderRadius: '10px',
                                                                    border: 'none',
                                                                    background: 'linear-gradient(135deg, #171717, #262626)',
                                                                    color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                                                                }}
                                                            >
                                                                <Send size={13} /> Pay {formatCurrency(debt.amount)}
                                                            </motion.button>
                                                            <motion.button
                                                                whileTap={{ scale: 0.97 }}
                                                                onClick={() => {
                                                                    if (isExpanded) resetForm();
                                                                    else { setExpandedDebt(debt.pairKey); setIsPartial(true); setPaymentAmount(''); }
                                                                }}
                                                                style={{
                                                                    padding: '10px 14px', borderRadius: '10px',
                                                                    border: '1px solid #e5e5e5', backgroundColor: '#fff',
                                                                    fontSize: '12px', fontWeight: '600', color: '#525252',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {isExpanded ? 'Cancel' : 'Partial'}
                                                            </motion.button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <motion.button
                                                                whileTap={{ scale: 0.97 }}
                                                                disabled={isProcessing}
                                                                onClick={() => handleQuickConfirm(debt)}
                                                                style={{
                                                                    flex: 1, padding: '10px 16px', borderRadius: '10px',
                                                                    border: 'none',
                                                                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                                                    color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                                    boxShadow: '0 2px 8px rgba(22,163,74,0.2)'
                                                                }}
                                                            >
                                                                <Check size={14} /> Mark Received
                                                            </motion.button>
                                                            <motion.button
                                                                whileTap={{ scale: 0.97 }}
                                                                onClick={() => {
                                                                    const { sendNudge, connect, isConnected } = useChatStore.getState();
                                                                    if (!isConnected) connect();
                                                                    sendNudge(groupId, debt.from._id, user?.name);
                                                                    toast.success('Nudged!', `Reminded ${debt.from.name}`);
                                                                }}
                                                                style={{
                                                                    padding: '10px 12px', borderRadius: '10px',
                                                                    border: '1px solid #fde68a', backgroundColor: '#fffbeb',
                                                                    fontSize: '13px', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                                }}
                                                            >
                                                                <Bell size={13} color="#d97706" />
                                                            </motion.button>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Expanded Partial Payment */}
                                            <AnimatePresence>
                                                {isExpanded && isUserDebtor && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{
                                                            padding: '12px 16px', borderTop: '1px solid #f0f0f0',
                                                            backgroundColor: '#fafafa',
                                                            display: 'flex', gap: '8px', alignItems: 'center'
                                                        }}>
                                                            <div style={{ position: 'relative', flex: 1 }}>
                                                                <span style={{
                                                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                                                    fontSize: '14px', fontWeight: '600', color: '#a3a3a3'
                                                                }}>₹</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Amount"
                                                                    value={paymentAmount}
                                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                                    autoFocus
                                                                    style={{
                                                                        width: '100%', padding: '10px 10px 10px 28px',
                                                                        borderRadius: '10px', border: '1px solid #d4d4d4',
                                                                        outline: 'none', fontSize: '14px',
                                                                        backgroundColor: '#fff'
                                                                    }}
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Note"
                                                                value={note}
                                                                onChange={(e) => setNote(e.target.value)}
                                                                style={{
                                                                    width: '100px', padding: '10px 12px',
                                                                    borderRadius: '10px', border: '1px solid #d4d4d4',
                                                                    outline: 'none', fontSize: '14px',
                                                                    backgroundColor: '#fff'
                                                                }}
                                                            />
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                disabled={isProcessing || !paymentAmount}
                                                                onClick={() => handleMarkAsPaid(debt)}
                                                                style={{
                                                                    padding: '10px 18px', borderRadius: '10px',
                                                                    border: 'none',
                                                                    background: (!paymentAmount || isProcessing) ? '#d4d4d4' : 'linear-gradient(135deg, #171717, #262626)',
                                                                    color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                }}
                                                            >
                                                                Pay
                                                            </motion.button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState icon={CheckCircle} title="All settled up!" subtitle="No pending debts" color="#16a34a" />
                        )}
                    </motion.div>
                )}

                {/* ==================== HISTORY TAB ==================== */}
                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        {(settlements || []).length === 0 ? (
                            <EmptyState icon={Clock} title="No settlement history" subtitle="Payments will appear here" />
                        ) : (
                            <div style={{
                                borderRadius: '14px', overflow: 'hidden',
                                border: '1px solid #f0f0f0', backgroundColor: '#fff'
                            }}>
                                {(settlements || []).map((s, i) => (
                                    <div
                                        key={s._id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '14px 16px',
                                            borderBottom: i < settlements.length - 1 ? '1px solid #f5f5f5' : 'none'
                                        }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '10px',
                                            backgroundColor: s.confirmedByRecipient ? '#f0fdf4' : '#fffbeb',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {s.confirmedByRecipient
                                                ? <CheckCircle size={18} color="#16a34a" />
                                                : <Clock size={18} color="#d97706" />
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0, fontSize: '14px', fontWeight: '500', color: '#0a0a0a',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}>
                                                {s.from?.name} <span style={{ color: '#a3a3a3' }}>paid</span> {s.to?.name}
                                            </p>
                                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#a3a3a3' }}>
                                                {formatDate(s.createdAt, 'short')}
                                                {!s.confirmedByRecipient && (
                                                    <span style={{
                                                        marginLeft: '8px', fontSize: '10px', fontWeight: '600',
                                                        padding: '1px 6px', borderRadius: '4px',
                                                        backgroundColor: '#fef3c7', color: '#d97706'
                                                    }}>PENDING</span>
                                                )}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontSize: '15px', fontWeight: '700', flexShrink: 0,
                                            color: s.confirmedByRecipient ? '#16a34a' : '#d97706'
                                        }}>
                                            {formatCurrency(s.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Reusable empty state
function EmptyState({ icon: Icon, title, subtitle, color = '#94a3b8' }) {
    return (
        <div style={{
            textAlign: 'center', padding: '48px 24px',
            borderRadius: '14px', backgroundColor: '#fafafa',
            border: '1px dashed #e5e5e5'
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                backgroundColor: '#f0f0f0', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px'
            }}>
                <Icon size={22} color={color} />
            </div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#525252' }}>{title}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a3a3a3' }}>{subtitle}</p>
        </div>
    );
}

export default SettleUp;
