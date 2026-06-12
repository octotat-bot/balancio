import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';

const STEPS = [
    {
        target: 'navigation',
        title: 'Your command center',
        body: 'Jump between Home, Groups, Friends, Settlements, and Profile from the bottom dock.',
    },
    {
        target: 'balance-summary',
        title: 'Balance at a glance',
        body: 'See your net balance and how much you owe vs. what others owe you — updated in real time.',
    },
    {
        target: 'groups',
        title: 'Groups & friends',
        body: 'Quick access to your expense groups and 1-on-1 friend balances right from the dashboard.',
    },
    {
        target: 'quick-actions',
        title: 'Get started fast',
        body: 'Create a new group or add a friend in one tap — no digging through menus.',
    },
    {
        target: 'notifications',
        title: 'Never miss an update',
        body: 'Budget alerts, new expenses, and settlements show up in your notification bell.',
    },
];

const PADDING = 8;

function getTargetRect(target) {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
    };
}

export function DashboardTour({ onComplete }) {
    const [started, setStarted] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [spotlight, setSpotlight] = useState(null);

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;

    const updateSpotlight = useCallback(() => {
        if (!started) return;
        setSpotlight(getTargetRect(step.target));
    }, [started, step.target]);

    useEffect(() => {
        const timer = setTimeout(() => setStarted(true), 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        updateSpotlight();
        window.addEventListener('resize', updateSpotlight);
        window.addEventListener('scroll', updateSpotlight, true);
        return () => {
            window.removeEventListener('resize', updateSpotlight);
            window.removeEventListener('scroll', updateSpotlight, true);
        };
    }, [updateSpotlight]);

    const goNext = () => {
        if (isLast) {
            onComplete();
        } else {
            setStepIndex((i) => i + 1);
        }
    };

    const cardStyle = spotlight
        ? {
              position: 'fixed',
              left: Math.max(16, Math.min(spotlight.left, window.innerWidth - 336)),
              top: spotlight.top + spotlight.height + 16 > window.innerHeight - 180
                  ? Math.max(16, spotlight.top - 160)
                  : spotlight.top + spotlight.height + 16,
              width: 320,
              zIndex: 10002,
          }
        : {
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 320,
              zIndex: 10002,
          };

    if (!started) {
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    background: 'rgba(0, 0, 0, 0.6)',
                }}
            />
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'auto' }}>
            {/* Dim overlay with spotlight cutout */}
            {spotlight ? (
                <div
                    style={{
                        position: 'fixed',
                        top: spotlight.top,
                        left: spotlight.left,
                        width: spotlight.width,
                        height: spotlight.height,
                        borderRadius: 12,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
                        border: '2px solid var(--accent, #D4A853)',
                        pointerEvents: 'none',
                        zIndex: 10001,
                        transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
                    }}
                />
            ) : (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.72)',
                        zIndex: 10001,
                    }}
                />
            )}

            {/* Tour card */}
            <div
                style={{
                    ...cardStyle,
                    background: 'var(--bg-elevated, #131316)',
                    border: '1px solid var(--border-subtle, #252530)',
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
                    fontFamily: 'var(--font-sans)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Step {stepIndex + 1} of {STEPS.length}
                    </span>
                    <button
                        type="button"
                        onClick={onComplete}
                        aria-label="Skip tour"
                        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 0 }}
                    >
                        <X size={16} />
                    </button>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {step.title}
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                    {step.body}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={onComplete}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        Skip tour
                    </button>
                    <button
                        type="button"
                        onClick={goNext}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'var(--accent-ink, #1A0800)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                        }}
                    >
                        {isLast ? 'Finish' : 'Next'}
                        {!isLast && <ChevronRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardTour;
