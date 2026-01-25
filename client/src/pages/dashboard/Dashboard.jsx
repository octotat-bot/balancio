import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Users,
    Receipt,
    Plus,
    ArrowRight,
    Zap,
    UserPlus,
    X,
    Heart,
    Phone,
    PieChart
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useGroupStore } from '../../stores/groupStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../utils/helpers';
import api from '../../services/api';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
};

const BentoItem = ({ children, className, style, span = 1, dark = false }) => (
    <motion.div
        variants={itemVariants}
        style={{
            gridColumn: `span ${span}`,
            backgroundColor: dark ? '#171717' : '#ffffff',
            color: dark ? '#ffffff' : '#0a0a0a',
            borderRadius: '24px',
            padding: '24px',
            border: dark ? 'none' : '1px solid #f0f0f0',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            ...style
        }}
        className={className}
    >
        {children}
    </motion.div>
);

export function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { groups = [], fetchGroups } = useGroupStore();
    const { friends, fetchFriends, addFriend, acceptFriend, rejectFriend, setSelectedFriend, isLoading: friendsLoading } = useFriendStore();
    const toast = useToast();
    const [friendBalances, setFriendBalances] = useState({});
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [newFriendName, setNewFriendName] = useState('');
    const [newFriendPhone, setNewFriendPhone] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState(null);

    // Safeguard for friends object
    const acceptedFriends = friends?.accepted || [];
    const pendingReceived = friends?.pendingReceived || [];

    useEffect(() => {
        fetchGroups();
        fetchFriends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for real-time updates
    useEffect(() => {
        const handleFriendsUpdated = () => {
            fetchFriends();
        };

        const handleGroupsUpdated = () => {
            fetchGroups();
        };

        window.addEventListener('app:friends-updated', handleFriendsUpdated);
        window.addEventListener('app:groups-updated', handleGroupsUpdated);

        return () => {
            window.removeEventListener('app:friends-updated', handleFriendsUpdated);
            window.removeEventListener('app:groups-updated', handleGroupsUpdated);
        };
    }, [fetchFriends, fetchGroups]);

    useEffect(() => {
        const fetchAllFriendBalances = async () => {
            const balances = {};
            for (const friend of acceptedFriends) {
                try {
                    const response = await api.get(`/friends/${friend._id}/direct-balance`);
                    balances[friend._id] = response.data.balance || 0;
                } catch (error) {
                    balances[friend._id] = 0;
                }
            }
            setFriendBalances(balances);
        };
        if (acceptedFriends.length > 0) fetchAllFriendBalances();
    }, [acceptedFriends]);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setAnalyticsLoading(true);
            try {
                const res = await api.get('/users/analytics');
                setAnalytics(res.data);
                setAnalyticsError(null);
            } catch (error) {
                setAnalyticsError('Failed to load analytics data.');
            } finally {
                setAnalyticsLoading(false);
            }
        };
        // Small delay to ensure auth header is ready if hydrating
        const timeout = setTimeout(fetchAnalytics, 500);
        return () => clearTimeout(timeout);
    }, []);

    // Calculate totals
    const groupTotals = (groups || []).reduce((acc, g) => {
        const b = g.userBalance || 0;
        if (b > 0) acc.owed += b; else acc.owes += Math.abs(b);
        return acc;
    }, { owed: 0, owes: 0 });

    const friendTotals = Object.values(friendBalances).reduce((acc, b) => {
        if (b > 0) acc.owed += b; else acc.owes += Math.abs(b);
        return acc;
    }, { owed: 0, owes: 0 });

    const totals = { owed: groupTotals.owed + friendTotals.owed, owes: groupTotals.owes + friendTotals.owes };
    const netBalance = totals.owed - totals.owes;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const handleAddFriend = async () => {
        if (!newFriendName.trim() || !newFriendPhone.trim()) {
            toast.error('Missing info', 'Please enter name and phone number');
            return;
        }
        const result = await addFriend(newFriendName, newFriendPhone);
        if (result.success) {
            toast.success('🎉 Friend request sent!', `Request sent to ${newFriendName}`);
            setNewFriendName('');
            setNewFriendPhone('');
            setShowAddFriendModal(false);
        } else {
            toast.error('Failed', result.message || 'Could not add friend');
        }
    };

    // Calculate Conic Gradient for Categories
    const getCategoryGradient = () => {
        if (!analytics?.categories || analytics.categories.length === 0) return 'conic-gradient(#f5f5f5 0% 100%)';

        let gradientString = 'conic-gradient(';
        let runningPercentage = 0;
        const total = analytics.total || 1;
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

        analytics.categories.slice(0, 5).forEach((cat, i) => {
            const percentage = (cat.value / total) * 100;
            const start = runningPercentage;
            const end = runningPercentage + percentage;
            const color = colors[i % colors.length];
            gradientString += `${color} ${start}% ${end}%, `;
            runningPercentage = end;
        });

        // Fill remainder if any (e.g. "Other")
        if (runningPercentage < 100) {
            gradientString += `#e5e5e5 ${runningPercentage}% 100%)`;
        } else {
            gradientString = gradientString.slice(0, -2) + ')';
        }

        return gradientString;
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="bento-grid responsive-grid"
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                paddingBottom: '40px',
                maxWidth: '1200px',
                margin: '0 auto'
            }}
        >
            {/* 1. Hero Card */}
            <BentoItem span={2} dark style={{ justifyContent: 'space-between', minHeight: '220px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                        {getGreeting()},<br />
                        <span style={{ color: '#a3a3a3' }}>{user?.name?.split(' ')[0]}</span>
                    </h1>
                </div>
                <div>
                    <p style={{ fontSize: '13px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Balance</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '36px', fontWeight: '700', margin: 0, letterSpacing: '-1px' }}>
                            {formatCurrency(Math.abs(netBalance))}
                        </h2>
                        <Badge variant={netBalance >= 0 ? 'success' : 'destructive'} size="lg">
                            {netBalance >= 0 ? 'You are owed' : 'You owe'}
                        </Badge>
                    </div>
                </div>
                <div style={{
                    position: 'absolute',
                    top: '-40px',
                    right: '-40px',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
                    pointerEvents: 'none'
                }} />
            </BentoItem>

            {/* 2. Inflow */}
            <BentoItem span={1}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '12px' }}>
                        <TrendingUp size={20} color="#16a34a" />
                    </div>
                </div>
                <p style={{ fontSize: '13px', color: '#737373', fontWeight: '500' }}>You are owed</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#0a0a0a', marginTop: '4px' }}>
                    {formatCurrency(totals.owed)}
                </p>
            </BentoItem>

            {/* 3. Outflow */}
            <BentoItem span={1}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '12px' }}>
                        <TrendingDown size={20} color="#dc2626" />
                    </div>
                </div>
                <p style={{ fontSize: '13px', color: '#737373', fontWeight: '500' }}>You owe</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#0a0a0a', marginTop: '4px' }}>
                    {formatCurrency(totals.owes)}
                </p>
            </BentoItem>

            {/* 4. Spending Trend */}
            <BentoItem span={2} style={{ minHeight: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Spending Trend</h3>
                    <div style={{ padding: '6px 12px', backgroundColor: '#f5f5f5', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>This Year</div>
                </div>
                {analyticsLoading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>Loading...</div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', paddingBottom: '10px', gap: '8px' }}>
                        {analytics?.history?.map((item, i) => {
                            const max = Math.max(...(analytics.history.map(h => h.amount) || [1]), 1);
                            const height = (item.amount / max) * 100;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', height: '100%' }}>
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${height}%` }}
                                            transition={{ duration: 1, delay: i * 0.1, type: 'spring' }}
                                            style={{
                                                width: '100%',
                                                maxWidth: '32px',
                                                backgroundColor: i === (analytics.history.length - 1) ? '#0a0a0a' : '#f0f0f0',
                                                borderRadius: '8px',
                                                minHeight: item.amount > 0 ? '6px' : '0'
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '500' }}>{item.month.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </BentoItem>

            {/* 5. Top Categories with Donut Chart */}
            <BentoItem span={1}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Categories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'center' }}>
                    {/* Donut Chart */}
                    <div style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        background: getCategoryGradient(),
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{ width: '100px', height: '100px', backgroundColor: '#fff', borderRadius: '50%' }} />
                    </div>

                    {/* Compact Legend */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analytics?.categories?.slice(0, 3).map((cat, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][i % 5] }} />
                                    <span style={{ color: '#525252', textTransform: 'capitalize' }}>{cat.name}</span>
                                </div>
                                <span style={{ fontWeight: '600' }}>{((cat.value / (analytics.total || 1)) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </BentoItem>

            {/* 6. Quick Actions */}
            <BentoItem span={1} style={{ gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Quick Actions</h3>
                <Button
                    onClick={() => navigate('/groups/new')}
                    style={{ justifyContent: 'flex-start', backgroundColor: '#000' }}
                    icon={Plus}
                >
                    New Group
                </Button>
                <Button
                    variant="outline"
                    onClick={() => setShowAddFriendModal(true)}
                    style={{ justifyContent: 'flex-start' }}
                    icon={UserPlus}
                >
                    Add Friend
                </Button>

                {pendingReceived.length > 0 && (
                    <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#d97706' }}>
                                {pendingReceived.length} Pending
                            </span>
                            <Button size="sm" variant="ghost" style={{ fontSize: '11px', height: '24px' }}>View</Button>
                        </div>
                        {pendingReceived.slice(0, 1).map(r => (
                            <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.friend?.name || 'New Request'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </BentoItem>


            {/* 7. Groups */}
            <BentoItem span={2} style={{ minHeight: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '10px' }}>
                            <Users size={18} />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Groups</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/groups')}>View All</Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                    {groups.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#a3a3a3' }}>
                            <p style={{ fontSize: '13px' }}>No groups yet</p>
                        </div>
                    ) : (
                        groups.slice(0, 4).map(g => (
                            <motion.div
                                key={g._id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() => navigate(`/groups/${g._id}`)}
                                style={{
                                    padding: '12px', borderRadius: '16px', border: '1px solid #f5f5f5',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Avatar name={g.name} size="md" />
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{g.name}</p>
                                        <p style={{ fontSize: '12px', color: '#a3a3a3', margin: 0 }}>{g.members?.length} members</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: (g.userBalance || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {(g.userBalance || 0) >= 0 ? '+' : ''}{formatCurrency(g.userBalance || 0)}
                                </span>
                            </motion.div>
                        ))
                    )}
                </div>
            </BentoItem>

            {/* 8. Friends - Enhanced Grid Layout */}
            <BentoItem span={2} style={{ minHeight: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '8px', backgroundColor: '#fdf2f8', borderRadius: '10px' }}>
                            <Heart size={18} color="#ec4899" />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Friends</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/friends')}>View All</Button>
                </div>

                {acceptedFriends.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#a3a3a3', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p style={{ fontSize: '13px', marginBottom: '12px' }}>No friends yet</p>
                        <Button size="sm" onClick={() => setShowAddFriendModal(true)}>Add Friend</Button>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        overflowY: 'auto'
                    }}>
                        {acceptedFriends.slice(0, 4).map(f => {
                            const bal = friendBalances[f._id] || 0;

                            // Determine who is the friend
                            let friendData = {};
                            const isRequester = f.requester?._id === user?._id || f.requester === user?._id;

                            if (isRequester) {
                                friendData = {
                                    name: f.recipient?.name || f.recipientName,
                                    phone: f.recipient?.phone || f.recipientPhone
                                };
                            } else {
                                friendData = {
                                    name: f.requester?.name,
                                    phone: f.requester?.phone
                                };
                            }

                            return (
                                <motion.div
                                    key={f._id}
                                    whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                    onClick={() => { setSelectedFriend(f); navigate('/friends'); }}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: '1px solid #f5f5f5',
                                        backgroundColor: bal > 0 ? '#f0fdf4' : bal < 0 ? '#fef2f2' : '#ffffff',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                        textAlign: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Avatar name={friendData.name} size="md" />
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 2px', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friendData.name}</p>
                                        <p style={{ fontSize: '11px', color: '#737373', margin: 0 }}>{friendData.phone}</p>
                                    </div>

                                    {bal !== 0 ? (
                                        <Badge variant={bal >= 0 ? 'success' : 'destructive'} size="sm">
                                            {bal >= 0 ? 'Owes you ' : 'You owe '} {formatCurrency(Math.abs(bal))}
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" size="sm">Settled</Badge>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </BentoItem>

            {/* Add Friend Modal */}
            <Modal isOpen={showAddFriendModal} onClose={() => { setShowAddFriendModal(false); setNewFriendName(''); setNewFriendPhone(''); }} title="Add Friend">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#737373' }}>
                        Add a friend to split expenses directly.
                    </p>
                    <Input label="Friend's Name" placeholder="Enter name" value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)} icon={UserPlus} />
                    <Input label="Phone Number" placeholder="Enter phone number" value={newFriendPhone}
                        onChange={(e) => setNewFriendPhone(e.target.value)} icon={Phone} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                        <Button variant="ghost" onClick={() => { setShowAddFriendModal(false); setNewFriendName(''); setNewFriendPhone(''); }} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddFriend} disabled={!newFriendName.trim() || !newFriendPhone.trim() || friendsLoading} style={{ flex: 1 }}>
                            {friendsLoading ? 'Sending...' : 'Send Request'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
}

export default Dashboard;
