import React, { createContext, useContext, useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = ({ title, message, type = 'info', duration = 4000 }) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, title, message, type, duration, isExiting: false }]);

        if (duration > 0) {
            setTimeout(() => {
                // Start exit animation
                setToasts((prev) =>
                    prev.map((toast) =>
                        toast.id === id ? { ...toast, isExiting: true } : toast
                    )
                );
                // Remove after animation completes
                setTimeout(() => {
                    removeToast(id);
                }, 300);
            }, duration);
        }
    };

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const handleClose = (id) => {
        setToasts((prev) =>
            prev.map((toast) =>
                toast.id === id ? { ...toast, isExiting: true } : toast
            )
        );
        setTimeout(() => {
            removeToast(id);
        }, 300);
    };

    const toast = {
        success: (title, message) => addToast({ title, message, type: 'success' }),
        error: (title, message) => addToast({ title, message, type: 'error' }),
        warning: (title, message) => addToast({ title, message, type: 'warning' }),
        info: (title, message) => addToast({ title, message, type: 'info' }),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onClose={handleClose} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onClose }) {
    return (
        <div style={{
            position: 'fixed',
            bottom: '30px', /* Bottom center display for premium feel */
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none',
        }}>
            <style>{`
                @keyframes toastSlideUp {
                    0% { opacity: 0; transform: translateY(20px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes toastFadeOut {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(10px) scale(0.95); }
                }
            `}</style>
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onClose={() => onClose(toast.id)} />
            ))}
        </div>
    );
}

function Toast({ title, message, type, duration, isExiting, onClose }) {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (duration > 0) {
            const interval = setInterval(() => {
                setProgress((prev) => {
                    const decrement = 100 / (duration / 50);
                    return Math.max(0, prev - decrement);
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [duration]);

    const configs = {
        success: {
            icon: <CheckCircle size={18} color="#fff" />,
            iconBg: '#45C285', // Jade green
            shadow: 'rgba(69, 194, 133, 0.2)'
        },
        error: {
            icon: <XCircle size={18} color="#fff" />,
            iconBg: '#D95555', // Crimson
            shadow: 'rgba(217, 85, 85, 0.2)'
        },
        warning: {
            icon: <AlertCircle size={18} color="#fff" />,
            iconBg: '#D4A853', // Gold
            shadow: 'rgba(212, 168, 83, 0.2)'
        },
        info: {
            icon: <Info size={18} color="#fff" />,
            iconBg: '#3b82f6', // Blue
            shadow: 'rgba(59, 130, 246, 0.2)'
        },
    };

    const config = configs[type];

    return (
        <div style={{
            pointerEvents: 'auto',
            position: 'relative',
            overflow: 'hidden',
            background: 'rgba(19, 19, 22, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid #252530',
            boxShadow: \`0 16px 40px rgba(0,0,0,0.5), 0 0 20px \${config.shadow}\`,
            minWidth: '320px',
            maxWidth: '420px',
            fontFamily: "'Syne', sans-serif",
            animation: isExiting ? 'toastFadeOut 0.3s forwards ease-in' : 'toastSlideUp 0.4s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            {/* Content Wrap */}
            <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                {/* Icon Container */}
                <div style={{
                    flexShrink: 0,
                    width: '36px', height: '36px',
                    borderRadius: '12px',
                    background: config.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: \`0 4px 12px \${config.shadow}\`
                }}>
                    {config.icon}
                </div>

                {/* Text Context */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
                    {title && (
                        <p style={{
                            margin: 0, fontSize: '14px', fontWeight: 700,
                            color: '#EDEAE4', lineHeight: '1.2'
                        }}>
                            {title}
                        </p>
                    )}
                    {message && (
                        <p style={{
                            margin: '4px 0 0 0', fontSize: '13px',
                            color: '#8A8680', lineHeight: '1.4'
                        }}>
                            {message}
                        </p>
                    )}
                </div>

                {/* Close Toggle */}
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent', border: 'none',
                        width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#4A4845', cursor: 'pointer',
                        padding: 0, marginTop: '2px', borderRadius: '50%',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#EDEAE4'}
                    onMouseLeave={e => e.currentTarget.style.color = '#4A4845'}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Progress Bar Indicator */}
            <div style={{ height: '3px', background: '#252530', width: '100%', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: \`\${progress}%\`,
                    background: config.iconBg,
                    transition: 'width 75ms linear',
                    borderTopRightRadius: '3px',
                    borderBottomRightRadius: '3px'
                }} />
            </div>
        </div>
    );
}

export default ToastProvider;
