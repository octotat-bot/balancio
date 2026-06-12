import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DURATION_MS = 3000;

export function IntroLoader({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const completedRef = React.useRef(false);

    const finish = React.useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
    }, [onComplete]);

    useEffect(() => {
        const start = Date.now();
        const tick = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
            setProgress(pct);
            if (elapsed >= DURATION_MS) {
                clearInterval(tick);
                finish();
            }
        }, 50);
        return () => clearInterval(tick);
    }, [finish]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base, #0C0C0F)',
                fontFamily: 'var(--font-sans)',
            }}
        >
            <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    background: 'var(--accent, #D4A853)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 60px rgba(212, 168, 83, 0.35)',
                    marginBottom: 24,
                }}
            >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '0.02em' }}
            >
                Balancio
            </motion.h1>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{ color: 'var(--text-muted)', fontSize: 15, margin: '0 0 32px' }}
            >
                Split expenses, stay balanced
            </motion.p>

            <div style={{ width: 200, height: 4, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'var(--accent)',
                        borderRadius: 999,
                        transition: 'width 50ms linear',
                    }}
                />
            </div>

            <button
                type="button"
                onClick={finish}
                style={{
                    position: 'absolute',
                    bottom: 32,
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '10px 20px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }}
            >
                Skip intro
            </button>
        </div>
    );
}

export default IntroLoader;
