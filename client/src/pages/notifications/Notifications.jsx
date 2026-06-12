import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Wallet, AlertCircle, UserPlus, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useRefreshPolling } from '../../hooks/useRefreshPolling';

const typeMeta = {
    budget_alert: { icon: AlertCircle, color: '#f59e0b', label: 'Budget alert' },
    settlement_created: { icon: Wallet, color: '#22c55e', label: 'Settlement' },
    expense_added: { icon: Wallet, color: '#3b82f6', label: 'Expense' },
};

function getTitle(n) {
    if (n.type === 'budget_alert') {
        return n.payload?.message || 'Spending exceeded budget limit';
    }
    if (n.type === 'settlement_created') {
        return 'New settlement recorded';
    }
    if (n.type === 'expense_added') {
        return 'New expense added';
    }
    return n.type?.replace(/_/g, ' ') || 'Notification';
}

export function Notifications() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await api.get('/notifications', { params: { all: 'true' } });
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch {
            // skip
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);
    useRefreshPolling(load, 30000, true);

    const markRead = async (id) => {
        await api.post(`/notifications/${id}/read`);
        load();
    };

    const markAllRead = async () => {
        await api.post('/notifications/read-all');
        load();
    };

    return (
        <div style={{ paddingBottom: 100, maxWidth: 680, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0ADA8', padding: 8 }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#EDEAE4' }}>Notifications</h1>
                    <p style={{ margin: '4px 0 0', color: '#8A8680', fontSize: 14 }}>
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
                )}
            </div>

            {loading ? (
                <p style={{ color: '#8A8680' }}>Loading…</p>
            ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#8A8680' }}>
                    <Bell size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <p>No notifications yet</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notifications.map((n) => {
                        const meta = typeMeta[n.type] || { icon: Bell, color: '#8A8680', label: 'Alert' };
                        const Icon = meta.icon;
                        return (
                            <motion.div
                                key={n._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    padding: 16, borderRadius: 14,
                                    background: n.read ? '#131316' : '#1A1A1F',
                                    border: `1px solid ${n.read ? '#252530' : '#3f3f46'}`,
                                    opacity: n.read ? 0.75 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: `${meta.color}22`, color: meta.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {meta.label}
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#EDEAE4', marginTop: 2 }}>
                                            {getTitle(n)}
                                        </div>
                                        {n.payload?.amount != null && (
                                            <div style={{ color: '#D4A853', fontWeight: 700, marginTop: 4 }}>
                                                {formatCurrency(n.payload.amount)}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 12, color: '#6A6763', marginTop: 6 }}>
                                            {formatDate(n.createdAt, 'relative')}
                                        </div>
                                    </div>
                                    {!n.read && (
                                        <button
                                            onClick={() => markRead(n._id)}
                                            title="Mark read"
                                            style={{
                                                background: '#252530', border: 'none', borderRadius: 8,
                                                padding: 8, cursor: 'pointer', color: '#D4A853', height: 'fit-content',
                                            }}
                                        >
                                            <Check size={14} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Notifications;
