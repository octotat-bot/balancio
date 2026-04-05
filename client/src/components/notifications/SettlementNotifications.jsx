import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wallet, UserPlus, Users } from 'lucide-react';
import useSettlementNotificationStore from '../../stores/settlementNotificationStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useAuthStore } from '../../stores/authStore';

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

// Single notification card
function NotificationCard({ notification, onConfirm, onReject, onDismiss }) {
    const timerRef = useRef(null);

    // Auto-dismiss after 10 seconds
    useEffect(() => {
        timerRef.current = setTimeout(() => {
            onDismiss();
        }, 10000); // 10 seconds

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [onDismiss]);

    const { notificationType } = notification;


    // Get notification details based on type
    const getNotificationDetails = () => {
        switch (notificationType) {
            case 'friendRequest':
                return {
                    icon: UserPlus,
                    iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    title: 'Friend Request',
                    subtitle: 'New connection',
                    name: notification.requester?.name || notification.name || 'Someone',
                    message: 'wants to be friends',
                    confirmText: 'Accept',
                    rejectText: 'Decline'
                };
            case 'friendSettlement':
                return {
                    icon: Wallet,
                    iconBg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    title: 'Payment Received',
                    subtitle: `From ${notification.friendName || 'friend'}`,
                    name: notification.from?.name || 'Someone',
                    message: 'paid you',
                    amount: notification.amount,
                    confirmText: 'Confirm',
                    rejectText: 'Reject'
                };
            case 'groupSettlement':
                return {
                    icon: Users,
                    iconBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    title: 'Group Payment',
                    subtitle: notification.groupName || 'Group',
                    name: notification.from?.name || 'Someone',
                    message: 'paid you',
                    amount: notification.amount,
                    confirmText: 'Confirm',
                    rejectText: 'Reject'
                };
            default:
                return {
                    icon: Wallet,
                    iconBg: '#0a0a0a',
                    title: 'Notification',
                    subtitle: '',
                    name: 'Someone',
                    message: '',
                    confirmText: 'OK',
                    rejectText: 'Dismiss'
                };
        }
    };

    const details = getNotificationDetails();
    const IconComponent = details.icon;

    return (
        <motion.div
            initial={{ x: 400, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 400, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
                backgroundColor: '#131316',
                borderRadius: '20px',
                padding: '20px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                width: '360px',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Progress bar */}
            <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 10, ease: 'linear' }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '4px',
                    background: details.iconBg,
                    borderRadius: '0 0 4px 0'
                }}
            />

            {/* Close button */}
            <button
                onClick={onDismiss}
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#1A1A1F',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <X size={14} color='#8A8680' />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: details.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <IconComponent size={18} color="#fff" />
                </div>
                <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#EDEAE4' }}>
                        {details.title}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8A8680' }}>
                        {details.subtitle}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#1A1A1F',
                borderRadius: '14px',
                marginBottom: '16px'
            }}>
                <Avatar name={details.name} size="md" />
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#EDEAE4' }}>
                        {details.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8A8680' }}>
                        {details.message}
                    </p>
                    {details.amount && (
                        <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
                            {formatCurrency(details.amount)}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                    variant="ghost"
                    onClick={onReject}
                    style={{ flex: 1, color: '#dc2626', borderColor: '#fecaca' }}
                >
                    ✕ {details.rejectText}
                </Button>
                <Button
                    onClick={onConfirm}
                    icon={Check}
                    style={{ flex: 2 }}
                >
                    {details.confirmText}
                </Button>
            </div>
        </motion.div>
    );
}

// Main global notification component
export function SettlementNotifications() {
    const { user } = useAuthStore();
    const {
        activeNotifications,
        fetchAllPendingItems,
        dismissNotification,
        acceptFriendRequest,
        rejectFriendRequest,
        confirmFriendSettlement,
        rejectFriendSettlement,
        confirmGroupSettlement,
        rejectGroupSettlement
    } = useSettlementNotificationStore();
    const toast = useToast();

    // Poll for new items every 30 seconds (reduced frequency since we have real-time now)
    useEffect(() => {
        if (!user) {
            return;
        }

        // Initial fetch
        fetchAllPendingItems();

        // Set up polling as fallback - every 30 seconds
        const interval = setInterval(() => {
            fetchAllPendingItems();
        }, 30000);
        return () => clearInterval(interval);
    }, [user, fetchAllPendingItems]);

    // Listen for real-time notifications - directly add without API refetch
    useEffect(() => {
        const handleRealtimeNotification = (event) => {
            const { type, data } = event.detail;

            // Directly add the notification to show popup immediately
            const { addRealtimeNotification } = useSettlementNotificationStore.getState();
            addRealtimeNotification(type, data);
        };

        window.addEventListener('app:notification', handleRealtimeNotification);
        return () => window.removeEventListener('app:notification', handleRealtimeNotification);
    }, []);

    const handleConfirm = async (notification) => {
        let result;

        switch (notification.notificationType) {
            case 'friendRequest':
                result = await acceptFriendRequest(notification._id);
                if (result.success) {
                    toast.success('🎉 Friend Added!', 'You are now connected');
                    // Trigger friends refresh on dashboard
                    window.dispatchEvent(new CustomEvent('app:friends-updated'));
                }
                break;
            case 'friendSettlement':
                result = await confirmFriendSettlement(notification.friendshipId, notification._id);
                if (result.success) {
                    toast.success('✅ Payment Confirmed!', 'The balance has been updated');
                    window.dispatchEvent(new CustomEvent('app:friend-settlements-updated', {
                        detail: { friendshipId: notification.friendshipId }
                    }));
                }
                break;
            case 'groupSettlement':
                result = await confirmGroupSettlement(notification.groupId, notification._id);
                if (result.success) {
                    toast.success('✅ Payment Confirmed!', 'The group balance has been updated');
                }
                break;
            default:
                result = { success: false, message: 'Unknown notification type' };
        }

        if (!result.success) {
            toast.error('Failed', result.message);
        }
    };

    const handleReject = async (notification) => {
        let result;

        switch (notification.notificationType) {
            case 'friendRequest':
                result = await rejectFriendRequest(notification._id);
                if (result.success) {
                    toast.success('Request Declined', 'Friend request has been declined');
                    window.dispatchEvent(new CustomEvent('app:friends-updated'));
                }
                break;
            case 'friendSettlement':
                result = await rejectFriendSettlement(notification.friendshipId, notification._id);
                if (result.success) {
                    toast.success('❌ Payment Rejected', 'The payment has been declined');
                    window.dispatchEvent(new CustomEvent('app:friend-settlements-updated', {
                        detail: { friendshipId: notification.friendshipId }
                    }));
                }
                break;
            case 'groupSettlement':
                result = await rejectGroupSettlement(notification.groupId, notification._id);
                if (result.success) {
                    toast.success('❌ Payment Rejected', 'The payment has been declined');
                }
                break;
            default:
                result = { success: false, message: 'Unknown notification type' };
        }

        if (!result.success) {
            toast.error('Failed', result.message);
        }
    };

    const handleDismiss = (notificationId) => {
        dismissNotification(notificationId);
    };

    if (!user) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '12px'
        }}>
            <AnimatePresence>
                {activeNotifications.slice(0, 3).map((notification) => (
                    <NotificationCard
                        key={notification.notificationId}
                        notification={notification}
                        onConfirm={() => handleConfirm(notification)}
                        onReject={() => handleReject(notification)}
                        onDismiss={() => handleDismiss(notification.notificationId)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

export default SettlementNotifications;
