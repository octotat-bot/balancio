import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

const variants = {
    primary: {
        backgroundColor: '#D4A853',
        color: '#ffffff',
        border: 'none',
    },
    secondary: {
        backgroundColor: '#131316',
        color: '#EDEAE4',
        border: '2px solid #e5e5e5',
    },
    ghost: {
        backgroundColor: 'transparent',
        color: '#B0ADA8',
        border: 'none',
    },
    danger: {
        backgroundColor: '#dc2626',
        color: '#ffffff',
        border: 'none',
    },
};

const sizes = {
    sm: { height: '36px', padding: '0 14px', fontSize: '13px', gap: '6px' },
    md: { height: '44px', padding: '0 20px', fontSize: '14px', gap: '8px' },
    lg: { height: '52px', padding: '0 28px', fontSize: '15px', gap: '10px' },
};

export const Button = forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    type = 'button',
    style = {},
    ...props
}, ref) => {
    const buttonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '600',
        borderRadius: '12px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        outline: 'none',
        ...variants[variant],
        ...sizes[size],
        ...style,
    };

    return (
        <motion.button
            ref={ref}
            type={type}
            style={buttonStyle}
            disabled={disabled || loading}
            className={className}
            whileHover={!disabled && !loading ? { scale: 1.02, y: -2 } : {}}
            whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
            {...props}
        >
            {loading ? (
                <motion.svg
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ width: '18px', height: '18px' }}
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <circle
                        style={{ opacity: 0.25 }}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                    />
                    <path
                        style={{ opacity: 0.75 }}
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </motion.svg>
            ) : (
                <>
                    {Icon && iconPosition === 'left' && <Icon style={{ width: '18px', height: '18px' }} />}
                    {children}
                    {Icon && iconPosition === 'right' && <Icon style={{ width: '18px', height: '18px' }} />}
                </>
            )}
        </motion.button>
    );
});

Button.displayName = 'Button';
export default Button;
