import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Users, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useGroupStore } from '../../stores/groupStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '../../utils/helpers';
import api from '../../services/api';
import { GLOBAL_SYNC_EVENT } from '../../constants/realtime';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
};

const cardVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: (i) => ({
        x: 0,
        opacity: 1,
        transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" }
    }),
    hover: {
        scale: 1.02,
        x: 8,
        transition: { duration: 0.2 }
    }
};

export function GroupList() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { groups, fetchGroups, isLoading } = useGroupStore();
    const { friends, fetchFriends } = useFriendStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [showFilters, setShowFilters] = useState(false);
    const [friendBalances, setFriendBalances] = useState({});

    useEffect(() => {
        fetchGroups();
        fetchFriends();
        api.get('/friends/balances').then(res => {
            setFriendBalances(res.data.balances || {});
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onGlobalSync = () => {
            api.get('/friends/balances')
                .then((res) => setFriendBalances(res.data.balances || {}))
                .catch(() => {});
        };
        window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
        return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    }, []);

    const acceptedFriends = friends?.accepted || [];
    const directEntries = acceptedFriends.map(f => {
        const isRequester = f.requester?._id === user?._id || f.requester === user?._id;
        const name = isRequester ? (f.recipient?.name || f.recipientName) : f.requester?.name;
        return {
            _id: f._id,
            name: name || 'Friend',
            balance: friendBalances[f._id] || 0,
        };
    });

    const filteredGroups = groups
        .filter((group) =>
            group.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'balance') return (b.userBalance || 0) - (a.userBalance || 0);
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                className="groups-header mobile-flex-col"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}
            >
                <div>
                    <motion.h1
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        style={{ fontSize: '28px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}
                    >
                        Groups
                    </motion.h1>
                    <motion.p
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}
                    >
                        Manage your expense groups
                    </motion.p>
                </div>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="mobile-w-full"
                >
                    <Button icon={Plus} onClick={() => navigate('/groups/new')} className="mobile-w-full">
                        New Group
                    </Button>
                </motion.div>
            </motion.div>

            {/* Search & Filters */}
            <motion.div
                variants={itemVariants}
                style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                }}
            >
                <motion.div
                    whileFocus={{ scale: 1.01 }}
                    style={{
                        flex: 1,
                        minWidth: '200px',
                        position: 'relative',
                    }}
                >
                    <Search
                        style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '20px',
                            height: '20px',
                            color: '#6A6763',
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '48px' }}
                        aria-label="Search groups"
                    />
                </motion.div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? 'chip chip-active' : 'chip'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 20px',
                        height: '48px',
                        fontSize: '14px',
                    }}
                    aria-expanded={showFilters}
                    aria-label="Toggle sort filters"
                >
                    <Filter style={{ width: '18px', height: '18px' }} />
                    Filters
                </motion.button>
            </motion.div>

            {/* Sort Options */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden', marginBottom: '24px' }}
                    >
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[
                                { value: 'recent', label: 'Most Recent' },
                                { value: 'name', label: 'Name' },
                                { value: 'balance', label: 'Balance' },
                            ].map((option) => (
                                <motion.button
                                    key={option.value}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSortBy(option.value)}
                                    className={sortBy === option.value ? 'chip chip-active' : 'chip'}
                                >
                                    {option.label}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {directEntries.length > 0 && (
                <motion.div variants={itemVariants} style={{ marginBottom: 28 }}>
                    <p style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: '#8A8680', marginBottom: 12,
                    }}>
                        Direct with friends
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {directEntries.map((entry, index) => (
                            <motion.div
                                key={entry._id}
                                whileHover={{ x: 4, backgroundColor: '#1A1A1F' }}
                                onClick={() => navigate(`/friends?friend=${entry._id}`)}
                                style={{
                                    backgroundColor: '#131316',
                                    borderRadius: 14,
                                    padding: '16px 20px',
                                    border: '1px dashed #3f3f46',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                }}
                            >
                                <span style={{ fontSize: 22 }}>💬</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 600, color: '#EDEAE4' }}>
                                        Direct with {entry.name}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8A8680' }}>
                                        1-on-1 expenses
                                    </p>
                                </div>
                                <span style={{
                                    fontWeight: 700,
                                    color: entry.balance < 0 ? '#D95555' : entry.balance > 0 ? '#45C285' : '#8A8680',
                                }}>
                                    {entry.balance < 0 ? '−' : entry.balance > 0 ? '+' : ''}
                                    {formatCurrency(Math.abs(entry.balance))}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#8A8680', marginBottom: 12,
            }}>
                Groups
            </p>

            {/* Groups List */}
            {isLoading ? (
                <SkeletonList count={4} />
            ) : filteredGroups.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {searchQuery ? (
                        <EmptyState
                            icon={Search}
                            title="No groups found"
                            description={`No groups matching "${searchQuery}"`}
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title="No groups yet"
                            description="Create your first group to start splitting expenses"
                            action={() => navigate('/groups/new')}
                            actionText="Create Group"
                        />
                    )}
                </motion.div>
            ) : (
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredGroups.map((group, index) => (
                        <motion.div
                            key={group._id}
                            custom={index}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            whileHover="hover"
                            onClick={() => navigate(`/groups/${group._id}`)}
                            style={{
                                backgroundColor: '#131316',
                                borderRadius: '16px',
                                padding: '20px 24px',
                                border: '1px solid #252530',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                            }}
                        >
                            <motion.div whileHover={{ rotate: 10 }}>
                                <Avatar name={group.name} size="lg" />
                            </motion.div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    fontWeight: '600',
                                    fontSize: '17px',
                                    color: '#EDEAE4',
                                    margin: '0 0 4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {group.name}
                                </p>
                                <p style={{ fontSize: '14px', color: '#8A8680', margin: 0 }}>
                                    {group.members?.length || 0} members
                                    {group.description && ` • ${group.description}`}
                                </p>
                            </div>

                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2 + index * 0.05 }}
                                style={{ textAlign: 'right' }}
                            >
                                <p
                                    style={{
                                        fontWeight: '600',
                                        fontSize: '18px',
                                        color: (group.userBalance || 0) >= 0 ? '#45C285' : '#D95555',
                                        margin: 0,
                                    }}
                                >
                                    {(group.userBalance || 0) >= 0 ? '+' : ''}{formatCurrency(group.userBalance || 0)}
                                </p>
                                <p style={{ fontSize: '12px', color: '#6A6763', margin: 0 }}>
                                    {(group.userBalance || 0) >= 0 ? 'you are owed' : 'you owe'}
                                </p>
                            </motion.div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}

export default GroupList;
