import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/Button';

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger' // 'danger' | 'warning' | 'info'
}) => {
    if (!isOpen) return null;

    const variants = {
        danger: {
            iconBg: '#fef2f2',
            iconColor: '#dc2626',
            buttonStyle: { backgroundColor: '#dc2626', color: '#fff' }
        },
        warning: {
            iconBg: '#fefce8',
            iconColor: '#ca8a04',
            buttonStyle: { backgroundColor: '#ca8a04', color: '#fff' }
        },
        info: {
            iconBg: '#eff6ff',
            iconColor: '#2563eb',
            buttonStyle: { backgroundColor: '#2563eb', color: '#fff' }
        }
    };

    const style = variants[variant] || variants.danger;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                    >
                        {/* Dialog */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: '#131316',
                                borderRadius: '20px',
                                padding: '24px',
                                maxWidth: '400px',
                                width: '100%',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                            }}
                        >
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '16px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} color='#8A8680' />
                            </button>

                            {/* Icon */}
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                backgroundColor: style.iconBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <AlertTriangle size={28} color={style.iconColor} />
                            </div>

                            {/* Title */}
                            <h3 style={{
                                textAlign: 'center',
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#EDEAE4',
                                margin: '0 0 8px'
                            }}>
                                {title}
                            </h3>

                            {/* Message */}
                            <p style={{
                                textAlign: 'center',
                                fontSize: '14px',
                                color: '#8A8680',
                                margin: '0 0 24px',
                                lineHeight: '1.5'
                            }}>
                                {message}
                            </p>

                            {/* Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: '12px'
                            }}>
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    style={{ flex: 1 }}
                                >
                                    {cancelText}
                                </Button>
                                <Button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    style={{ flex: 1, ...style.buttonStyle }}
                                >
                                    {confirmText}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
