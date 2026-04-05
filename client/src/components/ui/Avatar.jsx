import React from 'react';
import { motion } from 'framer-motion';

const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

const getColor = (name) => {
    const colors = [
        '#000000', '#1a1a1a', '#2d2d2d', '#404040',
        '#525252', '#666666', '#737373', '#858585',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
};

const sizes = {
    sm: { width: '32px', height: '32px', fontSize: '12px' },
    md: { width: '40px', height: '40px', fontSize: '14px' },
    lg: { width: '56px', height: '56px', fontSize: '18px' },
    xl: { width: '80px', height: '80px', fontSize: '24px' },
};

export function Avatar({ name, src, size = 'md', className = '' }) {
    const sizeStyles = sizes[size];

    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            style={{
                ...sizeStyles,
                borderRadius: '14px',
                backgroundColor: src ? 'transparent' : getColor(name),
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                overflow: 'hidden',
                flexShrink: 0,
            }}
            className={className}
        >
            {src ? (
                <img
                    src={src}
                    alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                getInitials(name)
            )}
        </motion.div>
    );
}

export function AvatarGroup({ users, max = 4, size = 'sm' }) {
    const displayUsers = users?.slice(0, max) || [];
    const remaining = Math.max(0, (users?.length || 0) - max);
    const sizeStyles = sizes[size];

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            {displayUsers.map((user, index) => (
                <motion.div
                    key={user._id || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                        marginLeft: index > 0 ? '-8px' : 0,
                        zIndex: displayUsers.length - index,
                    }}
                >
                    <Avatar name={user.name} src={user.avatar} size={size} />
                </motion.div>
            ))}
            {remaining > 0 && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: displayUsers.length * 0.05 }}
                    style={{
                        ...sizeStyles,
                        marginLeft: '-8px',
                        borderRadius: '14px',
                        backgroundColor: '#1A1A1F',
                        color: '#B0ADA8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        border: '2px solid #fff',
                    }}
                >
                    +{remaining}
                </motion.div>
            )}
        </div>
    );
}

export default Avatar;
