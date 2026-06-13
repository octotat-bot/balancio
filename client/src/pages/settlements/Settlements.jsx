import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet,
    ArrowRight,
    CheckCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    Users,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, isSameId } from '../../utils/helpers';
import { REALTIME_POLL_FAST_MS } from '../../constants/realtime';
import { useRefreshPolling } from '../../hooks/useRefreshPolling';
import api from '../../services/api';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
};

export function Settlements() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { groups, fetchGroups } = useGroupStore();
    const toast = useToast();

    const [allSettlements, setAllSettlements] = useState([]);
    const [globalSummary, setGlobalSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('people'); // 'people', 'all', 'owe', 'owed'
    const hasLoadedOnce = useRef(false);

    const loadAllSettlements = useCallback(async ({ showSpinner = false } = {}) => {
        if (showSpinner || !hasLoadedOnce.current) {
            setLoading(true);
        }
        try {
            await fetchGroups();

            const groupsData = useGroupStore.getState().groups;
            const allDebts = [];

            for (const group of groupsData) {
                try {
                    const response = await api.get(`/settlements/${group._id}/balances`);
                    if (response.data.simplifiedDebts) {
                        const debtsWithGroup = response.data.simplifiedDebts.map(debt => ({
                            ...debt,
                            groupId: group._id,
                            groupName: group.name,
                            groupIcon: group.icon || '👥'
                        }));
                        allDebts.push(...debtsWithGroup);
                    }
                } catch {
                    // Skip groups that fail to load
                }
            }

            setAllSettlements(allDebts);

            try {
                const summaryRes = await api.get('/settlements/global/summary');
                setGlobalSummary(summaryRes.data);
            } catch {
                setGlobalSummary(null);
            }

            hasLoadedOnce.current = true;
        } catch {
            toast.error('Couldn\'t load settlements', 'Please check your connection');
        } finally {
            setLoading(false);
        }
    }, [fetchGroups, toast]);

    useEffect(() => {
        loadAllSettlements({ showSpinner: true });
    }, [loadAllSettlements]);

    useRefreshPolling(
        () => loadAllSettlements({ showSpinner: false }),
        REALTIME_POLL_FAST_MS,
        true
    );

    // Filter settlements involving the current user
    const myDebts = allSettlements.filter(s => isSameId(s.from, user?._id));
    const owedToMe = allSettlements.filter(s => isSameId(s.to, user?._id));

    const totalIOwe = globalSummary?.totalIOwe ?? myDebts.reduce((sum, d) => sum + d.amount, 0);
    const totalOwedToMe = globalSummary?.totalOwedToMe ?? owedToMe.reduce((sum, d) => sum + d.amount, 0);
    const netBalance = globalSummary?.netBalance ?? (totalOwedToMe - totalIOwe);
    const byPerson = globalSummary?.byPerson || [];

    const getFilteredSettlements = () => {
        switch (activeTab) {
            case 'owe':
                return myDebts;
            case 'owed':
                return owedToMe;
            case 'people':
                return [];
            default:
                return [...myDebts, ...owedToMe];
        }
    };

    const tabs = [
        { id: 'people', label: 'By Person', count: byPerson.length },
        { id: 'all', label: 'All Debts', count: myDebts.length + owedToMe.length },
        { id: 'owe', label: 'I Owe', count: myDebts.length, color: '#dc2626' },
        { id: 'owed', label: 'Owed to Me', count: owedToMe.length, color: '#16a34a' },
    ];

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px'
            }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                    <RefreshCw size={32} style={{ color: '#6A6763' }} />
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <motion.div variants={itemVariants} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: '#D4A853',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Wallet style={{ width: '24px', height: '24px', color: '#fff' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#EDEAE4', margin: 0 }}>
                            What I Owe
                        </h1>
                        <p style={{ fontSize: '15px', color: '#8A8680', margin: '4px 0 0 0' }}>
                            Your balances with everyone — groups and friends
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Summary Cards */}
            <motion.div
                variants={itemVariants}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '32px'
                }}
            >
                {/* Net Balance */}
                <Card hover={false} style={{
                    padding: '24px',
                    background: netBalance >= 0 ? 'var(--success-muted)' : 'var(--danger-muted)',
                    border: `1px solid ${netBalance >= 0 ? 'rgba(69, 194, 133, 0.25)' : 'rgba(217, 85, 85, 0.25)'}`,
                }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                        Net Balance
                    </p>
                    <p style={{
                        fontSize: '32px',
                        fontWeight: '800',
                        color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)',
                        margin: 0
                    }}>
                        {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#8A8680', margin: '8px 0 0 0' }}>
                        {netBalance >= 0 ? 'You are owed overall' : 'You owe overall'}
                    </p>
                </Card>

                {/* Total I Owe */}
                <Card hover={false} style={{ padding: '24px', backgroundColor: 'var(--danger-muted)', border: '1px solid rgba(217, 85, 85, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingDown size={18} style={{ color: 'var(--danger)' }} />
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)', margin: 0, textTransform: 'uppercase' }}>
                            I Owe
                        </p>
                    </div>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: 'var(--danger)', margin: 0 }}>
                        {formatCurrency(totalIOwe)}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                        To {myDebts.length} {myDebts.length === 1 ? 'person' : 'people'}
                    </p>
                </Card>

                {/* Total Owed to Me */}
                <Card hover={false} style={{ padding: '24px', backgroundColor: 'var(--success-muted)', border: '1px solid rgba(69, 194, 133, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={18} style={{ color: 'var(--success)' }} />
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)', margin: 0, textTransform: 'uppercase' }}>
                            Owed to Me
                        </p>
                    </div>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: 'var(--success)', margin: 0 }}>
                        {formatCurrency(totalOwedToMe)}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                        From {owedToMe.length} {owedToMe.length === 1 ? 'person' : 'people'}
                    </p>
                </Card>
            </motion.div>

            {/* Tabs */}
            <motion.div
                variants={itemVariants}
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '24px',
                    overflowX: 'auto',
                    paddingBottom: '4px'
                }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={activeTab === tab.id ? 'chip chip-active' : 'chip'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            whiteSpace: 'nowrap',
                            fontSize: '14px',
                            fontWeight: 600,
                        }}
                    >
                        {tab.label}
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '20px',
                            backgroundColor: activeTab === tab.id ? 'rgba(26, 8, 0, 0.15)' : 'var(--bg-hover)',
                            color: activeTab === tab.id ? 'var(--accent-ink)' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: '700'
                        }}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </motion.div>

            {/* Settlements List */}
            <motion.div variants={itemVariants}>
                {activeTab === 'people' ? (
                    byPerson.length === 0 ? (
                        <Card hover={false} style={{ padding: 48, textAlign: 'center', backgroundColor: 'var(--success-muted)', border: '1px solid rgba(69, 194, 133, 0.25)' }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>All settled up!</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>You don&apos;t owe anyone and no one owes you.</p>
                        </Card>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {byPerson.map((person, index) => (
                                <Card key={person.personId} hover={false} style={{ padding: 20, border: '1px solid #252530' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                                        <Avatar name={person.name} size="lg" />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#EDEAE4' }}>
                                                {person.name}
                                                {person.isPending && (
                                                    <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⏳ waiting to join</span>
                                                )}
                                            </p>
                                            {person.phone && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8A8680' }}>{person.phone}</p>}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {person.youOwe > 0.01 && (
                                                <p style={{ margin: 0, color: '#dc2626', fontWeight: 800 }}>You owe {formatCurrency(person.youOwe)}</p>
                                            )}
                                            {person.theyOwe > 0.01 && (
                                                <p style={{ margin: 0, color: '#16a34a', fontWeight: 800 }}>Owes you {formatCurrency(person.theyOwe)}</p>
                                            )}
                                        </div>
                                    </div>
                                    {person.items?.map((item, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                if (item.type === 'friend') navigate(`/friends?friend=${item.friendshipId}`);
                                                else navigate(`/groups/${item.groupId}`);
                                            }}
                                            style={{
                                                width: '100%', textAlign: 'left', padding: '10px 12px',
                                                marginTop: 6, borderRadius: 10, border: '1px solid #252530',
                                                background: '#1A1A1F', cursor: 'pointer', color: '#B0ADA8', fontSize: 13,
                                            }}
                                        >
                                            {item.type === 'friend' ? '💬 Direct' : `${item.groupIcon || '👥'} ${item.groupName}`}
                                            {' — '}
                                            <span style={{ color: item.direction === 'owe' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </button>
                                    ))}
                                </Card>
                            ))}
                        </div>
                    )
                ) : getFilteredSettlements().length === 0 ? (
                    <Card hover={false} style={{
                        padding: '48px',
                        textAlign: 'center',
                        backgroundColor: '#f0fdf4',
                        border: '2px solid #bbf7d0'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>
                            All Settled Up!
                        </h3>
                        <p style={{ margin: 0, fontSize: '15px', color: '#15803d' }}>
                            {activeTab === 'owe'
                                ? "You don't owe anyone!"
                                : activeTab === 'owed'
                                    ? "No one owes you right now"
                                    : "No pending settlements"
                            }
                        </p>
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <AnimatePresence>
                            {getFilteredSettlements().map((settlement, index) => {
                                const isIOwe = isSameId(settlement.from, user?._id);

                                return (
                                    <motion.div
                                        key={`${settlement.groupId}-${index}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card
                                            hover
                                            onClick={() => navigate(`/groups/${settlement.groupId}`)}
                                            style={{
                                                padding: '20px',
                                                cursor: 'pointer',
                                                border: '2px solid',
                                                borderColor: isIOwe ? '#fecaca' : '#bbf7d0',
                                                backgroundColor: isIOwe ? '#fef2f2' : '#f0fdf4'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                {/* Person Avatar */}
                                                <Avatar
                                                    name={isIOwe ? settlement.to.name : settlement.from.name}
                                                    size="lg"
                                                />

                                                {/* Details */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <p style={{
                                                            margin: 0,
                                                            fontWeight: '700',
                                                            fontSize: '16px',
                                                            color: '#EDEAE4'
                                                        }}>
                                                            {isIOwe ? settlement.to.name : settlement.from.name}
                                                        </p>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            backgroundColor: isIOwe ? '#dc2626' : '#16a34a',
                                                            color: '#fff',
                                                            fontSize: '11px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {isIOwe ? 'You Owe' : 'Owes You'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '18px' }}>{settlement.groupIcon}</span>
                                                        <span style={{ fontSize: '14px', color: '#8A8680' }}>
                                                            {settlement.groupName}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '24px',
                                                        fontWeight: '800',
                                                        color: isIOwe ? '#dc2626' : '#16a34a'
                                                    }}>
                                                        {isIOwe ? '-' : '+'}{formatCurrency(settlement.amount)}
                                                    </p>
                                                </div>

                                                {/* Arrow */}
                                                <ArrowRight size={20} style={{ color: '#6A6763' }} />
                                            </div>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>

            {/* Refresh Button */}
            <motion.div
                variants={itemVariants}
                style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}
            >
                <Button
                    variant="secondary"
                    icon={RefreshCw}
                    onClick={() => loadAllSettlements({ showSpinner: true })}
                >
                    Refresh Settlements
                </Button>
            </motion.div>
        </motion.div>
    );
}

export default Settlements;
