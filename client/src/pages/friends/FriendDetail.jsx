import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    MessageCircle,
    Receipt,
    DollarSign,
    Send,
    Trash2,
    Plus,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    Wallet,
    Split,
    CreditCard
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../utils/helpers';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const slideInVariants = {
    hidden: { x: 50, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.3 } },
    exit: { x: -50, opacity: 0, transition: { duration: 0.2 } }
};

const friendTabs = [
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export function FriendDetail() {
    const { friendshipId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        friends,
        messages,
        isLoading,
        fetchFriends,
        fetchMessages,
        sendMessage,
        addDirectExpense,
        fetchDirectExpenses,
        fetchDirectBalance,
        deleteDirectExpense,
        directDetails,
        directExpenses,
        directBalance,
        settleUp
    } = useFriendStore();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('expenses');
    const [messageInput, setMessageInput] = useState('');
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showDeleteExpenseConfirm, setShowDeleteExpenseConfirm] = useState(false);
    const [showSettleConfirm, setShowSettleConfirm] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const messagesEndRef = useRef(null);

    // Expense form state
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [splitType, setSplitType] = useState('dutch');
    const [customPayerShare, setCustomPayerShare] = useState('');

    // Find the friendship from the store
    const friendship = friends.accepted.find(f => f._id === friendshipId);

    useEffect(() => {
        fetchFriends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (friendshipId) {
            fetchMessages(friendshipId);
            fetchDirectExpenses(friendshipId);
            fetchDirectBalance(friendshipId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendshipId]);

    useEffect(() => {
        if (messagesEndRef.current && activeTab === 'chat') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab]);

    const getFriendData = () => {
        if (!friendship) return { name: 'Loading...', phone: '', isRegistered: false };
        if (friendship.requester._id === user?._id) {
            return {
                _id: friendship.recipient?._id,
                name: friendship.recipient?.name || friendship.recipientName,
                phone: friendship.recipientPhone,
                isRegistered: !!friendship.recipient
            };
        } else {
            return {
                _id: friendship.requester._id,
                name: friendship.requester.name,
                phone: friendship.requester.phone,
                isRegistered: true
            };
        }
    };

    const friendData = getFriendData();
    const balance = directBalance || 0;

    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        if (!friendData.isRegistered) {
            toast.error('Cannot send message', `${friendData.name} hasn't joined Balncio yet`);
            return;
        }

        const result = await sendMessage(friendshipId, messageInput.trim());
        if (result.success) {
            setMessageInput('');
        } else {
            toast.error('Message failed', 'Please try again');
        }
    };

    const handleAddExpense = async () => {
        if (!expenseDescription.trim() || !expenseAmount) {
            toast.error('Missing info', 'Add description and amount to continue');
            return;
        }

        const amount = parseFloat(expenseAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount', 'Please enter an amount greater than 0');
            return;
        }

        let payerShare = amount / 2;
        let friendShare = amount / 2;

        if (splitType === 'custom') {
            payerShare = parseFloat(customPayerShare) || 0;
            friendShare = amount - payerShare;
            if (payerShare < 0 || friendShare < 0) {
                toast.error('Split error', 'Amounts must be positive numbers');
                return;
            }
        }

        const result = await addDirectExpense(friendshipId, {
            description: expenseDescription.trim(),
            amount,
            splitType,
            payerShare,
            friendShare
        });

        if (result.success) {
            toast.success('💸 Expense added!', 'Split has been recorded');
            setShowAddExpenseModal(false);
            resetExpenseForm();
        } else {
            toast.error('Couldn\'t add expense', result.message || 'Please try again');
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        const result = await deleteDirectExpense(friendshipId, expenseId);
        if (result.success) {
            toast.success('🗑️ Expense removed', 'The record has been deleted');
        } else {
            toast.error('Couldn\'t delete expense', result.message || 'Please try again');
        }
        setExpenseToDelete(null);
    };

    const confirmDeleteExpense = (expenseId) => {
        setExpenseToDelete(expenseId);
        setShowDeleteExpenseConfirm(true);
    };

    const handleSettleUp = async () => {
        const result = await settleUp(friendshipId);
        if (result.success) {
            toast.success('🎉 All settled!', 'Balance has been cleared');
            setShowSettleModal(false);
        } else {
            toast.error('Failed to settle', result.message || 'Please try again');
        }
    };

    const resetExpenseForm = () => {
        setExpenseDescription('');
        setExpenseAmount('');
        setSplitType('dutch');
        setCustomPayerShare('');
    };

    if (!friendship) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '50vh',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <p style={{ color: '#737373' }}>Loading...</p>
                <Button variant="secondary" onClick={() => navigate('/friends')}>
                    Back to Friends
                </Button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 120px)',
                maxWidth: '900px',
                margin: '0 auto'
            }}
        >
            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '24px'
                }}
            >
                <Button
                    variant="ghost"
                    onClick={() => navigate('/friends')}
                    style={{ padding: '10px', borderRadius: '50%' }}
                >
                    <ArrowLeft size={20} />
                </Button>

                <Avatar name={friendData.name} size="lg" />

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>
                            {friendData.name}
                        </h2>
                        {friendData.isRegistered ? (
                            <span style={{
                                padding: '3px 10px',
                                backgroundColor: '#dcfce7',
                                color: '#16a34a',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '600'
                            }}>
                                Active
                            </span>
                        ) : (
                            <span style={{
                                padding: '3px 10px',
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '600'
                            }}>
                                Pending
                            </span>
                        )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#737373' }}>
                        {friendData.phone}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {Math.abs(balance) > 0.01 && (
                        <Button
                            variant="secondary"
                            onClick={() => setShowSettleModal(true)}
                            icon={CheckCircle}
                            style={{ border: '2px solid #e5e5e5' }}
                        >
                            Settle Up
                        </Button>
                    )}
                    <Button
                        onClick={() => setShowAddExpenseModal(true)}
                        icon={Plus}
                    >
                        Add Expense
                    </Button>
                </div>
            </motion.div>

            {/* Balance Summary Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: '24px' }}
            >
                <Card style={{
                    background: balance > 0
                        ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                        : balance < 0
                            ? 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)'
                            : 'linear-gradient(135deg, #171717 0%, #404040 100%)',
                    border: 'none',
                    color: '#fff',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {/* Background Pattern */}
                    <div style={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-20%',
                        width: '300px',
                        height: '300px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                        borderRadius: '50%'
                    }} />

                    <CardContent style={{
                        padding: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative'
                    }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                                {balance > 0
                                    ? `${friendData.name} owes you`
                                    : balance < 0
                                        ? `You owe ${friendData.name}`
                                        : 'All settled up! 🎉'
                                }
                            </p>
                            <p style={{
                                margin: '8px 0 0',
                                fontSize: '40px',
                                fontWeight: '800',
                                letterSpacing: '-1px'
                            }}>
                                {formatCurrency(Math.abs(balance))}
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '20px',
                                marginTop: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingUp size={14} />
                                    <span style={{ fontSize: '13px', opacity: 0.9 }}>
                                        You get: {formatCurrency(directDetails?.theyOwe || 0)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingDown size={14} />
                                    <span style={{ fontSize: '13px', opacity: 0.9 }}>
                                        You owe: {formatCurrency(directDetails?.youOwe || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            width: '70px',
                            height: '70px',
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Wallet size={32} />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Tabs */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                style={{
                    display: 'flex',
                    gap: '6px',
                    marginBottom: '20px',
                    backgroundColor: '#f5f5f5',
                    padding: '6px',
                    borderRadius: '14px',
                    width: 'fit-content'
                }}
            >
                {friendTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
                            color: activeTab === tab.id ? '#0a0a0a' : '#737373',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                    {/* EXPENSES TAB */}
                    {activeTab === 'expenses' && (
                        <motion.div
                            key="expenses"
                            variants={slideInVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                height: '100%',
                                overflowY: 'auto',
                                paddingRight: '8px'
                            }}
                        >
                            {directExpenses.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '20px',
                                    border: '2px dashed #e5e5e5'
                                }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        margin: '0 auto 20px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Receipt size={36} style={{ color: '#a3a3a3' }} />
                                    </div>
                                    <h3 style={{
                                        margin: '0 0 8px',
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: '#525252'
                                    }}>
                                        No expenses yet
                                    </h3>
                                    <p style={{
                                        margin: '0 0 20px',
                                        color: '#737373',
                                        fontSize: '14px'
                                    }}>
                                        Add your first expense with {friendData.name}
                                    </p>
                                    <Button
                                        icon={Plus}
                                        onClick={() => setShowAddExpenseModal(true)}
                                    >
                                        Add Expense
                                    </Button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {directExpenses.map((expense, index) => {
                                        const isPayer = expense.paidBy?._id === user?._id;
                                        return (
                                            <motion.div
                                                key={expense._id}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <Card hover style={{ padding: '0' }}>
                                                    <CardContent style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '18px 20px',
                                                        gap: '16px'
                                                    }}>
                                                        <div style={{
                                                            width: '48px',
                                                            height: '48px',
                                                            borderRadius: '14px',
                                                            backgroundColor: isPayer ? '#dcfce7' : '#fee2e2',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {isPayer ?
                                                                <TrendingUp size={22} color="#16a34a" /> :
                                                                <TrendingDown size={22} color="#dc2626" />
                                                            }
                                                        </div>

                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{
                                                                margin: 0,
                                                                fontSize: '16px',
                                                                fontWeight: '600',
                                                                color: '#0a0a0a',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>
                                                                {expense.description}
                                                            </p>
                                                            <p style={{
                                                                margin: '4px 0 0',
                                                                fontSize: '13px',
                                                                color: '#737373'
                                                            }}>
                                                                {isPayer ? 'You' : expense.paidBy?.name} paid {formatCurrency(expense.amount)}
                                                                <span style={{ margin: '0 8px', color: '#d4d4d4' }}>•</span>
                                                                {expense.splitType === 'dutch' ? '50/50' : 'Custom'}
                                                                <span style={{ margin: '0 8px', color: '#d4d4d4' }}>•</span>
                                                                {new Date(expense.date).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short'
                                                                })}
                                                            </p>
                                                        </div>

                                                        <div style={{ textAlign: 'right' }}>
                                                            <p style={{
                                                                margin: 0,
                                                                fontSize: '18px',
                                                                fontWeight: '700',
                                                                color: isPayer ? '#16a34a' : '#dc2626'
                                                            }}>
                                                                {isPayer ? '+' : '-'}{formatCurrency(expense.friendShare)}
                                                            </p>
                                                            <p style={{
                                                                margin: '2px 0 0',
                                                                fontSize: '12px',
                                                                color: '#a3a3a3'
                                                            }}>
                                                                {isPayer ? `${friendData.name} owes` : 'You owe'}
                                                            </p>
                                                        </div>

                                                        {isPayer && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    confirmDeleteExpense(expense._id);
                                                                }}
                                                                style={{ color: '#ef4444', padding: '8px' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* CHAT TAB */}
                    {activeTab === 'chat' && (
                        <motion.div
                            key="chat"
                            variants={slideInVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Messages Area */}
                            <div style={{
                                flex: 1,
                                backgroundColor: '#f9fafb',
                                borderRadius: '20px',
                                padding: '20px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                {messages.length === 0 ? (
                                    <div style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        color: '#737373'
                                    }}>
                                        <MessageCircle size={48} style={{ opacity: 0.3 }} />
                                        <p style={{ margin: 0, fontSize: '15px' }}>
                                            No messages yet. Say hi! 👋
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMine = msg.sender._id === user?._id || msg.sender === user?._id;
                                        return (
                                            <motion.div
                                                key={msg._id || index}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                style={{
                                                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                                                    maxWidth: '70%'
                                                }}
                                            >
                                                <div style={{
                                                    padding: '12px 18px',
                                                    borderRadius: '18px',
                                                    borderBottomRightRadius: isMine ? '6px' : '18px',
                                                    borderBottomLeftRadius: isMine ? '18px' : '6px',
                                                    backgroundColor: isMine ? '#171717' : '#fff',
                                                    color: isMine ? '#fff' : '#0a0a0a',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                                }}>
                                                    <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.4 }}>
                                                        {msg.content}
                                                    </p>
                                                </div>
                                                <p style={{
                                                    margin: '4px 8px 0',
                                                    fontSize: '11px',
                                                    color: '#a3a3a3',
                                                    textAlign: isMine ? 'right' : 'left'
                                                }}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </motion.div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                marginTop: '16px',
                                padding: '16px',
                                backgroundColor: '#fff',
                                borderRadius: '16px',
                                border: '2px solid #e5e5e5'
                            }}>
                                <input
                                    type="text"
                                    placeholder={
                                        friendData.isRegistered
                                            ? "Type a message..."
                                            : `${friendData.name} hasn't joined yet...`
                                    }
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={!friendData.isRegistered}
                                    style={{
                                        flex: 1,
                                        padding: '14px 18px',
                                        border: 'none',
                                        borderRadius: '12px',
                                        backgroundColor: '#f5f5f5',
                                        fontSize: '15px',
                                        outline: 'none',
                                        opacity: friendData.isRegistered ? 1 : 0.5
                                    }}
                                />
                                <Button
                                    icon={Send}
                                    onClick={handleSendMessage}
                                    disabled={!friendData.isRegistered}
                                >
                                    Send
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ADD EXPENSE MODAL */}
            <Modal
                isOpen={showAddExpenseModal}
                onClose={() => { setShowAddExpenseModal(false); resetExpenseForm(); }}
                title="Add Expense"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Input
                        label="What's it for?"
                        placeholder="e.g., Lunch, Movie tickets, Groceries"
                        value={expenseDescription}
                        onChange={(e) => setExpenseDescription(e.target.value)}
                        icon={Receipt}
                    />

                    <Input
                        label="Total Amount (₹)"
                        placeholder="0.00"
                        type="number"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        icon={DollarSign}
                    />

                    {/* Split Type Selection */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '10px',
                            color: '#0a0a0a'
                        }}>
                            How to split?
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSplitType('dutch')}
                                style={{
                                    flex: 1,
                                    padding: '20px',
                                    borderRadius: '16px',
                                    border: '2px solid',
                                    borderColor: splitType === 'dutch' ? '#171717' : '#e5e5e5',
                                    backgroundColor: splitType === 'dutch' ? '#171717' : '#fff',
                                    color: splitType === 'dutch' ? '#fff' : '#525252',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                <Split size={24} style={{ marginBottom: '8px' }} />
                                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>
                                    Split Equally
                                </p>
                                <p style={{
                                    margin: '4px 0 0',
                                    fontSize: '13px',
                                    opacity: 0.7
                                }}>
                                    50/50 Dutch
                                </p>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSplitType('custom')}
                                style={{
                                    flex: 1,
                                    padding: '20px',
                                    borderRadius: '16px',
                                    border: '2px solid',
                                    borderColor: splitType === 'custom' ? '#171717' : '#e5e5e5',
                                    backgroundColor: splitType === 'custom' ? '#171717' : '#fff',
                                    color: splitType === 'custom' ? '#fff' : '#525252',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                <CreditCard size={24} style={{ marginBottom: '8px' }} />
                                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>
                                    Custom Split
                                </p>
                                <p style={{
                                    margin: '4px 0 0',
                                    fontSize: '13px',
                                    opacity: 0.7
                                }}>
                                    You decide
                                </p>
                            </motion.button>
                        </div>
                    </div>

                    {/* Custom Split Input */}
                    {splitType === 'custom' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                                padding: '20px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '16px'
                            }}
                        >
                            <Input
                                label="Your share (₹)"
                                placeholder="Enter your portion"
                                type="number"
                                value={customPayerShare}
                                onChange={(e) => setCustomPayerShare(e.target.value)}
                            />
                            {expenseAmount && customPayerShare && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '14px',
                                    backgroundColor: '#fff',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ color: '#737373', fontSize: '14px' }}>
                                        {friendData.name}'s share:
                                    </span>
                                    <span style={{ fontWeight: '700', fontSize: '16px' }}>
                                        ₹{(parseFloat(expenseAmount) - parseFloat(customPayerShare)).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Dutch Split Preview */}
                    {splitType === 'dutch' && expenseAmount && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                                padding: '20px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-around',
                                textAlign: 'center'
                            }}
                        >
                            <div>
                                <p style={{ margin: 0, fontSize: '13px', color: '#737373' }}>You</p>
                                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700' }}>
                                    ₹{(parseFloat(expenseAmount) / 2).toFixed(2)}
                                </p>
                            </div>
                            <div style={{
                                width: '2px',
                                backgroundColor: '#e5e5e5',
                                alignSelf: 'stretch'
                            }} />
                            <div>
                                <p style={{ margin: 0, fontSize: '13px', color: '#737373' }}>
                                    {friendData.name}
                                </p>
                                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700' }}>
                                    ₹{(parseFloat(expenseAmount) / 2).toFixed(2)}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    <Button
                        style={{ width: '100%', height: '52px', marginTop: '8px' }}
                        icon={Receipt}
                        onClick={handleAddExpense}
                        loading={isLoading}
                    >
                        Add Expense
                    </Button>
                </div>
            </Modal>

            {/* SETTLE UP MODAL */}
            <Modal
                isOpen={showSettleModal}
                onClose={() => setShowSettleModal(false)}
                title="Settle Up"
                size="sm"
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 24px',
                        backgroundColor: balance > 0 ? '#dcfce7' : '#fee2e2',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {balance > 0 ?
                            <TrendingUp size={40} color="#16a34a" /> :
                            <TrendingDown size={40} color="#dc2626" />
                        }
                    </div>

                    <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700' }}>
                        {balance > 0
                            ? `${friendData.name} owes you`
                            : `You owe ${friendData.name}`
                        }
                    </h3>
                    <p style={{
                        margin: 0,
                        fontSize: '36px',
                        fontWeight: '800',
                        color: balance > 0 ? '#16a34a' : '#dc2626'
                    }}>
                        {formatCurrency(Math.abs(balance))}
                    </p>

                    <p style={{
                        margin: '24px 0',
                        fontSize: '14px',
                        color: '#737373',
                        lineHeight: 1.6
                    }}>
                        Mark this balance as settled? This will record a settlement transaction
                        and reset your balance to zero.
                    </p>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button
                            variant="secondary"
                            style={{ flex: 1 }}
                            onClick={() => setShowSettleModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            style={{ flex: 1 }}
                            icon={CheckCircle}
                            onClick={() => setShowSettleConfirm(true)}
                            loading={isLoading}
                        >
                            Settle Up
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Expense Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteExpenseConfirm}
                onClose={() => { setShowDeleteExpenseConfirm(false); setExpenseToDelete(null); }}
                onConfirm={() => handleDeleteExpense(expenseToDelete)}
                title="Delete Expense"
                message="Are you sure you want to delete this expense? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Settle Up Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showSettleConfirm}
                onClose={() => setShowSettleConfirm(false)}
                onConfirm={handleSettleUp}
                title="Settle Up"
                message="Mark all expenses as settled? This will record a settlement transaction and clear the balance."
                confirmText="Settle"
                cancelText="Cancel"
                variant="info"
            />
        </motion.div>
    );
}

export default FriendDetail;
