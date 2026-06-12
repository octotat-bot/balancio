import React from 'react';

export function Badge({ children, variant = 'default', size = 'md', style = {} }) {
    const variants = {
        default: { bg: 'var(--bg-surface)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
        success: { bg: 'var(--success-muted)', color: 'var(--success)', border: 'rgba(69, 194, 133, 0.3)' },
        warning: { bg: 'var(--warning-muted)', color: 'var(--warning)', border: 'rgba(212, 168, 83, 0.3)' },
        danger: { bg: 'var(--danger-muted)', color: 'var(--danger)', border: 'rgba(217, 85, 85, 0.3)' },
        primary: { bg: 'rgba(212, 168, 83, 0.12)', color: 'var(--accent)', border: 'rgba(212, 168, 83, 0.3)' },
    };

    const v = variants[variant] || variants.default;

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: size === 'sm' ? '2px 8px' : '4px 12px',
            borderRadius: '9999px',
            fontSize: size === 'sm' ? '12px' : '13px',
            fontWeight: '500',
            backgroundColor: v.bg,
            color: v.color,
            border: `1px solid ${v.border}`,
            ...style
        }}>
            {children}
        </span>
    );
}

export default Badge;
