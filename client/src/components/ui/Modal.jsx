import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 25 }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        y: 20,
        transition: { duration: 0.15 }
    },
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    const sizes = {
        sm: '400px',
        md: '500px',
        lg: '600px',
        xl: '900px',
        '2xl': '1100px',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={overlayVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={onClose}
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        zIndex: 100,
                    }}
                >
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={(e) => e.stopPropagation()}
                        className="modal-content"
                        style={{
                            backgroundColor: '#131316',
                            borderRadius: '20px',
                            width: '100%',
                            maxWidth: sizes[size],
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px 24px',
                                borderBottom: '1px solid #f5f5f5',
                            }}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#EDEAE4', margin: 0 }}>
                                {title}
                            </h2>
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#1A1A1F',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#B0ADA8',
                                }}
                            >
                                <X style={{ width: '18px', height: '18px' }} />
                            </motion.button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px' }}>
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default Modal;
