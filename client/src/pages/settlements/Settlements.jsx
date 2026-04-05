import React, { useEffect, useState } from 'react';
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
import { formatCurrency } from '../../utils/helpers';
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
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'owe', 'owed'

    useEffect(() => {
        loadAllSettlements();
    }, []);

    const loadAllSettlements = async () => {
        setLoading(true);
        try {
            // Fetch all groups first
            await fetchGroups();

            // Fetch settlements for each group
            const groupsData = useGroupStore.getState().groups;
            const allDebts = [];

            for (const group of groupsData) {
                try {
                    const response = await api.get(`/settlements/${group._id}/balances`);
                    if (response.data.simplifiedDebts) {
                        // Add group info to each debt
                        const debtsWithGroup = response.data.simplifiedDebts.map(debt => ({
                            ...debt,
                            groupId: group._id,
                            groupName: group.name,
                            groupIcon: group.icon || '👥'
                        }));
                        allDebts.push(...debtsWithGroup);
                    }
                } catch (err) {
                    // Skip
                }
            }

            setAllSettlements(allDebts);
        } catch (error) {
            toast.error('Couldn\'t load settlements', 'Please check your connection');
        }
        setLoading(false);
    };

    // Filter settlements involving the current user
    const myDebts = allSettlements.filter(s => s.from._id === user?._id);
    const owedToMe = allSettlements.filter(s => s.to._id === user?._id);

    // Calculate totals
    const totalIOwe = myDebts.reduce((sum, d) => sum + d.amount, 0);
    const totalOwedToMe = owedToMe.reduce((sum, d) => sum + d.amount, 0);
    const netBalance = totalOwedToMe - totalIOwe;

    // Get filtered settlements based on active tab
    const getFilteredSettlements = () => {
        switch (activeTab) {
            case 'owe':
                return myDebts;
            case 'owed':
                return owedToMe;
            default:
                return [...myDebts, ...owedToMe];
        }
    };

    const tabs = [
        { id: 'all', label: 'All', count: myDebts.length + owedToMe.length },
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
            style={{ paddingBottom: '100px' }}
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
                            Settlements
                        </h1>
                        <p style={{ fontSize: '15px', color: '#8A8680', margin: '4px 0 0 0' }}>
                            All your debts and credits across groups
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
                    background: netBalance >= 0
                        ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                        : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                    border: 'none'
                }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#8A8680', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                        Net Balance
                    </p>
                    <p style={{
                        fontSize: '32px',
                        fontWeight: '800',
                        color: netBalance >= 0 ? '#16a34a' : '#dc2626',
                        margin: 0
                    }}>
                        {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#8A8680', margin: '8px 0 0 0' }}>
                        {netBalance >= 0 ? 'You are owed overall' : 'You owe overall'}
                    </p>
                </Card>

                {/* Total I Owe */}
                <Card hover={false} style={{ padding: '24px', backgroundColor: '#fef2f2', border: '2px solid #fecaca' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingDown size={18} style={{ color: '#dc2626' }} />
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', margin: 0, textTransform: 'uppercase' }}>
                            I Owe
                        </p>
                    </div>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626', margin: 0 }}>
                        {formatCurrency(totalIOwe)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#b91c1c', margin: '8px 0 0 0' }}>
                        To {myDebts.length} {myDebts.length === 1 ? 'person' : 'people'}
                    </p>
                </Card>

                {/* Total Owed to Me */}
                <Card hover={false} style={{ padding: '24px', backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={18} style={{ color: '#16a34a' }} />
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', margin: 0, textTransform: 'uppercase' }}>
                            Owed to Me
                        </p>
                    </div>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a', margin: 0 }}>
                        {formatCurrency(totalOwedToMe)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#15803d', margin: '8px 0 0 0' }}>
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
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '2px solid',
                            borderColor: activeTab === tab.id ? '#000' : '#e5e5e5',
                            backgroundColor: activeTab === tab.id ? '#000' : '#fff',
                            color: activeTab === tab.id ? '#fff' : '#525252',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '20px',
                            backgroundColor: activeTab === tab.id ? '#fff' : (tab.color || '#f5f5f5'),
                            color: activeTab === tab.id ? '#000' : (tab.color ? '#fff' : '#525252'),
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
                {getFilteredSettlements().length === 0 ? (
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
                                const isIOwe = settlement.from._id === user?._id;

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
                    onClick={loadAllSettlements}
                >
                    Refresh Settlements
                </Button>
            </motion.div>
        </motion.div>
    );
}

export default Settlements;
