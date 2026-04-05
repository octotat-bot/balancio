import React from 'react';
import { motion } from 'framer-motion';

export function Card({
    children,
    className = '',
    hover = false,
    style = {},
    ...props
}) {
    return (
        <motion.div
            whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : {}}
            style={{
                backgroundColor: '#131316',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #252530',
                cursor: hover ? 'pointer' : 'default',
                ...style
            }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function CardHeader({ children, className = '', style = {} }) {
    return (
        <div style={{ marginBottom: '16px', ...style }} className={className}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = '', style = {} }) {
    return (
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#EDEAE4', margin: 0, ...style }} className={className}>
            {children}
        </h3>
    );
}

export function CardDescription({ children, className = '', style = {} }) {
    return (
        <p style={{ fontSize: '14px', color: '#8A8680', marginTop: '4px', margin: 0, ...style }} className={className}>
            {children}
        </p>
    );
}

export function CardContent({ children, className = '', style = {} }) {
    return (
        <div style={style} className={className}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className = '', style = {} }) {
    return (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f5f5f5', ...style }} className={className}>
            {children}
        </div>
    );
}

export default Card;
