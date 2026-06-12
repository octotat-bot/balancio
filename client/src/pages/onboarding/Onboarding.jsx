import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, UserPlus, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function Onboarding() {
    const navigate = useNavigate();
    const location = useLocation();
    const onboarding = location.state?.onboarding || {};
    const userName = location.state?.userName || 'there';
    const joinedGroups = onboarding.joinedGroups || [];
    const wasPending = onboarding.wasPendingMember;

    const finish = (path) => {
        sessionStorage.setItem('balancio-onboarding-done', '1');
        navigate(path, { replace: true });
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0C0C0F',
            color: '#EDEAE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: "'Syne', sans-serif",
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    maxWidth: 520,
                    width: '100%',
                    background: '#131316',
                    border: '1px solid #252530',
                    borderRadius: 24,
                    padding: 32,
                }}
            >
                <div style={{
                    width: 56, height: 56, borderRadius: 16, background: '#D4A853',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                }}>
                    <Sparkles size={28} color="#1A0800" />
                </div>

                <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>
                    Welcome, {userName.split(' ')[0]}!
                </h1>

                {wasPending && joinedGroups.length > 0 ? (
                    <>
                        <p style={{ color: '#8A8680', lineHeight: 1.6, margin: '0 0 20px' }}>
                            You were already added to {joinedGroups.length} group{joinedGroups.length > 1 ? 's' : ''} before you signed up. Your expenses are waiting for you.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {joinedGroups.map(g => (
                                <motion.button
                                    key={g._id}
                                    whileHover={{ x: 4 }}
                                    onClick={() => finish(`/groups/${g._id}`)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 16px', borderRadius: 12,
                                        border: '1px solid #252530', background: '#1A1A1F',
                                        cursor: 'pointer', textAlign: 'left', color: '#EDEAE4',
                                    }}
                                >
                                    <span style={{ fontSize: 24 }}>{g.icon || '👥'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{g.name}</div>
                                        <div style={{ fontSize: 12, color: '#8A8680' }}>Tap to open group</div>
                                    </div>
                                    <ArrowRight size={16} color="#D4A853" />
                                </motion.button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p style={{ color: '#8A8680', lineHeight: 1.6, margin: '0 0 24px' }}>
                        Balancio helps you split bills with friends and groups. Start by creating a group or adding a friend.
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Button icon={Users} onClick={() => finish('/groups/new')} style={{ width: '100%' }}>
                        Create a group
                    </Button>
                    <Button variant="secondary" icon={UserPlus} onClick={() => finish('/friends')} style={{ width: '100%' }}>
                        Add a friend
                    </Button>
                    <button
                        onClick={() => finish('/dashboard')}
                        style={{
                            background: 'none', border: 'none', color: '#8A8680',
                            fontSize: 14, cursor: 'pointer', padding: '8px 0',
                        }}
                    >
                        Skip for now → Dashboard
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default Onboarding;
