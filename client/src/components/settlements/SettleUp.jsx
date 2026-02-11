import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Check, DollarSign,
    FileText, Clock, CheckCircle, AlertCircle,
    Send, ChevronDown, ChevronUp
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
        balances,
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

    // --- Handlers (kept same logic) ---

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
            amount,
            note: note || (amount < debt.amount ? `Partial: ${formatCurrency(amount)}` : 'Payment sent'),
        });

        if (result.success) {
            toast.success('Payment recorded!', `Awaiting ${debt.to.name}'s confirmation`);
            resetForm();
            fetchBalances(groupId);
            fetchSettlements(groupId);
        } else {
            toast.error('Failed', result.message || 'Please try again');
        }
        setIsProcessing(false);
    };

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
                toast.success('Payment confirmed!', 'Settlement complete');
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
            toast.success('Confirmed!', 'Settlement complete');
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
            toast.info('Rejected', 'Payment rejected');
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

    const hasPendingSettlement = (fromUserId, toUserId) => {
        return (settlements || []).some(s =>
            s.from?._id === fromUserId &&
            s.to?._id === toUserId &&
            !s.confirmedByRecipient
        );
    };

    const pendingConfirmations = (settlements || []).filter(s =>
        s.to?._id === user?._id && !s.confirmedByRecipient
    );

    const myPendingPayments = (settlements || []).filter(s =>
        s.from?._id === user?._id && !s.confirmedByRecipient
    );

    // Build debts list from detailedDebts (works for both views)
    const debtsList = (detailedDebts || [])
        .filter(pair => pair?.personA && pair?.personB && pair.netAmount > 0.01)
        .map(pair => {
            const debtor = pair.netDirection === 'AtoB' ? pair.personA : pair.personB;
            const creditor = pair.netDirection === 'AtoB' ? pair.personB : pair.personA;
            return {
                from: debtor,
                to: creditor,
                amount: pair.netAmount,
                expenses: pair.expenses || [],
                expenseCount: pair.expenseCount || 0,
                pairKey: `${debtor._id}-${creditor._id}`,
            };
        })
        .filter(d => {
            if (isAdmin && showAllSettlements) return true;
            return d.from._id === user?._id || d.to._id === user?._id;
        });

    // Sort: user's debts first, then debts owed to user
    const sortedDebts = [...debtsList].sort((a, b) => {
        const aIsMe = a.from._id === user?._id ? 0 : a.to._id === user?._id ? 1 : 2;
        const bIsMe = b.from._id === user?._id ? 0 : b.to._id === user?._id ? 1 : 2;
        return aIsMe - bIsMe;
    });

    // Member balances from backend
    const memberBalances = (balances || [])
        .filter(b => {
            if (isAdmin && showAllSettlements) return true;
            return Math.abs(b.balance) > 0.01;
        })
        .sort((a, b) => b.balance - a.balance);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Tab Bar */}
            <div style={{
                display: 'flex',
                backgroundColor: '#f5f5f5',
                padding: '3px',
                borderRadius: '10px',
                gap: '2px'
            }}>
                {[
                    { id: 'balances', label: 'Balances' },
                    { id: 'settle', label: 'Settle Up' },
                    { id: 'history', label: 'History' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
                            fontWeight: activeTab === tab.id ? '600' : '400',
                            fontSize: '13px',
                            color: activeTab === tab.id ? '#0a0a0a' : '#737373',
                            cursor: 'pointer',
                            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Pending Confirmations Alert */}
            {pendingConfirmations.length > 0 && (
                <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: pendingConfirmations.length > 0 ? '10px' : 0 }}>
                        <AlertCircle size={16} color="#d97706" />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#92400e' }}>
                            {pendingConfirmations.length} payment{pendingConfirmations.length > 1 ? 's' : ''} to confirm
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pendingConfirmations.map(s => (
                            <div key={s._id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 12px', backgroundColor: '#fff', borderRadius: '10px'
                            }}>
                                <Avatar name={s.from?.name} size="xs" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>
                                        {s.from?.name} paid you
                                    </span>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a', marginRight: '8px' }}>
                                    {formatCurrency(s.amount)}
                                </span>
                                <button
                                    onClick={() => handleReject(s._id)}
                                    style={{
                                        padding: '6px 10px', borderRadius: '6px',
                                        border: '1px solid #e5e5e5', backgroundColor: '#fff',
                                        fontSize: '12px', fontWeight: '600', color: '#dc2626',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleConfirmPending(s._id)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px',
                                        border: 'none', backgroundColor: '#16a34a',
                                        fontSize: '12px', fontWeight: '600', color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Confirm
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* My Pending Payments */}
            {myPendingPayments.length > 0 && activeTab !== 'history' && (
                <div style={{
                    padding: '10px 12px', borderRadius: '10px',
                    backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                    fontSize: '13px', color: '#b91c1c', fontWeight: '500'
                }}>
                    {myPendingPayments.length} payment{myPendingPayments.length > 1 ? 's' : ''} awaiting confirmation
                </div>
            )}

            {/* Admin toggle */}
            {isAdmin && activeTab !== 'history' && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: '8px', padding: '0 4px'
                }}>
                    <button
                        onClick={() => setShowAllSettlements(!showAllSettlements)}
                        style={{
                            padding: '4px 10px', borderRadius: '6px', border: '1px solid #dbeafe',
                            backgroundColor: showAllSettlements ? '#eff6ff' : '#fff',
                            fontSize: '12px', fontWeight: '500',
                            color: showAllSettlements ? '#2563eb' : '#737373',
                            cursor: 'pointer', transition: 'all 0.15s'
                        }}
                    >
                        {showAllSettlements ? 'Showing all' : 'Show all'}
                    </button>
                </div>
            )}

            <AnimatePresence mode="wait">

                {/* ==================== BALANCES TAB ==================== */}
                {activeTab === 'balances' && (
                    <motion.div
                        key="balances"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                    >
                        {memberBalances.length > 0 ? (
                            memberBalances.map((b, i) => {
                                const isMe = b.user?._id === user?._id;
                                const isPositive = b.balance > 0;
                                const isZero = Math.abs(b.balance) <= 0.01;

                                return (
                                    <div
                                        key={b.user?._id || i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '14px 16px',
                                            backgroundColor: '#fff',
                                            borderBottom: i < memberBalances.length - 1 ? '1px solid #f5f5f5' : 'none',
                                        }}
                                    >
                                        <Avatar name={b.user?.name} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0, fontSize: '14px', fontWeight: '500', color: '#0a0a0a',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}>
                                                {b.user?.name}{isMe ? ' (you)' : ''}
                                                {b.isPending && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#d97706' }}>pending</span>}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            {isZero ? (
                                                <span style={{ fontSize: '14px', fontWeight: '500', color: '#a3a3a3' }}>settled up</span>
                                            ) : (
                                                <>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '15px',
                                                        fontWeight: '700',
                                                        color: isPositive ? '#16a34a' : '#dc2626'
                                                    }}>
                                                        {isPositive ? '+' : ''}{formatCurrency(b.balance)}
                                                    </p>
                                                    <p style={{
                                                        margin: '1px 0 0', fontSize: '11px',
                                                        color: isPositive ? '#16a34a' : '#dc2626',
                                                        fontWeight: '400'
                                                    }}>
                                                        {isPositive ? 'gets back' : 'owes'}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{
                                textAlign: 'center', padding: '48px 24px',
                                color: '#a3a3a3'
                            }}>
                                <CheckCircle size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>No balances yet</p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Add an expense to get started</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ==================== SETTLE UP TAB ==================== */}
                {activeTab === 'settle' && (
                    <motion.div
                        key="settle"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}
                    >
                        {/* Simplify toggle */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 4px 12px', cursor: 'pointer'
                        }}
                            onClick={() => toggleSimplify(groupId)}
                        >
                            <div style={{
                                width: '34px', height: '18px', borderRadius: '9px',
                                backgroundColor: isSimplified ? '#16a34a' : '#d4d4d4',
                                position: 'relative', transition: 'background-color 0.2s',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fff',
                                    position: 'absolute', top: '2px',
                                    left: isSimplified ? '18px' : '2px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                                }} />
                            </div>
                            <span style={{ fontSize: '13px', color: '#525252', fontWeight: '500' }}>
                                Simplify debts
                            </span>
                        </div>

                        {sortedDebts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sortedDebts.map((debt) => {
                                    const isUserDebtor = debt.from._id === user?._id;
                                    const isUserCreditor = debt.to._id === user?._id;
                                    const isUserInvolved = isUserDebtor || isUserCreditor;
                                    const isExpanded = expandedDebt === debt.pairKey;
                                    const pending = hasPendingSettlement(debt.from._id, debt.to._id);

                                    return (
                                        <motion.div
                                            key={debt.pairKey}
                                            layout
                                            style={{
                                                borderRadius: '12px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #f0f0f0',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Main Row */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '12px 14px'
                                            }}>
                                                <Avatar name={debt.from.name} size="sm" />
                                                <ArrowRight size={14} color="#d4d4d4" style={{ flexShrink: 0 }} />
                                                <Avatar name={debt.to.name} size="sm" />

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '13px', color: '#0a0a0a',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>
                                                        <span style={{ fontWeight: '600' }}>
                                                            {isUserDebtor ? 'You' : debt.from.name}
                                                        </span>
                                                        {' '}owes{' '}
                                                        <span style={{ fontWeight: '600' }}>
                                                            {isUserCreditor ? 'you' : debt.to.name}
                                                        </span>
                                                    </p>
                                                </div>

                                                <span style={{
                                                    fontSize: '15px', fontWeight: '700', flexShrink: 0,
                                                    color: isUserDebtor ? '#dc2626' : isUserCreditor ? '#16a34a' : '#525252'
                                                }}>
                                                    {formatCurrency(debt.amount)}
                                                </span>
                                            </div>

                                            {/* Action Row */}
                                            {isUserInvolved && (
                                                <div style={{
                                                    padding: '0 14px 10px',
                                                    display: 'flex', gap: '6px', alignItems: 'center'
                                                }}>
                                                    {pending ? (
                                                        <span style={{
                                                            fontSize: '12px', color: '#d97706', fontWeight: '500',
                                                            padding: '6px 10px', backgroundColor: '#fffbeb',
                                                            borderRadius: '6px', border: '1px solid #fde68a',
                                                            width: '100%', textAlign: 'center'
                                                        }}>
                                                            Payment pending confirmation
                                                        </span>
                                                    ) : isUserDebtor ? (
                                                        <>
                                                            <button
                                                                disabled={isProcessing}
                                                                onClick={() => {
                                                                    setIsPartial(false);
                                                                    handleMarkAsPaid(debt);
                                                                }}
                                                                style={{
                                                                    flex: 1, padding: '8px 12px', borderRadius: '8px',
                                                                    border: 'none', backgroundColor: '#0a0a0a', color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                                                }}
                                                            >
                                                                <Send size={13} /> Pay {formatCurrency(debt.amount)}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (isExpanded) { resetForm(); }
                                                                    else { setExpandedDebt(debt.pairKey); setIsPartial(true); setPaymentAmount(''); }
                                                                }}
                                                                style={{
                                                                    padding: '8px 12px', borderRadius: '8px',
                                                                    border: '1px solid #e5e5e5', backgroundColor: '#fff',
                                                                    fontSize: '12px', fontWeight: '600', color: '#525252',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {isExpanded ? 'Cancel' : 'Partial'}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                disabled={isProcessing}
                                                                onClick={() => handleQuickConfirm(debt)}
                                                                style={{
                                                                    flex: 1, padding: '8px 12px', borderRadius: '8px',
                                                                    border: 'none', backgroundColor: '#16a34a', color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                                                }}
                                                            >
                                                                <Check size={14} /> Received
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const { sendNudge, connect, isConnected } = useChatStore.getState();
                                                                    if (!isConnected) connect();
                                                                    sendNudge(groupId, debt.from._id, user?.name);
                                                                    toast.success('Nudged!', `Reminded ${debt.from.name}`);
                                                                }}
                                                                style={{
                                                                    padding: '8px 10px', borderRadius: '8px',
                                                                    border: '1px solid #fde68a', backgroundColor: '#fffbeb',
                                                                    fontSize: '13px', cursor: 'pointer'
                                                                }}
                                                            >
                                                                Remind
                                                            </button>
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
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{
                                                            padding: '12px 14px',
                                                            borderTop: '1px solid #f0f0f0',
                                                            backgroundColor: '#fafafa',
                                                            display: 'flex', gap: '8px', alignItems: 'center'
                                                        }}>
                                                            <div style={{ position: 'relative', flex: 1 }}>
                                                                <span style={{
                                                                    position: 'absolute', left: '10px', top: '50%',
                                                                    transform: 'translateY(-50%)',
                                                                    fontSize: '13px', fontWeight: '600', color: '#737373'
                                                                }}>₹</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Amount"
                                                                    value={paymentAmount}
                                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                                    autoFocus
                                                                    style={{
                                                                        width: '100%', padding: '8px 10px 8px 26px',
                                                                        borderRadius: '8px', border: '1px solid #d4d4d4',
                                                                        outline: 'none', fontSize: '13px'
                                                                    }}
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Note (optional)"
                                                                value={note}
                                                                onChange={(e) => setNote(e.target.value)}
                                                                style={{
                                                                    flex: 1, padding: '8px 10px',
                                                                    borderRadius: '8px', border: '1px solid #d4d4d4',
                                                                    outline: 'none', fontSize: '13px'
                                                                }}
                                                            />
                                                            <button
                                                                disabled={isProcessing || !paymentAmount}
                                                                onClick={() => handleMarkAsPaid(debt)}
                                                                style={{
                                                                    padding: '8px 14px', borderRadius: '8px',
                                                                    border: 'none', backgroundColor: '#0a0a0a', color: '#fff',
                                                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                                                    opacity: (!paymentAmount || isProcessing) ? 0.5 : 1
                                                                }}
                                                            >
                                                                Pay
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{
                                textAlign: 'center', padding: '48px 24px',
                                color: '#a3a3a3'
                            }}>
                                <CheckCircle size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#525252' }}>All settled up!</p>
                                <p style={{ margin: '4px 0 0', fontSize: '13px' }}>No pending debts</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ==================== HISTORY TAB ==================== */}
                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}
                    >
                        {(settlements || []).length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '48px 24px', color: '#a3a3a3'
                            }}>
                                <Clock size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>No settlement history</p>
                            </div>
                        ) : (
                            (settlements || []).map((s, i) => (
                                <div
                                    key={s._id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '12px 14px',
                                        backgroundColor: '#fff',
                                        borderBottom: i < settlements.length - 1 ? '1px solid #f5f5f5' : 'none',
                                    }}
                                >
                                    <Avatar name={s.from?.name} size="xs" />
                                    <ArrowRight size={12} color="#d4d4d4" />
                                    <Avatar name={s.to?.name} size="xs" />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            margin: 0, fontSize: '13px', fontWeight: '500', color: '#0a0a0a',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {s.from?.name} paid {s.to?.name}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#a3a3a3' }}>
                                            {formatDate(s.createdAt, 'short')}
                                        </p>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{
                                            margin: 0, fontSize: '14px', fontWeight: '700',
                                            color: s.confirmedByRecipient ? '#16a34a' : '#d97706'
                                        }}>
                                            {formatCurrency(s.amount)}
                                        </p>
                                        <span style={{
                                            fontSize: '10px', fontWeight: '600',
                                            color: s.confirmedByRecipient ? '#16a34a' : '#d97706',
                                            textTransform: 'uppercase', letterSpacing: '0.03em'
                                        }}>
                                            {s.confirmedByRecipient ? 'Done' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SettleUp;
