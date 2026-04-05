import React from 'react';

export function Skeleton({ className = '', variant = 'text', style = {}, width, height }) {
    const variants = {
        text: { height: '16px', borderRadius: '4px' },
        title: { height: '24px', width: '75%', borderRadius: '4px' },
        avatar: { height: '40px', width: '40px', borderRadius: '50%' },
        card: { height: '128px', borderRadius: '12px', width: '100%' },
        button: { height: '40px', width: '96px', borderRadius: '12px' },
    };

    const baseStyle = {
        backgroundColor: '#f0f0f0',
        animation: 'shimmer 1.5s infinite linear',
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        ...variants[variant],
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...style,
    };

    return (
        <div
            className={className}
            style={baseStyle}
        />
    );
}

export function SkeletonCard() {
    return (
        <div style={{
            backgroundColor: '#131316',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #252530',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton variant="avatar" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton variant="text" width="50%" />
                    <Skeleton variant="text" width="25%" />
                </div>
            </div>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
        </div>
    );
}

export function SkeletonList({ count = 3 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export default Skeleton;
