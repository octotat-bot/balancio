import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Receipt,
    Scale,
    Users,
    Settings,
    Plus,
    Trash2,
    Edit,
    CreditCard,
    User,
    Phone,
    Crown,
    UserPlus,
    Send,
    CheckCircle,
    Utensils,
    ShoppingBag,
    Car,
    Home,
    Zap,
    Film,
    Coffee,
    Plane,
    Gift,
    TrendingUp,
    MessageCircle,
    Download
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useGroupStore } from '../../stores/groupStore';
import { useExpenseStore } from '../../stores/expenseStore';
import { useAuthStore } from '../../stores/authStore';
import { useSettlementStore } from '../../stores/settlementStore';
import { useChatStore } from '../../stores/chatStore';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatDate, simplifyDebts } from '../../utils/helpers';
import AddExpense from '../../components/expenses/AddExpense';
import EditExpense from '../../components/expenses/EditExpense';
import EditGroup from '../../components/groups/EditGroup';
import SettleUp from '../../components/settlements/SettleUp';
import { GroupChat } from '../../components/groups/GroupChat';
import BudgetManager from '../../components/groups/BudgetManager';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const tabs = [
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'owes', label: 'Who Owes', icon: Scale },
    { id: 'activity', label: 'Activity', icon: Receipt },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
};

export function GroupDetail() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAuthStore();
    const { currentGroup, fetchGroup, deleteGroup, addMember, promoteToAdmin, removeMember, removePendingMember, isLoading: groupLoading } = useGroupStore();
    const { expenses, fetchExpenses, deleteExpense, isLoading: expenseLoading } = useExpenseStore();
    const { messages, fetchMessages, sendMessage, joinGroup, leaveGroup, isConnected, socket } = useChatStore();
    const {
        settlements: allSettlements,
        simplifiedDebts,
        balances: settlementBalances,
        fetchBalances,
        fetchSettlements
    } = useSettlementStore();

    const [activeTab, setActiveTab] = useState('expenses');
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [showEditExpense, setShowEditExpense] = useState(false);
    const [showEditGroup, setShowEditGroup] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showSettleUp, setShowSettleUp] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');

    // Confirm dialog states
    const [showDeleteExpenseConfirm, setShowDeleteExpenseConfirm] = useState(false);
    const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [memberToRemove, setMemberToRemove] = useState(null);

    // Listen for nudges
    useEffect(() => {
        const handleNudge = (e) => {
            const { toUserId, fromUserName } = e.detail;
            if (user?._id === toUserId) {
                toast.info('👋 Nudge!', `${fromUserName} is reminding you to settle up.`);
            }
        };

        window.addEventListener('app:nudge', handleNudge);
        return () => window.removeEventListener('app:nudge', handleNudge);
    }, [user?._id]);

    // Initial Data Fetching
    useEffect(() => {
        if (groupId) {
            fetchGroup(groupId);
            fetchExpenses(groupId);
            fetchSettlements(groupId);
            fetchBalances(groupId); // Uses store default/current state
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    // Socket Connection & Realtime Updates
    useEffect(() => {
        if (groupId && isConnected) {
            joinGroup(groupId, user?._id);

            // Listen for Realtime Updates
            if (socket) {
                const handleUpdate = (data) => {
                    // console.log('Realtime Update:', data);
                    if (data.type.includes('EXPENSE')) {
                        fetchExpenses(groupId);
                        fetchBalances(groupId);
                    }
                    if (data.type.includes('SETTLEMENT')) {
                        fetchSettlements(groupId);
                        fetchBalances(groupId);
                    }
                };

                if (socket) {
                    socket.on('group_update', handleUpdate);
                    socket.on('settlement_update', handleUpdate);
                }

                return () => {
                    if (socket) {
                        socket.off('group_update', handleUpdate);
                        socket.off('settlement_update', handleUpdate);
                    }
                    leaveGroup(groupId);
                };
            } else {
                return () => leaveGroup(groupId);
            }
        }
    }, [groupId, isConnected, socket, user?._id, joinGroup, leaveGroup]);

    const handleDeleteGroup = async () => {
        const result = await deleteGroup(groupId);
        if (result.success) {
            toast.success('🗑️ Group deleted', 'All expenses and members have been removed');
            navigate('/groups');
        } else {
            toast.error('Couldn\'t delete group', result.message || 'Please try again');
        }
        setShowDeleteConfirm(false);
    };

    const handleDeleteExpense = async (expenseId) => {
        const result = await deleteExpense(groupId, expenseId);
        if (result.success) {
            toast.success('🗑️ Expense removed', 'The record has been deleted');
        } else {
            toast.error('Couldn\'t delete expense', result.message || 'Please try again');
        }
    };

    const handleAddMember = async () => {
        if (!newMemberName.trim() || !newMemberPhone.trim()) {
            toast.error('Missing info', 'Please enter both name and phone number');
            return;
        }

        const result = await addMember(groupId, {
            name: newMemberName,
            phone: newMemberPhone,
        });

        if (result.success) {
            toast.success('👥 Member added!', result.message || 'They can now access this group');
            setShowAddMember(false);
            setNewMemberName('');
            setNewMemberPhone('');
            fetchGroup(groupId); // Refresh group data
        } else {
            toast.error('Couldn\'t add member', result.message || 'Please try again');
        }
    };



    // Use backend balances (which account for settlements) or fallback to local
    // Use backend balances (which account for settlements) or fallback to local
    const balances = settlementBalances.length > 0
        ? settlementBalances.map(b => ({
            _id: b.user._id,
            name: b.user.name,
            email: b.user.email,
            phone: b.user.phone,
            balance: b.balance
        }))
        : []; // Fallback empty if loading

    // Use store data for debts - it respects the 'simplify' flag sent to backend
    const settlements = simplifiedDebts;

    const isCreator = currentGroup?.creator?._id === user?._id || currentGroup?.creator === user?._id;
    const isAdmin = currentGroup?.admins?.some(a => a._id === user?._id || a === user?._id);

    if (groupLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <p>Loading group...</p>
            </div>
        );
    }

    if (!currentGroup) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
                <h2>Group not found</h2>
                <Button onClick={() => navigate('/groups')} variant="secondary" style={{ marginTop: '16px' }}>
                    Back to Groups
                </Button>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ paddingBottom: '100px' }}
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="friend-header mobile-flex-col" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
                <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: '#f5f5f5' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate('/groups')}
                    style={{
                        padding: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#525252',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft style={{ width: '20px', height: '20px' }} />
                </motion.button>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <Avatar name={currentGroup.name} size="lg" />
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0a0a0a', margin: '0 0 4px' }}>{currentGroup.name}</h1>
                            <p style={{ fontSize: '15px', color: '#737373', margin: 0 }}>{currentGroup.members?.length || 0} members</p>
                        </div>
                    </div>
                    {currentGroup.description && (
                        <p style={{ fontSize: '15px', color: '#525252', marginTop: '12px', margin: '12px 0 0' }}>{currentGroup.description}</p>
                    )}
                </div>
                <Button className="mobile-w-full" icon={Plus} onClick={() => setShowAddExpense(true)}>
                    Add Expense
                </Button>
            </motion.div>

            {/* Tabs */}
            <motion.div variants={itemVariants} className="scroll-hidden" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e5e5', overflowX: 'auto', marginBottom: '24px', paddingBottom: '1px', WebkitOverflowScrolling: 'touch' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 16px',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #000' : '2px solid transparent',
                            backgroundColor: 'transparent',
                            color: activeTab === tab.id ? '#000' : '#737373',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.2s',
                        }}
                    >
                        <tab.icon style={{ width: '16px', height: '16px' }} />
                        {tab.label}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Expenses Tab */}
                    {/* Expenses Tab - Redesigned */}
                    {activeTab === 'expenses' && (() => {
                        // Helper for category visuals
                        const getCategoryDetails = (cat) => {
                            const c = cat?.toLowerCase() || '';
                            if (c.includes('food') || c.includes('meal') || c.includes('dinner') || c.includes('lunch') || c.includes('breakfast'))
                                return { icon: Utensils, bg: '#fee2e2', color: '#ef4444' };
                            if (c.includes('shop') || c.includes('grocer')) return { icon: ShoppingBag, bg: '#fce7f3', color: '#ec4899' };
                            if (c.includes('travel') || c.includes('transport') || c.includes('cab') || c.includes('uber') || c.includes('fuel'))
                                return { icon: Car, bg: '#dbeafe', color: '#3b82f6' };
                            if (c.includes('home') || c.includes('rent') || c.includes('repair')) return { icon: Home, bg: '#d1fae5', color: '#10b981' };
                            if (c.includes('movie') || c.includes('game') || c.includes('fun')) return { icon: Film, bg: '#ede9fe', color: '#8b5cf6' };
                            if (c.includes('bill') || c.includes('utility') || c.includes('electric') || c.includes('internet'))
                                return { icon: Zap, bg: '#fef3c7', color: '#d97706' };
                            if (c.includes('coffee') || c.includes('drink') || c.includes('bar')) return { icon: Coffee, bg: '#ffedd5', color: '#f97316' };
                            if (c.includes('flight') || c.includes('trip') || c.includes('hotel')) return { icon: Plane, bg: '#e0f2fe', color: '#0ea5e9' };
                            if (c.includes('gift')) return { icon: Gift, bg: '#f3e8ff', color: '#a855f7' };
                            return { icon: Receipt, bg: '#f3f4f6', color: '#6b7280' };
                        };

                        // Group Expenses by Month
                        const groupedExpenses = expenses.reduce((acc, exp) => {
                            const d = new Date(exp.date);
                            const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(exp);
                            return acc;
                        }, {});

                        if (expenses.length === 0) {
                            return (
                                <EmptyState
                                    icon={Receipt}
                                    title="No expenses yet"
                                    description="Add your first expense to start tracking"
                                    action={() => setShowAddExpense(true)}
                                    actionText="Add Expense"
                                />
                            );
                        }

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                {/* Overall Summary (Optional, nice to have) */}
                                <div style={{
                                    display: 'flex',
                                    gap: '16px',
                                    overflowX: 'auto',
                                    paddingBottom: '4px'
                                }}>
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#171717',
                                        borderRadius: '16px',
                                        color: '#fff',
                                        minWidth: '160px',
                                        flex: 1
                                    }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#a3a3a3' }}>Total Spending</p>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '24px', fontWeight: '700' }}>
                                            {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                                        </p>
                                    </div>
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e5e5',
                                        borderRadius: '16px',
                                        minWidth: '160px',
                                        flex: 1
                                    }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#737373' }}>Total Expenses</p>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '24px', fontWeight: '700', color: '#0a0a0a' }}>
                                            {expenses.length}
                                        </p>
                                    </div>
                                </div>

                                {/* Expense List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {Object.entries(groupedExpenses).map(([month, monthExpenses]) => (
                                        <div key={month} style={{ animation: 'fadeIn 0.5s ease-out' }}>
                                            <h3 style={{
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: '#a3a3a3',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: '16px',
                                                paddingLeft: '4px'
                                            }}>
                                                {month}
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {monthExpenses.map((expense) => {
                                                        const { icon: CatIcon, bg, color } = getCategoryDetails(expense.category);
                                                        // isPayer is true if user is the registered payer (pending members can't be current user)
                                                        const isPayer = (expense.paidBy?._id || expense.paidBy) === user?._id;
                                                        const canEdit = (expense.createdBy?._id || expense.createdBy) === user?._id || isAdmin;

                                                    return (
                                                        <motion.div
                                                            key={expense._id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                                            whileTap={{ scale: 0.99 }}
                                                            onClick={() => {
                                                                if (canEdit) {
                                                                    setSelectedExpense(expense);
                                                                    setShowEditExpense(true);
                                                                }
                                                            }}
                                                            style={{
                                                                backgroundColor: '#fff',
                                                                borderRadius: '20px',
                                                                padding: '16px 20px',
                                                                border: '1px solid #f5f5f5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '16px',
                                                                cursor: canEdit ? 'pointer' : 'default',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '52px',
                                                                height: '52px',
                                                                borderRadius: '16px',
                                                                backgroundColor: bg,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: color,
                                                                flexShrink: 0
                                                            }}>
                                                                <CatIcon size={24} strokeWidth={2.5} />
                                                            </div>

                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#171717' }}>
                                                                        {expense.description}
                                                                    </p>
                                                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#171717' }}>
                                                                        {formatCurrency(expense.amount)}
                                                                    </p>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontSize: '13px', color: '#737373' }}>
                                                                            {isPayer ? 'You' : (expense.paidBy?.name || expense.paidByPendingInfo?.name || 'Unknown')} paid
                                                                            {expense.paidByPendingInfo && <span style={{ marginLeft: '4px', color: '#f59e0b' }}>⏳</span>}
                                                                        </span>
                                                                        <span style={{ fontSize: '13px', color: '#d4d4d4' }}>•</span>
                                                                        <span style={{ fontSize: '13px', color: '#737373' }}>
                                                                            {formatDate(expense.date, 'short')}
                                                                        </span>
                                                                    </div>
                                                                    {canEdit && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setExpenseToDelete(expense._id);
                                                                                    setShowDeleteExpenseConfirm(true);
                                                                                }}
                                                                                style={{
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    padding: '4px',
                                                                                    cursor: 'pointer',
                                                                                    opacity: 0.5,
                                                                                    transition: 'opacity 0.2s',
                                                                                    display: 'flex'
                                                                                }}
                                                                                onMouseEnter={(e) => e.target.style.opacity = 1}
                                                                                onMouseLeave={(e) => e.target.style.opacity = 0.5}
                                                                            >
                                                                                <Trash2 size={16} color="#ef4444" />
                                                                            </button>
                                                                            <div style={{ opacity: 0.5 }}>
                                                                                <Edit size={14} color="#a3a3a3" />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Who Owes Tab - Redesigned */}
                    {activeTab === 'owes' && (
                        <div style={{ marginTop: '0px' }}>
                            <SettleUp
                                groupId={groupId}
                                members={currentGroup.members || []}
                                allMembers={currentGroup.allMembers || currentGroup.members || []}
                                isAdmin={isAdmin}
                            />
                        </div>
                    )}

                    {/* Activity Tab - New */}
                    {activeTab === 'activity' && (() => {
                        // Build activity feed from various sources
                        const activityItems = [];

                        // Add group creation event (admin only or all can see)
                        if (currentGroup?.createdAt) {
                            activityItems.push({
                                type: 'group_created',
                                date: new Date(currentGroup.createdAt),
                                data: {
                                    creator: currentGroup.creator?.name || 'Someone',
                                    groupName: currentGroup.name
                                }
                            });
                        }

                        // Add all expenses
                        expenses.forEach(expense => {
                            activityItems.push({
                                type: 'expense_added',
                                date: new Date(expense.createdAt),
                                data: expense
                            });
                        });

                        // Filter settlements based on role
                        const visibleSettlements = isAdmin
                            ? allSettlements
                            : allSettlements.filter(s =>
                                s.from._id === user?._id || s.to._id === user?._id
                            );

                        visibleSettlements.forEach(settlement => {
                            activityItems.push({
                                type: settlement.confirmedByRecipient ? 'settlement_confirmed' : 'settlement_pending',
                                date: new Date(settlement.createdAt),
                                data: settlement
                            });
                        });

                        // Sort by date (newest first)
                        activityItems.sort((a, b) => b.date - a.date);

                        const getActivityIcon = (type) => {
                            switch (type) {
                                case 'group_created': return { icon: '🎉', color: '#6366f1', bg: '#eef2ff' };
                                case 'expense_added': return { icon: '💰', color: '#0a0a0a', bg: '#f5f5f5' };
                                case 'settlement_confirmed': return { icon: '✅', color: '#16a34a', bg: '#f0fdf4' };
                                case 'settlement_pending': return { icon: '⏳', color: '#ca8a04', bg: '#fefce8' };
                                default: return { icon: '📋', color: '#737373', bg: '#f5f5f5' };
                            }
                        };

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#737373',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        margin: 0
                                    }}>
                                        📋 {isAdmin ? 'All Activity' : 'Activity'}
                                    </h3>
                                    {isAdmin && (
                                        <Badge variant="primary" size="sm">Admin View</Badge>
                                    )}
                                </div>

                                {activityItems.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {activityItems.slice(0, 20).map((activity, i) => {
                                            const iconStyle = getActivityIcon(activity.type);

                                            return (
                                                <motion.div
                                                    key={`${activity.type}-${i}`}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '14px',
                                                        padding: '14px 16px',
                                                        backgroundColor: '#fff',
                                                        borderRadius: '12px',
                                                        border: '1px solid #e5e5e5'
                                                    }}
                                                >
                                                    {/* Icon */}
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '10px',
                                                        backgroundColor: iconStyle.bg,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '16px',
                                                        flexShrink: 0
                                                    }}>
                                                        {iconStyle.icon}
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {activity.type === 'group_created' && (
                                                            <>
                                                                <p style={{ margin: 0, fontSize: '14px', color: '#0a0a0a' }}>
                                                                    <strong>{activity.data.creator}</strong> created the group <strong>"{activity.data.groupName}"</strong>
                                                                </p>
                                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#737373' }}>
                                                                    {formatDate(activity.date, 'relative')}
                                                                </p>
                                                            </>
                                                        )}

                                                        {activity.type === 'expense_added' && (
                                                            <>
                                                                <p style={{ margin: 0, fontSize: '14px', color: '#0a0a0a' }}>
                                                                    <strong>{activity.data.paidBy?.name || 'Someone'}</strong> added expense <strong>"{activity.data.description}"</strong>
                                                                </p>
                                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#737373' }}>
                                                                    {formatCurrency(activity.data.amount)} • {formatDate(activity.date, 'relative')}
                                                                </p>
                                                            </>
                                                        )}

                                                        {activity.type === 'settlement_confirmed' && (
                                                            <>
                                                                <p style={{ margin: 0, fontSize: '14px', color: '#0a0a0a' }}>
                                                                    <strong>{activity.data.from?.name}</strong> paid <strong>{activity.data.to?.name}</strong>
                                                                    {(activity.data.from._id === user?._id || activity.data.to._id === user?._id) &&
                                                                        <span style={{ color: '#16a34a' }}> (you)</span>
                                                                    }
                                                                </p>
                                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#16a34a' }}>
                                                                    {formatCurrency(activity.data.amount)} • Confirmed • {formatDate(activity.date, 'relative')}
                                                                </p>
                                                            </>
                                                        )}

                                                        {activity.type === 'settlement_pending' && (
                                                            <>
                                                                <p style={{ margin: 0, fontSize: '14px', color: '#0a0a0a' }}>
                                                                    <strong>{activity.data.from?.name}</strong> marked payment to <strong>{activity.data.to?.name}</strong>
                                                                    {(activity.data.from._id === user?._id || activity.data.to._id === user?._id) &&
                                                                        <span style={{ color: '#ca8a04' }}> (you)</span>
                                                                    }
                                                                </p>
                                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#ca8a04' }}>
                                                                    {formatCurrency(activity.data.amount)} • Pending confirmation • {formatDate(activity.date, 'relative')}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Badge */}
                                                    <div>
                                                        {activity.type === 'expense_added' && (
                                                            <Badge size="sm" variant="default">
                                                                {activity.data.category || 'expense'}
                                                            </Badge>
                                                        )}
                                                        {activity.type === 'settlement_confirmed' && (
                                                            <Badge size="sm" variant="success">paid</Badge>
                                                        )}
                                                        {activity.type === 'settlement_pending' && (
                                                            <Badge size="sm" variant="warning">pending</Badge>
                                                        )}
                                                        {activity.type === 'group_created' && (
                                                            <Badge size="sm" variant="primary">created</Badge>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '48px',
                                        textAlign: 'center',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '20px',
                                        border: '2px dashed #d4d4d4'
                                    }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#525252' }}>
                                            No Activity Yet
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#737373' }}>
                                            Add an expense to see activity here
                                        </p>
                                    </div>
                                )}

                                {/* Legend for admins */}
                                {isAdmin && activityItems.length > 0 && (
                                    <div style={{
                                        padding: '12px 16px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        gap: '16px',
                                        flexWrap: 'wrap',
                                        marginTop: '8px'
                                    }}>
                                        <span style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            🎉 Group created
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            💰 Expense added
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            ✅ Payment confirmed
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#737373', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            ⏳ Payment pending
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Analytics Tab */}
                    {activeTab === 'analytics' && (() => {
                        const today = new Date();
                        const todayStr = today.toDateString();

                        // 1. Calculate Today's Spending
                        const todaySpending = expenses
                            .filter(e => new Date(e.date).toDateString() === todayStr)
                            .reduce((sum, e) => sum + e.amount, 0);

                        // 2. Calculate Total Spending (Overall)
                        const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);

                        // 3. Prepare Monthly Trend Data
                        const monthlyData = {};
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                        expenses.forEach(e => {
                            const d = new Date(e.date);
                            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                            monthlyData[key] = (monthlyData[key] || 0) + e.amount;
                        });

                        const trendData = Object.entries(monthlyData).map(([key, value]) => {
                            const [m, y] = key.split(' ');
                            const dateVal = new Date(`${m} 1, ${y}`);
                            return { name: key, value, date: dateVal, month: m, year: y };
                        }).sort((a, b) => a.date - b.date);

                        // If trendData is empty or just one month, maybe fill a bit or handled by UI
                        const maxValue = trendData.length > 0 ? Math.max(...trendData.map(d => d.value)) : 1;

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Stats Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                                    <Card hover={false} style={{ padding: '24px', backgroundColor: '#fff', border: '1px solid #e5e5e5' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#3b82f6' }}>
                                                <TrendingUp size={20} />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#737373' }}>Spent Today</p>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#0a0a0a' }}>
                                            {formatCurrency(todaySpending)}
                                        </p>
                                        {todaySpending === 0 && (
                                            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#a3a3a3' }}>No expenses recorded today</p>
                                        )}
                                    </Card>
                                    <Card hover={false} style={{ padding: '24px', backgroundColor: '#171717', color: '#fff', border: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                                <Receipt size={20} />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#a3a3a3' }}>Total Group Spend</p>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '32px', fontWeight: '800' }}>
                                            {formatCurrency(totalSpending)}
                                        </p>
                                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#737373' }}>Lifetime</p>
                                    </Card>
                                </div>

                                {/* Chart Section */}
                                <Card hover={false} style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0a0a0a' }}>Spending Trend</h3>
                                        <Badge variant="secondary">{trendData.length} Months</Badge>
                                    </div>

                                    {trendData.length > 0 ? (
                                        <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                                            {trendData.map((data, i) => {
                                                const heightPct = (data.value / maxValue) * 100;
                                                return (
                                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', height: '100%' }}>
                                                        <div style={{ position: 'relative', flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: `${heightPct}%` }}
                                                                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                                                                style={{
                                                                    width: '100%',
                                                                    maxWidth: '48px',
                                                                    backgroundColor: i === trendData.length - 1 ? '#0a0a0a' : '#f5f5f5',
                                                                    borderRadius: '8px 8px 4px 4px',
                                                                    minHeight: '4px'
                                                                }}
                                                            />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '100%',
                                                                marginBottom: '8px',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                color: '#0a0a0a',
                                                                display: heightPct > 10 ? 'block' : 'none' // Hide value if bar too small
                                                            }}>
                                                                {formatCurrency(data.value, 'INR', 0)}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#525252' }}>{data.month}</span>
                                                            <div style={{ fontSize: '10px', color: '#a3a3a3' }}>{data.year}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#a3a3a3', fontSize: '14px' }}>
                                            Not enough data to show trends
                                        </div>
                                    )}
                                </Card>
                            </div>
                        );
                    })()}

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Add Member Button - Admin Only */}
                            {isAdmin && (
                                <Button
                                    icon={Plus}
                                    onClick={() => setShowAddMember(true)}
                                    style={{ alignSelf: 'flex-start' }}
                                >
                                    Add Member
                                </Button>
                            )}

                            {/* Registered Members */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#0a0a0a' }}>
                                    Active Members ({currentGroup.members?.length || 0})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {currentGroup.members?.map((member) => {
                                        const memberIsAdmin = currentGroup.admins?.some(admin =>
                                            (admin._id || admin) === (member._id || member)
                                        );
                                        const memberIsCreator = (currentGroup.creator?._id || currentGroup.creator) === (member._id || member);
                                        const isCurrentUser = member._id === user?._id;

                                        return (
                                            <Card key={member._id} hover={false} style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <Avatar name={member.name} size="md" />
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontWeight: '500', margin: 0 }}>
                                                            {member.name}
                                                            {isCurrentUser && ' (you)'}
                                                        </p>
                                                        <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0 0' }}>
                                                            {member.email}
                                                        </p>
                                                        <p style={{ fontSize: '12px', color: '#a3a3a3', margin: '2px 0 0 0' }}>
                                                            {member.phone}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {/* Badges */}
                                                        {memberIsCreator && (
                                                            <Badge variant="default">
                                                                <Crown size={12} style={{ marginRight: '4px' }} />
                                                                Creator
                                                            </Badge>
                                                        )}
                                                        {memberIsAdmin && (
                                                            <Badge variant="primary">Admin</Badge>
                                                        )}
                                                        {!memberIsAdmin && (
                                                            <Badge variant="success">Member</Badge>
                                                        )}

                                                        {/* Admin Controls */}
                                                        {isAdmin && !isCurrentUser && !memberIsCreator && (
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {!memberIsAdmin && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        icon={UserPlus}
                                                                        onClick={async () => {
                                                                            const result = await promoteToAdmin(groupId, member._id);
                                                                            if (result.success) {
                                                                                toast.success('👑 Admin promoted!', result.message || 'New admin powers granted');
                                                                                fetchGroup(groupId);
                                                                            } else {
                                                                                toast.error('Couldn\'t promote', result.message || 'Please try again');
                                                                            }
                                                                        }}
                                                                    >
                                                                        Make Admin
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="danger"
                                                                    icon={Trash2}
                                                                    onClick={() => {
                                                                        setMemberToRemove(member);
                                                                        setShowRemoveMemberConfirm(true);
                                                                    }}
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Pending Members */}
                            {currentGroup.pendingMembers && currentGroup.pendingMembers.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#0a0a0a' }}>
                                        Pending Members ({currentGroup.pendingMembers.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {currentGroup.pendingMembers.map((member) => (
                                            <Card key={member._id} hover={false} style={{ padding: '16px', backgroundColor: '#fafafa' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <Avatar name={member.name} size="md" />
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontWeight: '500', margin: 0 }}>
                                                            {member.name}
                                                        </p>
                                                        <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0 0' }}>
                                                            {member.phone}
                                                        </p>
                                                        <p style={{ fontSize: '12px', color: '#a3a3a3', margin: '2px 0 0 0' }}>
                                                            Added {formatDate(member.addedAt)}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <Badge variant="warning">Pending</Badge>
                                                        {isAdmin && (
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                icon={Trash2}
                                                                onClick={async () => {
                                                                    const result = await removePendingMember(groupId, member._id);
                                                                    if (result.success) {
                                                                        toast.success('👋 Pending member removed', result.message);
                                                                        fetchGroup(groupId);
                                                                    } else {
                                                                        toast.error('Couldn\'t remove', result.message || 'Please try again');
                                                                    }
                                                                }}
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#737373', marginTop: '12px', fontStyle: 'italic' }}>
                                        💡 These members will be automatically added when they sign up with their phone number. You can add expenses with them in the meantime!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && (
                        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <Card>
                                <CardContent style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#737373' }}>Group Name</label>
                                        <p style={{ marginTop: '4px', fontSize: '16px', fontWeight: '500', color: '#0a0a0a' }}>{currentGroup.name}</p>
                                    </div>
                                    {currentGroup.description && (
                                        <div>
                                            <label style={{ fontSize: '14px', fontWeight: '500', color: '#737373' }}>Description</label>
                                            <p style={{ marginTop: '4px', fontSize: '16px', color: '#0a0a0a' }}>{currentGroup.description}</p>
                                        </div>
                                    )}
                                    <div>
                                        <label style={{ fontSize: '14px', fontWeight: '500', color: '#737373' }}>Created</label>
                                        <p style={{ marginTop: '4px', fontSize: '16px', color: '#0a0a0a' }}>{formatDate(currentGroup.createdAt, 'long')}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Budget Manager */}
                            <Card>
                                <CardContent style={{ padding: '24px' }}>
                                    <BudgetManager
                                        groupId={groupId}
                                        budgets={currentGroup.budgets}
                                        isAdmin={isAdmin}
                                    />
                                </CardContent>
                            </Card>

                            <Button
                                variant="secondary"
                                icon={Download}
                                onClick={async () => {
                                    const { downloadReport } = useGroupStore.getState();
                                    const result = await downloadReport(groupId, currentGroup.name);
                                    if (result.success) {
                                        toast.success('Stats downloaded', 'Check your downloads folder');
                                    } else {
                                        toast.error('Download failed', result.message);
                                    }
                                }}
                            >
                                Export Expenses (CSV)
                            </Button>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                {isAdmin && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            style={{ flex: 1 }}
                                            icon={Edit}
                                            onClick={() => setShowEditGroup(true)}
                                        >
                                            Edit Group
                                        </Button>
                                        <Button
                                            variant="danger"
                                            style={{ flex: 1 }}
                                            icon={Trash2}
                                            onClick={() => setShowDeleteConfirm(true)}
                                        >
                                            Delete Group
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Chat Tab */}
                    {activeTab === 'chat' && (
                        <div style={{ height: '100%' }}>
                            <GroupChat groupId={groupId} />
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Add Expense Modal */}
            <Modal
                isOpen={showAddExpense}
                onClose={() => setShowAddExpense(false)}
                title="Add Expense"
                size="2xl"
            >
                <AddExpense
                    groupId={groupId}
                    members={currentGroup.members || []}
                    allMembers={currentGroup.allMembers || currentGroup.members || []}
                    isAdmin={isAdmin}
                    onSuccess={() => {
                        setShowAddExpense(false);
                        fetchExpenses(groupId);
                    }}
                    onCancel={() => setShowAddExpense(false)}
                />
            </Modal>

            {/* Add Member Modal */}
            <Modal
                isOpen={showAddMember}
                onClose={() => {
                    setShowAddMember(false);
                    setNewMemberName('');
                    setNewMemberPhone('');
                }}
                title="Add Member"
                size="sm"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ color: '#525252', lineHeight: '1.5' }}>
                        Add a member by their name and phone number. They don't need to be registered yet!
                    </p>

                    <Input
                        label="Member Name"
                        placeholder="John Doe"
                        icon={User}
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                    />

                    <Input
                        label="Phone Number"
                        placeholder="+1 (555) 000-0000"
                        icon={Phone}
                        value={newMemberPhone}
                        onChange={(e) => setNewMemberPhone(e.target.value)}
                    />

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button
                            variant="secondary"
                            style={{ flex: 1 }}
                            onClick={() => {
                                setShowAddMember(false);
                                setNewMemberName('');
                                setNewMemberPhone('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            style={{ flex: 1 }}
                            onClick={handleAddMember}
                            loading={groupLoading}
                        >
                            Add Member
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Settle Up Modal */}
            <Modal
                isOpen={showSettleUp}
                onClose={() => {
                    setShowSettleUp(false);
                    fetchBalances(groupId); // Refresh balances after settlement operations
                }}
                title="Settle Up"
                size="lg"
            >
                <SettleUp
                    groupId={groupId}
                    members={currentGroup.members || []}
                    allMembers={currentGroup.allMembers || currentGroup.members || []}
                    isAdmin={isAdmin}
                    onClose={() => {
                        setShowSettleUp(false);
                        fetchBalances(groupId); // Refresh balances after settlement operations
                    }}
                />
            </Modal>

            {/* Edit Expense Modal */}
            <Modal
                isOpen={showEditExpense}
                onClose={() => {
                    setShowEditExpense(false);
                    setSelectedExpense(null);
                }}
                title="Edit Expense"
                size="lg"
            >
                {selectedExpense && (
                    <EditExpense
                        groupId={groupId}
                        expense={selectedExpense}
                        members={currentGroup.members || []}
                        allMembers={currentGroup.allMembers || currentGroup.members || []}
                        isAdmin={isAdmin}
                        onDelete={() => {
                            setExpenseToDelete(selectedExpense._id);
                            setShowDeleteExpenseConfirm(true);
                        }}
                        onSuccess={() => {
                            setShowEditExpense(false);
                            setSelectedExpense(null);
                            fetchExpenses(groupId);
                        }}
                        onCancel={() => {
                            setShowEditExpense(false);
                            setSelectedExpense(null);
                        }}
                    />
                )}
            </Modal>

            {/* Edit Group Modal */}
            <Modal
                isOpen={showEditGroup}
                onClose={() => setShowEditGroup(false)}
                title="Edit Group"
                size="md"
            >
                <EditGroup
                    group={currentGroup}
                    onSuccess={() => {
                        setShowEditGroup(false);
                        fetchGroup(groupId);
                    }}
                    onCancel={() => setShowEditGroup(false)}
                />
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title={isCreator ? 'Delete Group' : 'Leave Group'}
                size="sm"
            >
                <p style={{ color: '#525252', marginBottom: '24px', lineHeight: '1.5' }}>
                    {isCreator
                        ? 'Are you sure you want to delete this group? This action cannot be undone and all expenses will be lost.'
                        : 'Are you sure you want to leave this group? You can be added back later.'}
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        variant="secondary"
                        style={{ flex: 1 }}
                        onClick={() => setShowDeleteConfirm(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        style={{ flex: 1 }}
                        onClick={handleDeleteGroup}
                    >
                        {isCreator ? 'Delete' : 'Leave'}
                    </Button>
                </div>
            </Modal>

            {/* Delete Expense Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteExpenseConfirm}
                onClose={() => { setShowDeleteExpenseConfirm(false); setExpenseToDelete(null); }}
                onConfirm={async () => {
                    if (expenseToDelete) {
                        const result = await deleteExpense(groupId, expenseToDelete);
                        if (result.success) {
                            toast.success('🗑️ Expense removed', 'The record has been deleted');
                            setShowEditExpense(false);
                            setSelectedExpense(null);
                            fetchExpenses(groupId);
                        } else {
                            toast.error('Couldn\'t delete expense', result.message || 'Please try again');
                        }
                    }
                    setExpenseToDelete(null);
                }}
                title="Delete Expense"
                message="Are you sure you want to delete this expense? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Remove Member Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showRemoveMemberConfirm}
                onClose={() => { setShowRemoveMemberConfirm(false); setMemberToRemove(null); }}
                onConfirm={async () => {
                    if (memberToRemove) {
                        const result = await removeMember(groupId, memberToRemove._id);
                        if (result.success) {
                            toast.success('👋 Member removed', 'They no longer have access');
                            fetchGroup(groupId);
                        } else {
                            toast.error('Couldn\'t remove', result.message || 'Please try again');
                        }
                    }
                    setMemberToRemove(null);
                }}
                title="Remove Member"
                message={`Are you sure you want to remove ${memberToRemove?.name || 'this member'} from the group?`}
                confirmText="Remove"
                cancelText="Cancel"
                variant="danger"
            />
        </motion.div>
    );
}

export default GroupDetail;
