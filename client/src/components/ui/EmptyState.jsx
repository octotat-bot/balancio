import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    actionText,
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#16161B',
                borderRadius: '20px',
                border: '2px dashed #e5e5e5',
            }}
        >
            {Icon && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    style={{
                        width: '72px',
                        height: '72px',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}
                >
                    <Icon style={{ width: '32px', height: '32px', color: '#6A6763' }} />
                </motion.div>
            )}
            <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#EDEAE4',
                    margin: '0 0 8px',
                }}
            >
                {title}
            </motion.h3>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                style={{
                    fontSize: '15px',
                    color: '#8A8680',
                    margin: '0 0 24px',
                    maxWidth: '300px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
            >
                {description}
            </motion.p>
            {action && actionText && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Button onClick={action}>{actionText}</Button>
                </motion.div>
            )}
        </motion.div>
    );
}

export default EmptyState;
