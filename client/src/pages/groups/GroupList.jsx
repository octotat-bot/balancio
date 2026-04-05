import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Users, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useGroupStore } from '../../stores/groupStore';
import { formatCurrency } from '../../utils/helpers';

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
    const { groups, fetchGroups, isLoading } = useGroupStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetchGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            style={{ paddingBottom: '100px' }}
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
                        style={{
                            width: '100%',
                            height: '48px',
                            paddingLeft: '48px',
                            paddingRight: '16px',
                            backgroundColor: '#131316',
                            border: '2px solid #e5e5e5',
                            borderRadius: '12px',
                            fontSize: '15px',
                            outline: 'none',
                            transition: 'border-color 0.2s ease',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#000'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                    />
                </motion.div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 20px',
                        height: '48px',
                        backgroundColor: showFilters ? '#000' : '#fff',
                        color: showFilters ? '#fff' : '#525252',
                        border: '2px solid #e5e5e5',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                    }}
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
                                    style={{
                                        padding: '10px 16px',
                                        backgroundColor: sortBy === option.value ? '#000' : '#f5f5f5',
                                        color: sortBy === option.value ? '#fff' : '#525252',
                                        border: 'none',
                                        borderRadius: '100px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {option.label}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Groups List */}
            {filteredGroups.length === 0 ? (
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
                                        color: (group.userBalance || 0) >= 0 ? '#16a34a' : '#dc2626',
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
