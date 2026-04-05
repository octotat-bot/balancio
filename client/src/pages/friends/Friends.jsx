import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    UserPlus,
    Phone,
    User,
    Check,
    X,
    MessageCircle,
    Send,
    ArrowLeft,
    ArrowRight,
    Clock,
    Trash2,
    Receipt,
    Scale,
    TrendingUp,
    TrendingDown,
    Plus,
    CheckCircle,
    Wallet,
    Utensils,
    ShoppingBag,
    Car,
    Home,
    Zap,
    Film,
    Coffee,
    Plane,
    Gift
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../utils/helpers';
import AddExpense from '../../components/expenses/AddExpense';
import ConfirmDialog from '../../components/common/ConfirmDialog';

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }
};

export function Friends() {
    const { user } = useAuthStore();
    const {
        friends,
        selectedFriend,
        messages,
        isLoading,
        fetchFriends,
        addFriend,
        acceptFriend,
        rejectFriend,
        removeFriend,
        setSelectedFriend,
        fetchMessages,
        sendMessage,
        clearSelectedFriend,
        directExpenses,
        directBalance,
        directDetails,
        addDirectExpense,
        fetchDirectExpenses,
        fetchDirectBalance,
        deleteDirectExpense,
        settleUp,
        pendingSettlements,
        createSettlement,
        fetchSettlements,
        confirmSettlement,
        rejectSettlement
    } = useFriendStore();
    const toast = useToast();

    // Modal states
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(false);

    // Form states
    const [newFriendName, setNewFriendName] = useState('');
    const [newFriendPhone, setNewFriendPhone] = useState('');
    const [messageInput, setMessageInput] = useState('');

    // Settlement states
    const [settlementAmount, setSettlementAmount] = useState('');
    const [isPartialSettlement, setIsPartialSettlement] = useState(false);

    // Refs
    const chatEndRef = useRef(null);

    // Fetch friends on mount
    useEffect(() => {
        fetchFriends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for real-time friend updates
    useEffect(() => {
        const handleFriendsUpdated = () => {
            fetchFriends();
        };

        const handleExpensesUpdated = (event) => {
            const { friendshipId } = event.detail || {};
            if (selectedFriend?._id === friendshipId || !friendshipId) {
                if (selectedFriend?._id) {
                    fetchDirectExpenses(selectedFriend._id);
                    fetchDirectBalance(selectedFriend._id);
                }
            }
        };

        const handleSettlementsUpdated = (event) => {
            const { friendshipId } = event.detail || {};
            if (selectedFriend?._id === friendshipId || !friendshipId) {
                if (selectedFriend?._id) {
                    fetchSettlements(selectedFriend._id);
                    fetchDirectBalance(selectedFriend._id);
                }
            }
        };

        const handleBalanceUpdated = (event) => {
            const { friendshipId } = event.detail || {};
            if (selectedFriend?._id === friendshipId || !friendshipId) {
                if (selectedFriend?._id) {
                    fetchDirectBalance(selectedFriend._id);
                    fetchSettlements(selectedFriend._id);
                }
            }
        };

        window.addEventListener('app:friends-updated', handleFriendsUpdated);
        window.addEventListener('app:friend-expenses-updated', handleExpensesUpdated);
        window.addEventListener('app:friend-settlements-updated', handleSettlementsUpdated);
        window.addEventListener('app:friend-balance-updated', handleBalanceUpdated);

        return () => {
            window.removeEventListener('app:friends-updated', handleFriendsUpdated);
            window.removeEventListener('app:friend-expenses-updated', handleExpensesUpdated);
            window.removeEventListener('app:friend-settlements-updated', handleSettlementsUpdated);
            window.removeEventListener('app:friend-balance-updated', handleBalanceUpdated);
        };
    }, [selectedFriend?._id, fetchFriends, fetchDirectExpenses, fetchDirectBalance, fetchSettlements]);

    // Fetch friend data when selected
    useEffect(() => {
        if (selectedFriend?._id) {
            fetchMessages(selectedFriend._id);
            fetchDirectExpenses(selectedFriend._id);
            fetchDirectBalance(selectedFriend._id);
            fetchSettlements(selectedFriend._id);
        }
    }, [selectedFriend?._id, fetchMessages, fetchDirectExpenses, fetchDirectBalance, fetchSettlements]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Safeguard friends data
    const acceptedFriends = friends?.accepted || [];
    const pendingReceived = friends?.pendingReceived || [];
    const pendingSent = friends?.pendingSent || [];



    // Get friend data helper
    const getFriendData = (friendship) => {
        if (!friendship) return { name: 'Unknown', phone: '', isRegistered: false };
        const isRequester = friendship.requester?._id === user?._id || friendship.requester === user?._id;
        if (isRequester) {
            return {
                name: friendship.recipient?.name || friendship.recipientName || 'Friend',
                phone: friendship.recipient?.phone || friendship.recipientPhone || '',
                isRegistered: !!friendship.recipient?._id
            };
        } else {
            return {
                name: friendship.requester?.name || 'Friend',
                phone: friendship.requester?.phone || '',
                isRegistered: !!friendship.requester?._id
            };
        }
    };

    // Check if current user has a pending outgoing payment awaiting confirmation
    const hasPendingOutgoingSettlement = (pendingSettlements || []).some(
        s => s.from?._id === user?._id && !s.confirmedByRecipient
    );

    // Get the pending outgoing settlement details
    const pendingOutgoingSettlement = (pendingSettlements || []).find(
        s => s.from?._id === user?._id && !s.confirmedByRecipient
    );

    // Handlers
    const handleAddFriend = async () => {
        if (!newFriendName.trim() || !newFriendPhone.trim()) {
            toast.error('Missing information', 'Please enter name and phone number');
            return;
        }
        const result = await addFriend(newFriendName, newFriendPhone);
        if (result.success) {
            toast.success('🎉 Friend request sent!', `Request sent to ${newFriendName}`);
            setNewFriendName('');
            setNewFriendPhone('');
            setShowAddFriendModal(false);
        } else {
            toast.error('Failed to add friend', result.message || 'Please try again');
        }
    };

    const handleAcceptFriend = async (friendshipId) => {
        const result = await acceptFriend(friendshipId);
        if (result.success) {
            toast.success('🤝 Friend added!', 'You are now friends');
        } else {
            toast.error('Failed', result.message);
        }
    };

    const handleRejectFriend = async (friendshipId) => {
        const result = await rejectFriend(friendshipId);
        if (result.success) {
            toast.info('Request declined', 'Friend request has been declined');
        } else {
            toast.error('Failed', result.message);
        }
    };

    const handleRemoveFriend = async () => {
        if (!selectedFriend?._id) return;

        const result = await removeFriend(selectedFriend._id);
        if (result.success) {
            toast.success('Friend removed', 'Friend has been removed from your list');
            clearSelectedFriend();
        } else {
            toast.error('Failed', result.message);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedFriend?._id) return;
        const result = await sendMessage(selectedFriend._id, messageInput);
        if (result.success) {
            setMessageInput('');
        } else {
            toast.error('Failed to send', result.message);
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        const result = await deleteDirectExpense(selectedFriend._id, expenseId);
        if (result.success) {
            toast.success('🗑️ Expense deleted', 'The expense has been removed');
            fetchDirectBalance(selectedFriend._id);
        } else {
            toast.error('Failed', result.message);
        }
    };

    const handleSettleUp = async (isPartial = false) => {
        const balanceAmt = typeof directBalance === 'object' ? (directBalance?.balance || 0) : (directBalance || 0);
        const amount = isPartial ? parseFloat(settlementAmount) : Math.abs(balanceAmt);

        if (!amount || amount <= 0) {
            toast.error('Invalid amount', 'Please enter a valid amount');
            return;
        }

        if (amount > Math.abs(balanceAmt)) {
            toast.error('Amount too high', 'Cannot settle more than owed');
            return;
        }

        // Determine if current user is the RECEIVER (balance > 0 means friend owes you)
        // If balance > 0: you are owed money, so you're marking as received
        // If balance < 0: you owe money, so you're paying
        const isReceiverMarking = balanceAmt > 0;

        const result = await createSettlement(
            selectedFriend._id,
            amount,
            isPartial ? 'Partial payment' : 'Full settlement',
            isReceiverMarking
        );

        if (result.success) {
            if (isReceiverMarking) {
                toast.success('✅ Payment Received!', 'Balance has been updated');
            } else {
                toast.success('💸 Payment Sent!', 'Awaiting confirmation from your friend');
            }
            setShowSettleModal(false);
            setSettlementAmount('');
            setIsPartialSettlement(false);
            // Refresh data
            fetchDirectBalance(selectedFriend._id);
            fetchSettlements(selectedFriend._id);
        } else {
            toast.error('Failed to settle', result.message);
        }
    };

    // Handle confirming a settlement (receiver confirms payment)
    const handleConfirmSettlement = async (settlementId) => {
        const result = await confirmSettlement(selectedFriend._id, settlementId);
        if (result.success) {
            toast.success('✅ Payment Confirmed!', 'The balance has been updated');
            // Refresh data
            fetchDirectBalance(selectedFriend._id);
            fetchSettlements(selectedFriend._id);
        } else {
            toast.error('Failed', result.message);
        }
    };

    // Handle rejecting a settlement (receiver rejects)
    const handleRejectSettlement = async (settlementId) => {
        const result = await rejectSettlement(selectedFriend._id, settlementId);
        if (result.success) {
            toast.success('❌ Payment Rejected', 'The payment request has been removed');
            // Refresh data
            fetchDirectBalance(selectedFriend._id);
            fetchSettlements(selectedFriend._id);
        } else {
            toast.error('Failed', result.message);
        }
    };

    // Handle expense submission from AddExpense component
    const handleExpenseSubmit = async (expenseData) => {
        if (!selectedFriend?._id) {
            toast.error('Error', 'No friend selected');
            return;
        }

        // Get friend's user ID
        const isRequester = selectedFriend.requester?._id === user?._id;
        const friendUserId = isRequester
            ? selectedFriend.recipient?._id
            : selectedFriend.requester?._id;

        // Calculate split based on the expense data
        const myShareAmount = expenseData.splits?.find(s => s.user === user?._id)?.amount || expenseData.amount / 2;
        const friendShare = expenseData.amount - myShareAmount;

        const result = await addDirectExpense(selectedFriend._id, {
            description: expenseData.description,
            amount: expenseData.amount,
            splitType: expenseData.splitType === 'equal' ? 'dutch' : 'custom',
            payerShare: myShareAmount,
            friendShare: friendShare,
            category: expenseData.category,
            notes: expenseData.notes,
            date: expenseData.date
        });

        if (result.success) {
            toast.success('💸 Expense added!', 'Recorded successfully');
            setShowAddExpenseModal(false);
            fetchDirectExpenses(selectedFriend._id);
            fetchDirectBalance(selectedFriend._id);
        } else {
            toast.error('Error', result.message || 'Failed to add expense');
        }
    };

    // Category icon helper (same as GroupDetail)
    const getCategoryDetails = (cat) => {
        const c = cat?.toLowerCase() || '';
        if (c.includes('food') || c.includes('meal') || c.includes('dinner'))
            return { icon: Utensils, bg: '#fee2e2', color: '#ef4444' };
        if (c.includes('shop') || c.includes('grocer'))
            return { icon: ShoppingBag, bg: '#fce7f3', color: '#ec4899' };
        if (c.includes('travel') || c.includes('transport') || c.includes('cab'))
            return { icon: Car, bg: '#dbeafe', color: '#3b82f6' };
        if (c.includes('home') || c.includes('rent'))
            return { icon: Home, bg: '#d1fae5', color: '#10b981' };
        if (c.includes('movie') || c.includes('game') || c.includes('fun'))
            return { icon: Film, bg: '#ede9fe', color: '#8b5cf6' };
        if (c.includes('bill') || c.includes('utility'))
            return { icon: Zap, bg: '#fef3c7', color: '#d97706' };
        if (c.includes('coffee') || c.includes('drink'))
            return { icon: Coffee, bg: '#ffedd5', color: '#f97316' };
        if (c.includes('flight') || c.includes('trip'))
            return { icon: Plane, bg: '#e0f2fe', color: '#0ea5e9' };
        if (c.includes('gift'))
            return { icon: Gift, bg: '#f3e8ff', color: '#a855f7' };
        return { icon: Receipt, bg: '#f3f4f6', color: '#6b7280' };
    };

    // =============================================
    // FRIEND DETAIL VIEW - BENTO GRID LAYOUT
    // =============================================
    if (selectedFriend) {
        const friendData = getFriendData(selectedFriend);
        const balance = typeof directBalance === 'object' ? (directBalance?.balance || 0) : (directBalance || 0);
        const youOwe = directDetails?.youOwe || 0;
        const theyOwe = directDetails?.theyOwe || 0;

        // Create members array for AddExpense component
        const members = [
            { _id: user?._id, name: user?.name || 'You', email: user?.email },
            {
                _id: selectedFriend.recipient?._id || selectedFriend.requester?._id || 'friend',
                name: friendData.name,
                email: ''
            }
        ].filter(m => m._id);

        // Get last 5 expenses for the bento view
        const recentExpenses = (directExpenses || []).slice(0, 5);

        return (
            <div style={{ paddingBottom: '100px' }}>
                {/* Header */}
                <motion.div variants={itemVariants} className="friend-header mobile-flex-col" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
                    <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: '#1A1A1F' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { clearSelectedFriend(); }}
                        style={{
                            padding: '10px',
                            borderRadius: '50%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#B0ADA8',
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
                            <Avatar name={friendData.name} size="lg" />
                            <div>
                                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}>
                                    {friendData.name}
                                </h1>
                                <p style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}>
                                    {friendData.phone}
                                </p>
                            </div>
                            <Badge variant={friendData.isRegistered ? 'success' : 'warning'}>
                                {friendData.isRegistered ? 'Active' : 'Pending'}
                            </Badge>
                        </div>
                    </div>
                    <div className="friend-header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => setShowRemoveFriendConfirm(true)}
                            style={{ color: '#dc2626' }}
                        >
                            Remove
                        </Button>
                        <Button icon={Plus} onClick={() => setShowAddExpenseModal(true)}>
                            Add Expense
                        </Button>
                    </div>
                </motion.div>

                {/* BENTO GRID LAYOUT */}
                <div
                    className="friends-grid responsive-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gridTemplateRows: 'auto',
                        gap: '16px',
                    }}
                >

                    {/* Balance Card - Spans 6 columns */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            gridColumn: 'span 6',
                            padding: '24px',
                            borderRadius: '24px',
                            background: balance > 0
                                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                : balance < 0
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : 'linear-gradient(135deg, #525252 0%, #404040 100%)',
                            color: '#fff',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}
                    >
                        {/* Decorative circles */}
                        <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '150px', height: '150px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ position: 'absolute', right: '40px', bottom: '-40px', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />

                        <div>
                            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Net Balance</p>
                            <p style={{ margin: '8px 0 0', fontSize: '42px', fontWeight: '800' }}>
                                {formatCurrency(Math.abs(balance))}
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: '16px', opacity: 0.9 }}>
                                {balance > 0 ? `${friendData.name} owes you` : balance < 0 ? `You owe ${friendData.name}` : 'All settled up! 🎉'}
                            </p>
                        </div>
                    </motion.div>

                    {/* Quick Stats - 6 columns (2 stat cards) */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            gridColumn: 'span 3',
                            padding: '20px',
                            borderRadius: '20px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TrendingUp size={20} color="#16a34a" />
                            </div>
                            <span style={{ fontSize: '13px', color: '#8A8680', fontWeight: '500' }}>You Get</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>
                            {formatCurrency(theyOwe)}
                        </p>
                    </motion.div>

                    <motion.div
                        variants={itemVariants}
                        style={{
                            gridColumn: 'span 3',
                            padding: '20px',
                            borderRadius: '20px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TrendingDown size={20} color="#dc2626" />
                            </div>
                            <span style={{ fontSize: '13px', color: '#8A8680', fontWeight: '500' }}>You Owe</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#dc2626' }}>
                            {formatCurrency(youOwe)}
                        </p>
                    </motion.div>

                    {/* Recent Expenses - Spans 5 columns */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            gridColumn: 'span 5',
                            padding: '24px',
                            borderRadius: '24px',
                            backgroundColor: '#131316',
                            border: '1px solid #252530',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#EDEAE4' }}>Recent Expenses</h3>
                            <span style={{ fontSize: '13px', color: '#8A8680' }}>{(directExpenses || []).length} total</span>
                        </div>

                        {recentExpenses.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#1A1A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                    <Receipt size={28} color="#a3a3a3" />
                                </div>
                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#B0ADA8' }}>No expenses yet</p>
                                <p style={{ margin: '8px 0 16px', fontSize: '13px', color: '#8A8680' }}>Add your first expense to start tracking</p>
                                <Button size="sm" onClick={() => setShowAddExpenseModal(true)} icon={Plus}>Add Expense</Button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                {recentExpenses.map((expense) => {
                                    const catInfo = getCategoryDetails(expense.category); // Changed from getCategoryInfo
                                    const isPayer = expense.paidBy?.toString() === user?._id?.toString() || expense.paidBy?._id?.toString() === user?._id?.toString();
                                    const myShare = isPayer ? expense.payerShare : expense.friendShare;

                                    return (
                                        <motion.div
                                            key={expense._id}
                                            whileHover={{ backgroundColor: '#16161B' }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '14px',
                                                padding: '14px',
                                                borderRadius: '14px',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '12px',
                                                backgroundColor: catInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <catInfo.icon size={22} color={catInfo.color} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#EDEAE4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {expense.description}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8A8680' }}>
                                                    {isPayer ? 'You paid' : `${friendData.name} paid`} • {formatDate(expense.date || expense.createdAt, 'short')}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: isPayer ? '#16a34a' : '#dc2626' }}>
                                                    {isPayer ? '+' : '-'}{formatCurrency(expense.amount - myShare)}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6A6763' }}>
                                                    of {formatCurrency(expense.amount)}
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })}

                                {(directExpenses || []).length > 5 && (
                                    <Button variant="ghost" size="sm" style={{ alignSelf: 'center', marginTop: '8px' }}>
                                        View All {(directExpenses || []).length} Expenses
                                    </Button>
                                )}
                            </div>
                        )}
                    </motion.div>

                    {/* Chat Section - Spans 7 columns and 2 rows */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            gridColumn: 'span 7',
                            gridRow: 'span 2',
                            padding: '24px',
                            borderRadius: '24px',
                            backgroundColor: '#131316',
                            border: '1px solid #252530',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '400px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <MessageCircle size={20} color='#EDEAE4' />
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#EDEAE4' }}>Chat</h3>
                        </div>

                        {!friendData.isRegistered ? (
                            <div style={{
                                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '24px', textAlign: 'center', backgroundColor: '#fef3c7', borderRadius: '16px'
                            }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                                    💬 {friendData.name} needs to sign up on Balncio to chat
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Messages */}
                                <div style={{
                                    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px',
                                    marginBottom: '12px', paddingRight: '8px'
                                }}>
                                    {(messages || []).length === 0 ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6A6763', fontSize: '14px' }}>
                                            No messages yet. Say hi! 👋
                                        </div>
                                    ) : (
                                        (messages || []).slice(-10).map((msg, idx) => {
                                            const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                                            return (
                                                <div
                                                    key={msg._id || idx}
                                                    style={{
                                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                                        maxWidth: '80%',
                                                        padding: '10px 14px',
                                                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                                        backgroundColor: isMe ? '#0a0a0a' : '#f5f5f5',
                                                        color: isMe ? '#fff' : '#0a0a0a'
                                                    }}
                                                >
                                                    <p style={{ margin: 0, fontSize: '14px' }}>{msg.content}</p>
                                                    <p style={{ margin: '4px 0 0', fontSize: '10px', opacity: 0.6, textAlign: 'right' }}>
                                                        {formatDate(msg.createdAt, 'time')}
                                                    </p>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Input
                                        placeholder="Type a message..."
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        containerStyle={{ flex: 1 }}
                                    />
                                    <Button icon={Send} onClick={handleSendMessage} disabled={!messageInput.trim()} />
                                </div>
                            </>
                        )}
                    </motion.div>

                    {/* Quick Settle Card - Spans 5 columns (same as expenses) - Only shows if there's a balance */}
                    {Math.abs(balance) > 0.01 && (
                        <motion.div
                            variants={itemVariants}
                            style={{
                                gridColumn: 'span 5',
                                padding: '20px',
                                borderRadius: '20px',
                                backgroundColor: '#1A1A1F',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Avatar name={balance > 0 ? friendData.name : user?.name} size="sm" />
                                    <ArrowRight size={14} color='#8A8680' />
                                    <Avatar name={balance > 0 ? user?.name : friendData.name} size="sm" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#8A8680' }}>
                                        {balance > 0 ? 'Owes you' : 'You owe'}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#EDEAE4' }}>
                                        {formatCurrency(Math.abs(balance))}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {balance < 0 ? (
                                    /* PAYER VIEW: Pay options */
                                    hasPendingOutgoingSettlement ? (
                                        /* Show pending status instead of buttons */
                                        <div style={{
                                            flex: 1,
                                            textAlign: 'center',
                                            padding: '12px',
                                            backgroundColor: '#fef3c7',
                                            borderRadius: '12px',
                                            color: '#92400e',
                                            fontSize: '13px'
                                        }}>
                                            ⏳ Payment of {formatCurrency(pendingOutgoingSettlement?.amount || 0)} pending confirmation
                                        </div>
                                    ) : (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => { setIsPartialSettlement(true); setShowSettleModal(true); }}
                                                style={{ flex: 1 }}
                                            >
                                                💰 Partial
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSettleUp(false)}
                                                icon={CheckCircle}
                                                style={{ flex: 1 }}
                                            >
                                                Pay Now
                                            </Button>
                                        </>
                                    )
                                ) : (
                                    /* RECEIVER VIEW: Mark as Received only */
                                    <Button
                                        size="sm"
                                        onClick={() => handleSettleUp(false)}
                                        icon={CheckCircle}
                                        style={{ flex: 1 }}
                                    >
                                        Mark as Received
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Pending Settlements - Shows when there are payments awaiting confirmation */}
                    {(pendingSettlements || []).length > 0 && (
                        <motion.div
                            variants={itemVariants}
                            style={{
                                gridColumn: 'span 12',
                                padding: '20px',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
                                border: '2px solid #fbbf24',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <Clock size={20} color="#d97706" />
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#92400e' }}>
                                    Pending Confirmations ({pendingSettlements.length})
                                </h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pendingSettlements.map((settlement) => {
                                    const isReceiver = settlement.to?._id === user?._id;
                                    const fromName = settlement.from?.name || 'Someone';
                                    const toName = settlement.to?.name || 'Someone';

                                    return (
                                        <div
                                            key={settlement._id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '16px',
                                                backgroundColor: '#131316',
                                                borderRadius: '16px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Avatar name={fromName} size="sm" />
                                                <ArrowRight size={16} color='#8A8680' />
                                                <Avatar name={toName} size="sm" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#EDEAE4' }}>
                                                    {isReceiver ? `${fromName} paid you` : `You paid ${toName}`}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>
                                                    {formatCurrency(settlement.amount)}
                                                </p>
                                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A8680' }}>
                                                    {isReceiver ? '⏳ Awaiting your confirmation' : '⏳ Waiting for confirmation'}
                                                </p>
                                            </div>
                                            {isReceiver ? (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRejectSettlement(settlement._id)}
                                                        style={{ color: '#dc2626' }}
                                                    >
                                                        <X size={18} />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmSettlement(settlement._id)}
                                                        icon={Check}
                                                    >
                                                        Confirm
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span style={{ padding: '6px 12px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Add Expense Modal */}
                <Modal
                    isOpen={showAddExpenseModal}
                    onClose={() => setShowAddExpenseModal(false)}
                    title="Add Expense"
                    size="xl"
                >
                    <div style={{ minHeight: '500px' }}>
                        <AddExpense
                            members={members}
                            onSuccess={() => {
                                setShowAddExpenseModal(false);
                                fetchDirectExpenses(selectedFriend._id);
                                fetchDirectBalance(selectedFriend._id);
                            }}
                            onCancel={() => setShowAddExpenseModal(false)}
                            onSubmit={handleExpenseSubmit}
                            hidePaidBy={true}
                        />
                    </div>
                </Modal>

                {/* Settle Up Modal */}
                <Modal
                    isOpen={showSettleModal}
                    onClose={() => { setShowSettleModal(false); setSettlementAmount(''); setIsPartialSettlement(false); }}
                    title={balance < 0 ? "Pay Now" : "Mark as Received"}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Balance Display */}
                        <div style={{
                            padding: '24px',
                            borderRadius: '16px',
                            backgroundColor: balance > 0 ? '#f0fdf4' : '#fef2f2',
                            border: '2px solid',
                            borderColor: balance > 0 ? '#bbf7d0' : '#fecaca',
                            textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                                <Avatar name={balance > 0 ? friendData.name : user?.name} size="lg" />
                                <ArrowRight size={24} color='#8A8680' />
                                <Avatar name={balance > 0 ? user?.name : friendData.name} size="lg" />
                            </div>
                            <p style={{ fontSize: '14px', color: '#8A8680', margin: '0 0 8px' }}>
                                {balance > 0 ? `${friendData.name} owes you` : `You owe ${friendData.name}`}
                            </p>
                            <p style={{
                                fontSize: '36px',
                                fontWeight: '800',
                                color: balance > 0 ? '#16a34a' : '#dc2626',
                                margin: 0
                            }}>
                                {formatCurrency(Math.abs(balance))}
                            </p>
                        </div>

                        {/* Payment Options - Different for Payer vs Receiver */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {balance < 0 ? (
                                /* PAYER VIEW: Show Pay and Partial Payment options */
                                hasPendingOutgoingSettlement ? (
                                    /* Show pending warning */
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '20px',
                                        backgroundColor: '#fef3c7',
                                        borderRadius: '12px',
                                        color: '#92400e'
                                    }}>
                                        <p style={{ margin: '0 0 8px', fontWeight: '600' }}>⏳ Payment Pending</p>
                                        <p style={{ margin: 0, fontSize: '14px' }}>
                                            You have a pending payment of {formatCurrency(pendingOutgoingSettlement?.amount || 0)} awaiting confirmation.
                                            Please wait for your friend to confirm or reject before making another payment.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {!isPartialSettlement && (
                                            <Button
                                                onClick={() => handleSettleUp(false)}
                                                icon={CheckCircle}
                                                style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                                            >
                                                Pay Full Amount ({formatCurrency(Math.abs(balance))})
                                            </Button>
                                        )}

                                        {/* Partial Payment Toggle */}
                                        {!isPartialSettlement ? (
                                            <Button
                                                variant="secondary"
                                                onClick={() => setIsPartialSettlement(true)}
                                                style={{ width: '100%' }}
                                            >
                                                💰 Make Partial Payment
                                            </Button>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                                            >
                                                {/* Amount Input */}
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#B0ADA8' }}>
                                                        Payment Amount
                                                    </label>
                                                    <div style={{ position: 'relative' }}>
                                                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', fontWeight: '600', color: '#8A8680' }}>₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={settlementAmount}
                                                            onChange={(e) => setSettlementAmount(e.target.value)}
                                                            max={Math.abs(balance)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '14px 16px 14px 40px',
                                                                fontSize: '24px',
                                                                fontWeight: '700',
                                                                border: '2px solid #e5e5e5',
                                                                borderRadius: '12px',
                                                                outline: 'none',
                                                                transition: 'border-color 0.2s'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = '#0a0a0a'}
                                                            onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                                                        />
                                                    </div>
                                                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#8A8680' }}>
                                                        Remaining: <span style={{ fontWeight: '600', color: '#EDEAE4' }}>
                                                            {formatCurrency(Math.abs(balance) - (parseFloat(settlementAmount) || 0))}
                                                        </span>
                                                    </p>
                                                </div>

                                                {/* Partial Payment Actions */}
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => { setIsPartialSettlement(false); setSettlementAmount(''); }}
                                                        style={{ flex: 1 }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleSettleUp(true)}
                                                        disabled={!settlementAmount || parseFloat(settlementAmount) <= 0}
                                                        icon={CheckCircle}
                                                        style={{ flex: 1 }}
                                                    >
                                                        Pay ₹{settlementAmount || '0'}
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </>
                                )
                            ) : (
                                /* RECEIVER VIEW: Show only Mark as Received button */
                                <Button
                                    onClick={() => handleSettleUp(false)}
                                    icon={CheckCircle}
                                    style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                                >
                                    Mark Full Amount as Received ({formatCurrency(Math.abs(balance))})
                                </Button>
                            )}

                            {/* Cancel Button (when not in partial mode) */}
                            {!isPartialSettlement && (
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowSettleModal(false)}
                                    style={{ width: '100%' }}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* Remove Friend Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={showRemoveFriendConfirm}
                    onClose={() => setShowRemoveFriendConfirm(false)}
                    onConfirm={handleRemoveFriend}
                    title="Remove Friend"
                    message={`Are you sure you want to remove ${getFriendData(selectedFriend).name} from your friends? All expenses and chat history will be deleted.`}
                    confirmText="Remove"
                    cancelText="Cancel"
                    variant="danger"
                />
            </div>
        );
    }

    // =============================================
    // FRIENDS LIST VIEW
    // =============================================
    return (
        <div style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}>Friends</h1>
                    <p style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}>
                        {acceptedFriends.length} friends
                    </p>
                </div>
                <Button icon={UserPlus} onClick={() => setShowAddFriendModal(true)}>
                    Add Friend
                </Button>
            </motion.div>

            {/* Pending Requests */}
            {pendingReceived.length > 0 && (
                <motion.div variants={itemVariants} style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#8A8680', marginBottom: '16px' }}>
                        Pending Requests ({pendingReceived.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pendingReceived.map((request) => {
                            const reqData = getFriendData(request);
                            return (
                                <Card key={request._id}>
                                    <CardContent style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <Avatar name={reqData.name} size="md" />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>{reqData.name}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8A8680' }}>{reqData.phone}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Button size="sm" icon={Check} onClick={() => handleAcceptFriend(request._id)}>
                                                Accept
                                            </Button>
                                            <Button size="sm" variant="ghost" icon={X} onClick={() => handleRejectFriend(request._id)}>
                                                Decline
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Friends List */}
            {acceptedFriends.length === 0 && pendingReceived.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No friends yet"
                    description="Add friends to start splitting expenses"
                    action={() => setShowAddFriendModal(true)}
                    actionText="Add Friend"
                />
            ) : (
                <motion.div variants={itemVariants}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#8A8680', marginBottom: '16px' }}>
                        All Friends
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {acceptedFriends.map((friend) => {
                            const friendData = getFriendData(friend);
                            return (
                                <motion.div
                                    key={friend._id}
                                    whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                    onClick={() => {
                                        setSelectedFriend(friend);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <Card>
                                        <CardContent style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <Avatar name={friendData.name} size="md" />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>{friendData.name}</p>
                                                    <Badge variant={friendData.isRegistered ? 'success' : 'warning'} size="sm">
                                                        {friendData.isRegistered ? 'Active' : 'Pending'}
                                                    </Badge>
                                                </div>
                                                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8A8680' }}>{friendData.phone}</p>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                View
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Pending Sent */}
            {pendingSent.length > 0 && (
                <motion.div variants={itemVariants} style={{ marginTop: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#8A8680', marginBottom: '16px' }}>
                        Pending Invites ({pendingSent.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pendingSent.map((request) => (
                            <Card key={request._id}>
                                <CardContent style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <Avatar name={request.recipientName} size="md" />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>{request.recipientName}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8A8680' }}>{request.recipientPhone}</p>
                                    </div>
                                    <Badge variant="secondary">Waiting...</Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Add Friend Modal */}
            <Modal
                isOpen={showAddFriendModal}
                onClose={() => { setShowAddFriendModal(false); setNewFriendName(''); setNewFriendPhone(''); }}
                title="Add Friend"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#8A8680' }}>
                        Add a friend by entering their name and phone number.
                    </p>
                    <Input
                        label="Name"
                        placeholder="Friend's name"
                        value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)}
                        icon={User}
                    />
                    <Input
                        label="Phone Number"
                        placeholder="Phone number"
                        value={newFriendPhone}
                        onChange={(e) => setNewFriendPhone(e.target.value)}
                        icon={Phone}
                    />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <Button variant="ghost" onClick={() => { setShowAddFriendModal(false); setNewFriendName(''); setNewFriendPhone(''); }} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddFriend} loading={isLoading} disabled={!newFriendName.trim() || !newFriendPhone.trim()} style={{ flex: 1 }}>
                            Send Request
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default Friends;
