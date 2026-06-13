import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Check, DollarSign,
    FileText, Clock, CheckCircle, AlertCircle,
    Send, ChevronDown, ChevronUp, Wallet, ArrowUpRight, ArrowDownLeft, Bell,
    TrendingDown, TrendingUp, X
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useSettlementStore } from '../../stores/settlementStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { useChatStore } from '../../stores/chatStore';
import { formatCurrency, formatDate, getId, isSameId } from '../../utils/helpers';

export function SettleUp({ groupId, members, isAdmin = false, onClose }) {
    const { user } = useAuthStore();
    const {
        settlements, simplifiedDebts, balances,
        fetchSettlements, fetchBalances, createSettlement,
        confirmSettlement, deleteSettlement, isLoading,
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
        if (!groupId) return;
        const { activeGroupId } = useSettlementStore.getState();
        if (activeGroupId === groupId) return;
        fetchSettlements(groupId, { silent: true });
        fetchBalances(groupId, null, { silent: true });
    }, [groupId, fetchSettlements, fetchBalances]);

    // --- Handlers ---

    const handleMarkAsPaid = async (debt) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const amount = isPartial ? parseFloat(paymentAmount) : debt.amount;
        if (isPartial && (!amount || amount <= 0 || Number.isNaN(amount))) {
            toast.error('Invalid amount', 'Please enter a valid amount');
            setIsProcessing(false); return;
        }
        if (amount > debt.amount) {
            toast.error('Amount too high', 'Cannot pay more than owed');
            setIsProcessing(false); return;
        }
        const result = await createSettlement(groupId, {
            from: getId(debt.from), to: getId(debt.to), amount,
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
            from: getId(debt.from), to: getId(debt.to), amount: debt.amount, note: 'Payment confirmed',
        });
        if (result.success) {
            const confirmResult = await confirmSettlement(groupId, result.settlement._id);
            if (confirmResult.success) {
                toast.success('Payment confirmed!', 'Settlement complete');
                fetchBalances(groupId); fetchSettlements(groupId);
            } else {
                toast.error('Confirm failed', confirmResult.message || 'Payment was recorded but could not be confirmed');
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
        return (settlements || []).some(s =>
            isSameId(s.from, fromUserId) &&
            isSameId(s.to, toUserId) &&
            !s.confirmedByRecipient
        );
    };

    const pendingConfirmations = (settlements || []).filter(s =>
        isSameId(s.to, user?._id) && !s.confirmedByRecipient
    );
    const myPendingPayments = (settlements || []).filter(s =>
        isSameId(s.from, user?._id) && !s.confirmedByRecipient
    );

    // Build debts list from API edges ({ from, to, amount })
    const sortedDebts = (simplifiedDebts || [])
        .filter(edge => edge?.from && edge?.to && edge.amount > 0.01)
        .map(edge => ({
            from: edge.from,
            to: edge.to,
            amount: edge.amount,
            pairKey: `${getId(edge.from)}-${getId(edge.to)}`,
        }))
        .filter(d =>
            (isAdmin && showAllSettlements) ||
            isSameId(d.from, user?._id) ||
            isSameId(d.to, user?._id)
        )
        .sort((a, b) => {
            const aRank = isSameId(a.from, user?._id) ? 0 : isSameId(a.to, user?._id) ? 1 : 2;
            const bRank = isSameId(b.from, user?._id) ? 0 : isSameId(b.to, user?._id) ? 1 : 2;
            return aRank - bRank;
        });

    const canSettleDebt = (debt) => !debt.from?.isPending && !debt.to?.isPending;

    // Split debts into what you owe and what others owe you
    const debtsYouOwe = sortedDebts.filter(d => isSameId(d.from, user?._id));
    const debtsOwedToYou = sortedDebts.filter(d => isSameId(d.to, user?._id));
    const otherDebts = sortedDebts.filter(d =>
        !isSameId(d.from, user?._id) && !isSameId(d.to, user?._id)
    );

    const memberBalances = (balances || [])
        .filter(b => (isAdmin && showAllSettlements) || Math.abs(b.balance) > 0.01)
        .sort((a, b) => b.balance - a.balance);

    const maxAbsBalance = memberBalances.length > 0
        ? Math.max(...memberBalances.map(b => Math.abs(b.balance)), 1) : 1;

    const totalOwed = sortedDebts.filter(d => isSameId(d.to, user?._id)).reduce((s, d) => s + d.amount, 0);
    const totalIOwe = sortedDebts.filter(d => isSameId(d.from, user?._id)).reduce((s, d) => s + d.amount, 0);
    const netBalance = totalOwed - totalIOwe;
    const hasOutstandingDebts = totalIOwe > 0.01 || totalOwed > 0.01;
    const isFullySettled = !hasOutstandingDebts;
    const isNetEven = Math.abs(netBalance) <= 0.01 && hasOutstandingDebts;

    const heroTone = isFullySettled
        ? 'settled'
        : netBalance > 0.01
            ? 'positive'
            : netBalance < -0.01
                ? 'negative'
                : 'even';

    const heroLabel = {
        settled: 'All settled',
        positive: "You're owed",
        negative: 'You owe',
        even: 'Net even',
    }[heroTone];

    const tabItems = [
        { id: 'settle', label: 'Settle Up', icon: Send },
        { id: 'balances', label: 'Balances', icon: Wallet },
        { id: 'history', label: 'History', icon: Clock },
    ];

    // Shared styles
    const cardStyle = {
        borderRadius: '16px',
        backgroundColor: 'var(--bg-elevated, #131316)',
        border: '1px solid var(--border-subtle, #252530)',
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

    const heroStyles = {
        settled: {
            bg: 'var(--bg-surface, #1A1A1F)',
            border: '1px solid var(--border-subtle, #252530)',
            accent: 'var(--text-muted, #8A8680)',
            amount: 'var(--text-muted, #8A8680)',
            glow: 'rgba(138, 134, 128, 0.12)',
        },
        positive: {
            bg: 'var(--success-muted, rgba(69, 194, 133, 0.12))',
            border: '1px solid rgba(69, 194, 133, 0.25)',
            accent: 'var(--success, #45C285)',
            amount: 'var(--success, #45C285)',
            glow: 'rgba(69, 194, 133, 0.15)',
        },
        negative: {
            bg: 'var(--danger-muted, rgba(217, 85, 85, 0.12))',
            border: '1px solid rgba(217, 85, 85, 0.25)',
            accent: 'var(--danger, #D95555)',
            amount: 'var(--danger, #D95555)',
            glow: 'rgba(217, 85, 85, 0.15)',
        },
        even: {
            bg: 'var(--warning-muted, rgba(212, 168, 83, 0.12))',
            border: '1px solid rgba(212, 168, 83, 0.25)',
            accent: 'var(--accent, #D4A853)',
            amount: 'var(--text-primary, #EDEAE4)',
            glow: 'rgba(212, 168, 83, 0.12)',
        },
    }[heroTone];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Net Balance Hero ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                    padding: '20px 22px',
                    borderRadius: '16px',
                    background: heroStyles.bg,
                    border: heroStyles.border,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div style={{
                    position: 'absolute', top: '-24px', right: '-24px',
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: heroStyles.glow,
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {heroTone === 'positive' ? (
                            <TrendingUp size={16} color={heroStyles.accent} />
                        ) : heroTone === 'negative' ? (
                            <TrendingDown size={16} color={heroStyles.accent} />
                        ) : heroTone === 'even' ? (
                            <Sparkles size={16} color={heroStyles.accent} />
                        ) : (
                            <CheckCircle size={16} color={heroStyles.accent} />
                        )}
                        <span style={{
                            fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
                            letterSpacing: '0.06em', color: heroStyles.accent,
                        }}>
                            {heroLabel}
                        </span>
                    </div>
                    <p style={{
                        margin: 0, fontSize: '30px', fontWeight: '800',
                        color: heroStyles.amount,
                        letterSpacing: '-0.02em', lineHeight: 1.1,
                    }}>
                        {formatCurrency(Math.abs(netBalance))}
                    </p>
                    {isNetEven && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-muted, #8A8680)' }}>
                            Your debts cancel out — settle individual payments below.
                        </p>
                    )}
                </div>

                {!isFullySettled && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                        marginTop: '16px', paddingTop: '14px',
                        borderTop: '1px solid var(--border-subtle, #252530)',
                        position: 'relative', zIndex: 1,
                    }}>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                You owe
                            </span>
                            <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: totalIOwe > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
                                {formatCurrency(totalIOwe)}
                            </p>
                        </div>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                You&apos;re owed
                            </span>
                            <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700', color: totalOwed > 0 ? 'var(--success)' : 'var(--text-faint)' }}>
                                {formatCurrency(totalOwed)}
                            </p>
                        </div>
                    </div>
                )}
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
                            border: '1px solid rgba(212, 168, 83, 0.3)',
                            background: 'var(--warning-muted)',
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                borderBottom: '1px solid rgba(212, 168, 83, 0.2)',
                            }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: 'var(--accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <AlertCircle size={14} color="var(--accent-ink)" />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>
                                    {pendingConfirmations.length} pending confirmation{pendingConfirmations.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            {pendingConfirmations.map((s, i) => (
                                <div key={s._id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '14px 16px',
                                    backgroundColor: 'var(--bg-surface)',
                                    borderBottom: i < pendingConfirmations.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                    flexWrap: 'wrap',
                                }}>
                                    <Avatar name={s.from?.name} size="sm" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.from?.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            paid you <strong style={{ color: 'var(--success)' }}>{formatCurrency(s.amount)}</strong>
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleReject(s._id)}
                                            style={{
                                                padding: '7px 14px', borderRadius: '10px',
                                                border: '1px solid var(--border-subtle)',
                                                backgroundColor: 'var(--bg-elevated)',
                                                fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer',
                                            }}
                                        >Decline</motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleConfirmPending(s._id)}
                                            style={{
                                                padding: '7px 16px', borderRadius: '10px',
                                                border: 'none',
                                                background: 'var(--success)',
                                                fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer',
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
                            background: 'var(--danger-muted)',
                            border: '1px solid rgba(217, 85, 85, 0.25)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}
                    >
                        <Clock size={14} color="var(--danger)" />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {myPendingPayments.length} payment{myPendingPayments.length > 1 ? 's' : ''} awaiting confirmation
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Tab Bar ── */}
            <div style={{
                display: 'flex',
                backgroundColor: 'var(--bg-surface, #1A1A1F)',
                padding: '4px',
                borderRadius: '14px',
                gap: '2px',
                border: '1px solid var(--border-subtle, #252530)',
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
                                backgroundColor: isActive ? 'var(--bg-hover, #2A2A32)' : 'transparent',
                                fontWeight: isActive ? '600' : '500',
                                fontSize: '13px',
                                color: isActive ? 'var(--accent, #D4A853)' : 'var(--text-muted, #8A8680)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </motion.button>
                    );
                })}
            </div>

            {/* Admin toggle moved into settle tab toolbar */}
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
                        {isAdmin && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setShowAllSettlements(!showAllSettlements)}
                                    className={showAllSettlements ? 'chip chip-active' : 'chip'}
                                    style={{ fontSize: '12px', padding: '10px 16px' }}
                                >
                                    {showAllSettlements ? 'All members' : 'Show all'}
                                </motion.button>
                            </div>
                        )}

                        {sortedDebts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* ── You Owe Section ── */}
                                {debtsYouOwe.length > 0 && (
                                    <div>
                                        <p style={{ ...sectionLabelStyle, color: 'var(--danger, #D95555)' }}>
                                            You owe ({debtsYouOwe.length})
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {debtsYouOwe.map((debt, i) => (
                                                <DebtCard
                                                    key={debt.pairKey}
                                                    debt={debt}
                                                    index={i}
                                                    isExpanded={expandedDebt === debt.pairKey}
                                                    isPending={hasPendingSettlement(debt.from, debt.to)}
                                                    canSettle={canSettleDebt(debt)}
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
                                        <p style={{ ...sectionLabelStyle, color: 'var(--success, #45C285)' }}>
                                            Owed to you ({debtsOwedToYou.length})
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {debtsOwedToYou.map((debt, i) => (
                                                <OwedToYouCard
                                                    key={debt.pairKey}
                                                    debt={debt}
                                                    index={i}
                                                    isPending={hasPendingSettlement(debt.from, debt.to)}
                                                    canSettle={canSettleDebt(debt)}
                                                    isProcessing={isProcessing}
                                                    onConfirm={() => handleQuickConfirm(debt)}
                                                    onNudge={() => {
                                                        const { sendNudge, connect, isConnected } = useChatStore.getState();
                                                        if (!isConnected) connect();
                                                        sendNudge(groupId, getId(debt.from), user?.name);
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
                                        <p style={{ ...sectionLabelStyle, color: 'var(--text-muted)' }}>
                                            Other debts ({otherDebts.length})
                                        </p>
                                        <div style={{ ...cardStyle }}>
                                            {otherDebts.map((debt, i) => (
                                                <div key={debt.pairKey} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '14px 16px',
                                                    borderBottom: i < otherDebts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                                }}>
                                                    <Avatar name={debt.from.name} size="sm" />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{
                                                            margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {debt.from.name}
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> owes </span>
                                                            {debt.to.name}
                                                        </p>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', flexShrink: 0 }}>
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
                                    const isMe = isSameId(b.user, user?._id);
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
                                                borderBottom: i < memberBalances.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                                backgroundColor: isMe ? 'rgba(212, 168, 83, 0.08)' : 'transparent',
                                                transition: 'background-color 0.15s',
                                            }}
                                        >
                                            <Avatar name={b.user?.name} size="sm" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '14px', fontWeight: isMe ? '600' : '500', color: 'var(--text-primary)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {b.user?.name}
                                                    </p>
                                                    {isMe && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '600',
                                                            padding: '2px 6px', borderRadius: '6px',
                                                            backgroundColor: 'rgba(212, 168, 83, 0.15)', color: 'var(--accent)',
                                                        }}>you</span>
                                                    )}
                                                    {b.isPending && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '600',
                                                            padding: '2px 6px', borderRadius: '6px',
                                                            backgroundColor: 'var(--warning-muted)', color: 'var(--accent)',
                                                        }}>pending</span>
                                                    )}
                                                </div>
                                                {/* Balance bar */}
                                                {!isZero && (
                                                    <div style={{
                                                        marginTop: '8px', height: '4px',
                                                        backgroundColor: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden',
                                                    }}>
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${barWidth}%` }}
                                                            transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                                                            style={{
                                                                height: '100%', borderRadius: '2px',
                                                                background: isPositive
                                                                    ? 'linear-gradient(90deg, #45C285, #69d49a)'
                                                                    : 'linear-gradient(90deg, #D95555, #e57373)',
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
                                                        backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)',
                                                    }}>settled</span>
                                                ) : (
                                                    <p style={{
                                                        margin: 0, fontSize: '15px', fontWeight: '700',
                                                        color: isPositive ? 'var(--success)' : 'var(--danger)',
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
                                            borderBottom: i < settlements.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                        }}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: s.confirmedByRecipient
                                                ? 'var(--success-muted)'
                                                : 'var(--warning-muted)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {s.confirmedByRecipient
                                                ? <CheckCircle size={18} color="var(--success)" />
                                                : <Clock size={18} color="var(--accent)" />
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {s.from?.name} <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>paid</span> {s.to?.name}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {formatDate(s.createdAt, 'short')}
                                                </span>
                                                {!s.confirmedByRecipient && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '600',
                                                        padding: '2px 6px', borderRadius: '6px',
                                                        backgroundColor: 'var(--warning-muted)', color: 'var(--accent)',
                                                    }}>pending</span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '15px', fontWeight: '700', flexShrink: 0,
                                            color: s.confirmedByRecipient ? 'var(--success)' : 'var(--accent)',
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
function PendingSettleNotice({ member }) {
    const phoneHint = member?.phone ? ` (${member.phone})` : '';
    return (
        <div style={{
            flex: '1 1 100%',
            padding: '10px 14px', borderRadius: '10px',
            backgroundColor: 'var(--warning-muted)',
            border: '1px solid rgba(212, 168, 83, 0.3)',
            fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: '500',
            lineHeight: 1.4,
        }}>
            {member?.name || 'They'} haven&apos;t joined yet. Ask them to sign up with their phone{phoneHint} to settle in the app.
        </div>
    );
}
function DebtCard({
    debt, index, isExpanded, isPending, canSettle, isProcessing,
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={debt.to.name} size="sm" />
                        <div style={{
                            position: 'absolute', bottom: '-3px', right: '-3px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'var(--danger)',
                            border: '2px solid var(--bg-elevated)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ArrowUpRight size={8} color="#fff" />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            Pay {debt.to.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>You owe</p>
                    </div>
                    <div style={{
                        padding: '6px 12px', borderRadius: '10px',
                        background: 'var(--danger-muted)',
                        border: '1px solid rgba(217, 85, 85, 0.25)',
                        flexShrink: 0,
                    }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--danger)', letterSpacing: '-0.01em' }}>
                            {formatCurrency(debt.amount)}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {!canSettle ? (
                        <PendingSettleNotice member={debt.to?.isPending ? debt.to : debt.from} />
                    ) : isPending ? (
                        <div style={{
                            flex: '1 1 100%',
                            padding: '10px 14px', borderRadius: '10px',
                            background: 'var(--warning-muted)',
                            border: '1px solid rgba(212, 168, 83, 0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                            <Clock size={13} color="var(--accent)" />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                Pending confirmation
                            </span>
                        </div>
                    ) : (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.97 }}
                                disabled={isProcessing}
                                onClick={onPayFull}
                                style={{
                                    flex: '1 1 160px',
                                    minWidth: 0,
                                    padding: '11px 16px', borderRadius: '12px',
                                    border: 'none',
                                    background: 'var(--accent)',
                                    color: 'var(--accent-ink, #1A0800)',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    opacity: isProcessing ? 0.7 : 1,
                                }}
                            >
                                <Send size={13} /> Pay {formatCurrency(debt.amount)}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={onTogglePartial}
                                style={{
                                    flex: '0 1 auto',
                                    padding: '11px 16px', borderRadius: '12px',
                                    border: isExpanded ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                    backgroundColor: isExpanded ? 'var(--bg-hover)' : 'var(--bg-surface)',
                                    fontSize: '12px', fontWeight: '600',
                                    color: isExpanded ? 'var(--accent)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
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
                            padding: '14px 18px', borderTop: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
                        }}>
                            <div style={{ position: 'relative', flex: '1 1 120px', minWidth: 0 }}>
                                <span style={{
                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)',
                                }}>&#8377;</span>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={paymentAmount}
                                    onChange={onAmountChange}
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '10px 10px 10px 28px',
                                        borderRadius: '10px', border: '1.5px solid var(--border-subtle)',
                                        outline: 'none', fontSize: '14px',
                                        backgroundColor: 'var(--bg-elevated)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Note (optional)"
                                value={note}
                                onChange={onNoteChange}
                                style={{
                                    flex: '1 1 100px', minWidth: 0, padding: '10px 12px',
                                    borderRadius: '10px', border: '1.5px solid var(--border-subtle)',
                                    outline: 'none', fontSize: '14px',
                                    backgroundColor: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                disabled={isProcessing || !paymentAmount}
                                onClick={onPayPartial}
                                style={{
                                    flex: '0 1 auto',
                                    padding: '10px 20px', borderRadius: '10px',
                                    border: 'none',
                                    background: (!paymentAmount || isProcessing) ? 'var(--border-default)' : 'var(--accent)',
                                    color: (!paymentAmount || isProcessing) ? 'var(--text-muted)' : 'var(--accent-ink)',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
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
function OwedToYouCard({ debt, index, isPending, canSettle, isProcessing, onConfirm, onNudge, cardStyle }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{ ...cardStyle, overflow: 'hidden' }}
        >
            <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={debt.from.name} size="sm" />
                        <div style={{
                            position: 'absolute', bottom: '-3px', right: '-3px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'var(--success)',
                            border: '2px solid var(--bg-elevated)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <ArrowDownLeft size={8} color="#fff" />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {debt.from.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Owes you</p>
                    </div>
                    <div style={{
                        padding: '6px 12px', borderRadius: '10px',
                        background: 'var(--success-muted)',
                        border: '1px solid rgba(69, 194, 133, 0.25)',
                        flexShrink: 0,
                    }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--success)', letterSpacing: '-0.01em' }}>
                            {formatCurrency(debt.amount)}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {!canSettle ? (
                        <PendingSettleNotice member={debt.from?.isPending ? debt.from : debt.to} />
                    ) : isPending ? (
                        <div style={{
                            flex: '1 1 100%',
                            padding: '10px 14px', borderRadius: '10px',
                            background: 'var(--warning-muted)',
                            border: '1px solid rgba(212, 168, 83, 0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                            <Clock size={13} color="var(--accent)" />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                Pending confirmation
                            </span>
                        </div>
                    ) : (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.97 }}
                                disabled={isProcessing}
                                onClick={onConfirm}
                                style={{
                                    flex: '1 1 160px',
                                    minWidth: 0,
                                    padding: '11px 16px', borderRadius: '12px',
                                    border: 'none',
                                    background: 'var(--success)',
                                    color: '#fff',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    opacity: isProcessing ? 0.7 : 1,
                                }}
                            >
                                <Check size={14} /> Mark Received
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onNudge}
                                style={{
                                    padding: '11px 14px', borderRadius: '12px',
                                    border: '1px solid var(--border-subtle)',
                                    backgroundColor: 'var(--bg-surface)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                                title={`Remind ${debt.from.name}`}
                            >
                                <Bell size={14} color="var(--accent)" />
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
                borderRadius: '16px',
                background: 'var(--success-muted)',
                border: '1px solid rgba(69, 194, 133, 0.25)',
            }}
        >
            <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'rgba(69, 194, 133, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                }}
            >
                <CheckCircle size={28} color="var(--success)" />
            </motion.div>
            <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: 'var(--success)' }}>
                All settled up!
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                No one owes anyone in this group.
            </p>
        </motion.div>
    );
}

/* ── Generic Empty State ── */
function EmptyState({ icon: Icon, title, subtitle, color = 'var(--text-muted)' }) {
    return (
        <div style={{
            textAlign: 'center', padding: '48px 24px',
            borderRadius: '16px', backgroundColor: 'var(--bg-elevated)',
            border: '1px dashed var(--border-default)',
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                backgroundColor: 'var(--bg-surface)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
            }}>
                <Icon size={22} color={color} />
            </div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{title}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
    );
}

export default SettleUp;
