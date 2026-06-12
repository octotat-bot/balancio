import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { normalizePhone } from '../../utils/phone';

export function PhoneLookupFeedback({ phone, onResolved, excludeUserId }) {
    const [status, setStatus] = useState('idle'); // idle | loading | found | pending
    const [matchedUser, setMatchedUser] = useState(null);

    useEffect(() => {
        const normalized = normalizePhone(phone);
        if (!normalized || normalized.length < 10) {
            setStatus('idle');
            setMatchedUser(null);
            return undefined;
        }

        let cancelled = false;
        setStatus('loading');

        const timer = setTimeout(async () => {
            try {
                const res = await api.get('/users/lookup', { params: { phone: normalized } });
                if (cancelled) return;

                if (res.data.found && res.data.user) {
                    if (excludeUserId && res.data.user._id === excludeUserId) {
                        setStatus('self');
                        setMatchedUser(null);
                        onResolved?.({ type: 'self', user: res.data.user });
                        return;
                    }
                    setStatus('found');
                    setMatchedUser(res.data.user);
                    onResolved?.({ type: 'found', user: res.data.user, normalizedPhone: res.data.normalizedPhone });
                } else {
                    setStatus('pending');
                    setMatchedUser(null);
                    onResolved?.({ type: 'pending', normalizedPhone: res.data.normalizedPhone });
                }
            } catch {
                if (!cancelled) setStatus('idle');
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [phone, excludeUserId, onResolved]);

    if (status === 'idle' || status === 'loading') {
        if (status === 'loading' && normalizePhone(phone)?.length >= 10) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: '#8A8680' }}>
                    <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Checking number…
                </div>
            );
        }
        return null;
    }

    if (status === 'self') {
        return (
            <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#b91c1c',
            }}>
                That&apos;s your phone number — you&apos;re already in the group.
            </div>
        );
    }

    if (status === 'found') {
        return (
            <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 10,
                background: '#ecfdf5', border: '1px solid #bbf7d0',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#166534',
            }}>
                <CheckCircle size={16} />
                <span><strong>{matchedUser?.name}</strong> is on Balancio — will be added instantly</span>
            </div>
        );
    }

    return (
        <div style={{
            marginTop: 8, padding: '10px 12px', borderRadius: 10,
            background: '#fffbeb', border: '1px solid #fde68a',
            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#92400e',
        }}>
            <Clock size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
                Not on Balancio yet — added as <strong>pending</strong>. They&apos;ll join automatically when they sign up with this number.
            </span>
        </div>
    );
}

export default PhoneLookupFeedback;
