import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Check, DollarSign,
    FileText, Clock, CheckCircle, AlertCircle,
    Send, ChevronDown, ChevronUp, Wallet, ArrowUpRight, ArrowDownLeft, Bell,
    Sparkles, TrendingDown, TrendingUp, X
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

    const [activeTab, setActiveTab] = useState('settle');
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

    // Split debts into what you owe and what others owe you
    const debtsYouOwe = sortedDebts.filter(d => d.from._id === user?._id);
    const debtsOwedToYou = sortedDebts.filter(d => d.to._id === user?._id);
    const otherDebts = sortedDebts.filter(d => d.from._id !== user?._id && d.to._id !== user?._id);

    const memberBalances = (balances || [])
        .filter(b => (isAdmin && showAllSettlements) || Math.abs(b.balance) > 0.01)
        .sort((a, b) => b.balance - a.balance);

    const maxAbsBalance = memberBalances.length > 0
        ? Math.max(...memberBalances.map(b => Math.abs(b.balance)), 1) : 1;

    const totalOwed = sortedDebts.filter(d => d.to._id === user?._id).reduce((s, d) => s + d.amount, 0);
    const totalIOwe = sortedDebts.filter(d => d.from._id === user?._id).reduce((s, d) => s + d.amount, 0);
    const netBalance = totalOwed - totalIOwe;

    const tabItems = [
        { id: 'settle', label: 'Settle Up', icon: Send },
        { id: 'balances', label: 'Balances', icon: Wallet },
        { id: 'history', label: 'History', icon: Clock },
    ];

    // Shared styles
    const cardStyle = {
        borderRadius: '16px',
        backgroundColor: '#fff',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        overflow: 'hidden',
    };

    const sectionLabelStyle = {
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '0 4px',
        marginBottom: '10px',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Net Balance Hero ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                    padding: '24px',
                    borderRadius: '20px',
                    background: netBalance > 0
                        ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                        : netBalance < 0
                            ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca40 100%)'
                            : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: netBalance > 0
                        ? '1px solid #a7f3d0'
                        : netBalance < 0
                            ? '1px solid #fecaca'
                            : '1px solid #e2e8f0',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background decorative circle */}
                <div style={{
                    position: 'absolute', top: '-20px', right: '-20px',
                    width: '120px', height: '120px', borderRadius: '50%',
                    background: netBalance > 0
                        ? 'rgba(16,185,129,0.08)'
                        : netBalance < 0
                            ? 'rgba(239,68,68,0.06)'
                            : 'rgba(148,163,184,0.08)',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {netBalance > 0 ? (
                            <TrendingUp size={16} color="#059669" />
                        ) : netBalance < 0 ? (
                            <TrendingDown size={16} color="#dc2626" />
                        ) : (
                            <CheckCircle size={16} color="#64748b" />
                        )}
                        <span style={{
                            fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: netBalance > 0 ? '#059669' : netBalance < 0 ? '#dc2626' : '#64748b',
                        }}>
                            {netBalance > 0 ? 'You\'re owed' : netBalance < 0 ? 'You owe' : 'All settled'}
                        </span>
                    </div>
                    <p style={{
                        margin: 0, fontSize: '32px', fontWeight: '800',
                        color: netBalance > 0 ? '#065f46' : netBalance < 0 ? '#991b1b' : '#64748b',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                    }}>
                        {formatCurrency(Math.abs(netBalance))}
                    </p>
                </div>

                {/* Sub-stats */}
                <div style={{
                    display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '14px',
                    borderTop: `1px solid ${netBalance > 0 ? 'rgba(16,185,129,0.15)' : netBalance < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.15)'}`,
                    position: 'relative', zIndex: 1,
                }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            You owe
                        </span>
                        <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: totalIOwe > 0 ? '#ef4444' : '#94a3b8' }}>
                            {formatCurrency(totalIOwe)}
                        </p>
                    </div>
                    <div style={{ width: '1px', backgroundColor: netBalance > 0 ? 'rgba(16,185,129,0.15)' : netBalance < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.15)' }} />
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            You're owed
                        </span>
                        <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: totalOwed > 0 ? '#16a34a' : '#94a3b8' }}>
                            {formatCurrency(totalOwed)}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ── Pending Confirmations ── */}
            <AnimatePresence>
                {pendingConfirmations.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            ...cardStyle,
                            border: '1px solid #fde68a',
                            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                borderBottom: '1px solid rgba(253,230,138,0.5)',
                            }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(245,158,11,0.2)',
                                }}>
                                    <AlertCircle size={14} color="#fff" />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                                    {pendingConfirmations.length} pending confirmation{pendingConfirmations.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            {pendingConfirmations.map((s, i) => (
                                <div key={s._id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '14px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.7)',
                                    backdropFilter: 'blur(8px)',
                                    borderBottom: i < pendingConfirmations.length - 1 ? '1px solid rgba(253,230,138,0.3)' : 'none',
                                }}>
                                    <Avatar name={s.from?.name} size="sm" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>{s.from?.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#78716c' }}>
                                            paid you <strong style={{ color: '#059669' }}>{formatCurrency(s.amount)}</strong>
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleReject(s._id)}
                                            style={{
                                                padding: '7px 14px', borderRadius: '10px',
                                                border: '1px solid #e5e7eb', backgroundColor: '#fff',
                                                fontSize: '13px', fontWeight: '600', color: '#6b7280', cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                        >Decline</motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleConfirmPending(s._id)}
                                            style={{
                                                padding: '7px 16px', borderRadius: '10px',
                                                border: 'none',
                                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                                fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                                            }}
                                        >Confirm</motion.button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── My Pending Payments Banner ── */}
            <AnimatePresence>
                {myPendingPayments.length > 0 && activeTab !== 'history' && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        style={{
                            padding: '10px 14px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
                            border: '1px solid #fecaca',
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}
                    >
                        <Clock size={14} color="#ef4444" />
                        <span style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>
                            {myPendingPayments.length} payment{myPendingPayments.length > 1 ? 's' : ''} awaiting confirmation
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Tab Bar ── */}
            <div style={{
                display: 'flex', backgroundColor: '#f4f4f5',
                padding: '4px', borderRadius: '14px', gap: '2px',
            }}>
                {tabItems.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <motion.button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                flex: 1, padding: '10px 8px', borderRadius: '11px',
                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                backgroundColor: isActive ? '#fff' : 'transparent',
                                fontWeight: isActive ? '600' : '500',
                                fontSize: '13px',
                                color: isActive ? '#0a0a0a' : '#71717a',
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </motion.button>
                    );
                })}
            </div>

            {/* Admin toggle */}
            {isAdmin && activeTab !== 'history' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2px' }}>
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowAllSettlements(!showAllSettlements)}
                        style={{
                            padding: '5px 14px', borderRadius: '20px',
                            border: showAllSettlements ? '1px solid #93c5fd' : '1px solid #e5e5e5',
                            backgroundColor: showAllSettlements ? '#eff6ff' : '#fff',
                            fontSize: '12px', fontWeight: '500',
                            color: showAllSettlements ? '#2563eb' : '#737373',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {showAllSettlements ? 'All members' : 'Show all'}
                    </motion.button>
                </div>
            )}

            <AnimatePresence mode="wait">

                {/* ==================== SETTLE UP TAB ==================== */}
                {activeTab === 'settle' && (
                    <motion.div
                        key="settle"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                    >
                        {/* Simplify toggle */}
                        <motion.div
                            whileTap={{ scale: 0.99 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', borderRadius: '14px',
                                backgroundColor: isSimplified ? '#f0fdf4' : '#fafafa',
                                border: isSimplified ? '1px solid #bbf7d0' : '1px solid #f0f0f0',
                                cursor: 'pointer', transition: 'all 0.2s',
                                userSelect: 'none',
                            }}
                            onClick={() => toggleSimplify(groupId)}
                        >
                            <div style={{
                                width: '40px', height: '22px', borderRadius: '11px',
                                backgroundColor: isSimplified ? '#16a34a' : '#d4d4d8',
                                position: 'relative', transition: 'background-color 0.25s ease', flexShrink: 0,
                            }}>
                                <motion.div
                                    animate={{ left: isSimplified ? '20px' : '2px' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    style={{
                                        width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff',
                                        position: 'absolute', top: '2px',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={13} color={isSimplified ? '#16a34a' : '#a1a1aa'} />
                                    <span style={{ fontSize: '13px', color: '#0a0a0a', fontWeight: '600' }}>Simplify debts</span>
                                </div>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#a1a1aa' }}>
                                    {isSimplified ? 'Minimized number of payments' : 'Showing all individual debts'}
                                </p>
                            </div>
                        </motion.div>

                        {sortedDebts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* ── You Owe Section ── */}
                                {debtsYouOwe.length > 0 && (
                                    <div>
                                        <p style={{ ...sectionLabelStyle, color: '#ef4444' }}>
                                            You owe ({debtsYouOwe.length})
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {debtsYouOwe.map((debt, i) => (
                                                <DebtCard
                                                    key={debt.pairKey}
                                                    debt={debt}
                                                    type="owe"
                                                    index={i}
                                                    isExpanded={expandedDebt === debt.pairKey}
                                                    isPending={hasPendingSettlement(debt.from._id, debt.to._id)}
                                                    isProcessing={isProcessing}
                                                    paymentAmount={paymentAmount}
                                                    note={note}
                                                    onPayFull={() => { setIsPartial(false); handleMarkAsPaid(debt); }}
                                                    onTogglePartial={() => {
                                                        if (expandedDebt === debt.pairKey) resetForm();
                                                        else { setExpandedDebt(debt.pairKey); setIsPartial(true); setPaymentAmount(''); }
                                                    }}
                                                    onPayPartial={() => handleMarkAsPaid(debt)}
                                                    onAmountChange={(e) => setPaymentAmount(e.target.value)}
                                                    onNoteChange={(e) => setNote(e.target.value)}
                                                    cardStyle={cardStyle}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Owed To You Section ── */}
                                {debtsOwedToYou.length > 0 && (
                                    <div>
                                        <p style={{ ...sectionLabelStyle, color: '#16a34a' }}>
                                            Owed to you ({debtsOwedToYou.length})
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {debtsOwedToYou.map((debt, i) => (
                                                <OwedToYouCard
                                                    key={debt.pairKey}
                                                    debt={debt}
                                                    index={i}
                                                    isPending={hasPendingSettlement(debt.from._id, debt.to._id)}
                                                    isProcessing={isProcessing}
                                                    onConfirm={() => handleQuickConfirm(debt)}
                                                    onNudge={() => {
                                                        const { sendNudge, connect, isConnected } = useChatStore.getState();
                                                        if (!isConnected) connect();
                                                        sendNudge(groupId, debt.from._id, user?.name);
                                                        toast.success('Nudged!', `Reminded ${debt.from.name}`);
                                                    }}
                                                    cardStyle={cardStyle}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Other Debts (Admin view) ── */}
                                {otherDebts.length > 0 && (
                                    <div>
                                        <p style={{ ...sectionLabelStyle, color: '#71717a' }}>
                                            Other debts ({otherDebts.length})
                                        </p>
                                        <div style={{ ...cardStyle }}>
                                            {otherDebts.map((debt, i) => (
                                                <div key={debt.pairKey} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '14px 16px',
                                                    borderBottom: i < otherDebts.length - 1 ? '1px solid #f5f5f5' : 'none',
                                                }}>
                                                    <Avatar name={debt.from.name} size="sm" />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{
                                                            margin: 0, fontSize: '14px', fontWeight: '500', color: '#3f3f46',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {debt.from.name}
                                                            <span style={{ color: '#a1a1aa', fontWeight: '400' }}> owes </span>
                                                            {debt.to.name}
                                                        </p>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#52525b', flexShrink: 0 }}>
                                                        {formatCurrency(debt.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <SettledEmptyState />
                        )}
                    </motion.div>
                )}

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
                            <div style={cardStyle}>
                                {memberBalances.map((b, i) => {
                                    const isMe = b.user?._id === user?._id;
                                    const isPositive = b.balance > 0;
                                    const isZero = Math.abs(b.balance) <= 0.01;
                                    const barWidth = isZero ? 0 : (Math.abs(b.balance) / maxAbsBalance) * 100;

                                    return (
                                        <motion.div
                                            key={b.user?._id || i}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '14px',
                                                padding: '16px 18px',
                                                borderBottom: i < memberBalances.length - 1 ? '1px solid #f4f4f5' : 'none',
                                                backgroundColor: isMe ? '#fafaff' : 'transparent',
                                                transition: 'background-color 0.15s',
                                            }}
                                        >
                                            <Avatar name={b.user?.name} size="sm" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '14px', fontWeight: isMe ? '600' : '500', color: '#18181b',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {b.user?.name}
                                                    </p>
                                                    {isMe && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '600',
                                                            padding: '2px 6px', borderRadius: '6px',
                                                            backgroundColor: '#ede9fe', color: '#7c3aed',
                                                        }}>you</span>
                                                    )}
                                                    {b.isPending && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '600',
                                                            padding: '2px 6px', borderRadius: '6px',
                                                            backgroundColor: '#fef3c7', color: '#d97706',
                                                        }}>pending</span>
                                                    )}
                                                </div>
                                                {/* Balance bar */}
                                                {!isZero && (
                                                    <div style={{
                                                        marginTop: '8px', height: '4px',
                                                        backgroundColor: '#f4f4f5', borderRadius: '2px', overflow: 'hidden',
                                                    }}>
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${barWidth}%` }}
                                                            transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                                                            style={{
                                                                height: '100%', borderRadius: '2px',
                                                                background: isPositive
                                                                    ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                                                                    : 'linear-gradient(90deg, #fca5a5, #ef4444)',
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                {isZero ? (
                                                    <span style={{
                                                        fontSize: '12px', fontWeight: '600',
                                                        padding: '4px 10px', borderRadius: '8px',
                                                        backgroundColor: '#f4f4f5', color: '#a1a1aa',
                                                    }}>settled</span>
                                                ) : (
                                                    <p style={{
                                                        margin: 0, fontSize: '15px', fontWeight: '700',
                                                        color: isPositive ? '#059669' : '#dc2626',
                                                    }}>
                                                        {isPositive ? '+' : ''}{formatCurrency(b.balance)}
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState
                                icon={CheckCircle}
                                title="No balances yet"
                                subtitle="Add an expense to get started"
                            />
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
                            <div style={cardStyle}>
                                {(settlements || []).map((s, i) => (
                                    <motion.div
                                        key={s._id}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '16px 18px',
                                            borderBottom: i < settlements.length - 1 ? '1px solid #f4f4f5' : 'none',
                                        }}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: s.confirmedByRecipient
                                                ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                                                : 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {s.confirmedByRecipient
                                                ? <CheckCircle size={18} color="#059669" />
                                                : <Clock size={18} color="#d97706" />
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0, fontSize: '14px', fontWeight: '500', color: '#18181b',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {s.from?.name} <span style={{ color: '#a1a1aa', fontWeight: '400' }}>paid</span> {s.to?.name}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                                                    {formatDate(s.createdAt, 'short')}
                                                </span>
                                                {!s.confirmedByRecipient && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '600',
                                                        padding: '2px 6px', borderRadius: '6px',
                                                        backgroundColor: '#fef3c7', color: '#d97706',
                                                    }}>pending</span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '15px', fontWeight: '700', flexShrink: 0,
                                            color: s.confirmedByRecipient ? '#059669' : '#d97706',
                                        }}>
                                            {formatCurrency(s.amount)}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Debt Card (You owe someone) ── */
function DebtCard({
    debt, type, index, isExpanded, isPending, isProcessing,
    paymentAmount, note, onPayFull, onTogglePartial, onPayPartial,
    onAmountChange, onNoteChange, cardStyle,
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{ ...cardStyle, overflow: 'hidden' }}
        >
            <div style={{ padding: '16px 18px' }}>
                {/* Top row: avatar + info + amount */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={debt.to.name} size="sm" />
                        <div style={{
                            position: 'absolute', bottom: '-3px', right: '-3px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fecaca, #fca5a5)',
                            border: '2px solid #fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ArrowUpRight size={8} color="#dc2626" />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontSize: '15px', fontWeight: '600', color: '#18181b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {debt.to.name}
                        </p>
                    </div>
                    <div style={{
                        padding: '5px 12px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #fef2f2, #fecaca30)',
                        border: '1px solid #fecaca60',
                    }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#dc2626', letterSpacing: '-0.01em' }}>
                            {formatCurrency(debt.amount)}
                        </span>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    {isPending ? (
                        <div style={{
                            flex: 1, padding: '9px 14px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                            border: '1px solid #fde68a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                            <Clock size={13} color="#d97706" />
                            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                                Pending confirmation
                            </span>
                        </div>
                    ) : (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                whileTap={{ scale: 0.97 }}
                                disabled={isProcessing}
                                onClick={onPayFull}
                                style={{
                                    flex: 1, padding: '10px 16px', borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #18181b, #27272a)',
                                    color: '#fff',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                <Send size={13} /> Pay {formatCurrency(debt.amount)}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02, backgroundColor: '#f4f4f5' }}
                                whileTap={{ scale: 0.97 }}
                                onClick={onTogglePartial}
                                style={{
                                    padding: '10px 16px', borderRadius: '12px',
                                    border: isExpanded ? '1px solid #a1a1aa' : '1px solid #e4e4e7',
                                    backgroundColor: isExpanded ? '#f4f4f5' : '#fff',
                                    fontSize: '12px', fontWeight: '600',
                                    color: isExpanded ? '#18181b' : '#52525b',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                {isExpanded ? 'Cancel' : 'Partial'}
                            </motion.button>
                        </>
                    )}
                </div>
            </div>

            {/* Expanded Partial Payment */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            padding: '14px 18px', borderTop: '1px solid #f4f4f5',
                            backgroundColor: '#fafafa',
                            display: 'flex', gap: '8px', alignItems: 'center',
                        }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <span style={{
                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '14px', fontWeight: '600', color: '#a1a1aa',
                                }}>&#8377;</span>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={paymentAmount}
                                    onChange={onAmountChange}
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '10px 10px 10px 28px',
                                        borderRadius: '10px', border: '1.5px solid #e4e4e7',
                                        outline: 'none', fontSize: '14px',
                                        backgroundColor: '#fff',
                                        transition: 'border-color 0.15s',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#a1a1aa'}
                                    onBlur={(e) => e.target.style.borderColor = '#e4e4e7'}
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Note (optional)"
                                value={note}
                                onChange={onNoteChange}
                                style={{
                                    width: '110px', padding: '10px 12px',
                                    borderRadius: '10px', border: '1.5px solid #e4e4e7',
                                    outline: 'none', fontSize: '14px',
                                    backgroundColor: '#fff',
                                    transition: 'border-color 0.15s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#a1a1aa'}
                                onBlur={(e) => e.target.style.borderColor = '#e4e4e7'}
                            />
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                disabled={isProcessing || !paymentAmount}
                                onClick={onPayPartial}
                                style={{
                                    padding: '10px 20px', borderRadius: '10px',
                                    border: 'none',
                                    background: (!paymentAmount || isProcessing)
                                        ? '#d4d4d8'
                                        : 'linear-gradient(135deg, #18181b, #27272a)',
                                    color: '#fff',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    transition: 'background 0.15s',
                                }}
                            >
                                Pay
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/* ── Owed To You Card ── */
function OwedToYouCard({ debt, index, isPending, isProcessing, onConfirm, onNudge, cardStyle }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{ ...cardStyle, overflow: 'hidden' }}
        >
            <div style={{ padding: '16px 18px' }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={debt.from.name} size="sm" />
                        <div style={{
                            position: 'absolute', bottom: '-3px', right: '-3px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #bbf7d0, #86efac)',
                            border: '2px solid #fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ArrowDownLeft size={8} color="#16a34a" />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontSize: '15px', fontWeight: '600', color: '#18181b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {debt.from.name}
                        </p>
                    </div>
                    <div style={{
                        padding: '5px 12px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f0fdf4, #bbf7d020)',
                        border: '1px solid #bbf7d060',
                    }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#059669', letterSpacing: '-0.01em' }}>
                            {formatCurrency(debt.amount)}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    {isPending ? (
                        <div style={{
                            flex: 1, padding: '9px 14px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                            border: '1px solid #fde68a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                            <Clock size={13} color="#d97706" />
                            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                                Pending confirmation
                            </span>
                        </div>
                    ) : (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(22,163,74,0.2)' }}
                                whileTap={{ scale: 0.97 }}
                                disabled={isProcessing}
                                onClick={onConfirm}
                                style={{
                                    flex: 1, padding: '10px 16px', borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #059669, #10b981)',
                                    color: '#fff',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    boxShadow: '0 2px 8px rgba(16,163,74,0.2)',
                                    opacity: isProcessing ? 0.7 : 1,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                <Check size={14} /> Mark Received
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05, backgroundColor: '#fef3c7' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onNudge}
                                style={{
                                    padding: '10px 14px', borderRadius: '12px',
                                    border: '1px solid #fde68a', backgroundColor: '#fffbeb',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                    transition: 'all 0.15s',
                                }}
                                title={`Remind ${debt.from.name}`}
                            >
                                <Bell size={14} color="#d97706" />
                            </motion.button>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/* ── All Settled Empty State ── */
function SettledEmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
                textAlign: 'center', padding: '48px 28px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #d1fae5 100%)',
                border: '1px solid #a7f3d0',
                position: 'relative', overflow: 'hidden',
            }}
        >
            <div style={{
                position: 'absolute', top: '-30px', right: '-30px',
                width: '120px', height: '120px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.08)',
            }} />
            <div style={{
                position: 'absolute', bottom: '-20px', left: '-20px',
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.06)',
            }} />
            <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', position: 'relative', zIndex: 1,
                }}
            >
                <CheckCircle size={28} color="#059669" />
            </motion.div>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#065f46', position: 'relative', zIndex: 1 }}>
                All settled up!
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6ee7b7', fontWeight: '500', position: 'relative', zIndex: 1 }}>
                No pending debts in this group
            </p>
        </motion.div>
    );
}

/* ── Generic Empty State ── */
function EmptyState({ icon: Icon, title, subtitle, color = '#a1a1aa' }) {
    return (
        <div style={{
            textAlign: 'center', padding: '48px 24px',
            borderRadius: '16px', backgroundColor: '#fafafa',
            border: '1px dashed #e4e4e7',
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                backgroundColor: '#f4f4f5', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
            }}>
                <Icon size={22} color={color} />
            </div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#52525b' }}>{title}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a1a1aa' }}>{subtitle}</p>
        </div>
    );
}

export default SettleUp;
