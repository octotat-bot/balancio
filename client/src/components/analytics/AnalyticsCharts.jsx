import React from 'react';
import { motion } from 'framer-motion';

export const Skeleton = ({ width, height, borderRadius = 8, style = {} }) => (
  <motion.div
    initial={{ opacity: 0.5 }}
    animate={{ opacity: 1 }}
    transition={{ repeat: Infinity, duration: 1, repeatType: 'mirror' }}
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #1A1A1F 0%, #252530 50%, #1A1A1F 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 2s infinite linear',
      ...style,
    }}
  />
);

export function DonutChart({ segments }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1A1A1F" strokeWidth={18} />
      {segments.map((seg, i) => {
        const dash = (Math.max(seg.pct, 0.1) / 100) * circ;
        const gap = circ - dash;
        const finalOffset = -offset;
        const el = (
          <motion.circle
            key={i}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={18}
            strokeDasharray={`${dash.toFixed(1)} ${gap.toFixed(1)}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: finalOffset }}
            transition={{ duration: 1 + i * 0.2, ease: 'easeOut' }}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export function BarChart({ data, labels, highlightIndex }) {
  const max = Math.max(...data, 80);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
        {data.map((v, i) => {
          const targetH = Math.max(3, Math.round((v / max) * 110));
          const isHi = i === highlightIndex;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <motion.div
                initial={{ height: 3 }}
                animate={{ height: targetH }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                style={{
                  width: '100%',
                  borderRadius: '3px 3px 0 0',
                  background: isHi ? '#D4A853' : '#222228',
                  cursor: 'pointer',
                }}
                title={`₹${v}`}
                whileHover={{ scaleY: 1.05, background: isHi ? '#F0C878' : '#8A6520', originY: 1 }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 5, overflowX: 'hidden' }}>
        {labels.map((l, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              color: '#4A4845',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BalanceUniverse({ friends, user }) {
  const r = 160;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
        background: '#131316',
        border: '1px solid #252530',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          zIndex: 1,
        }}
      />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
        {friends.filter((f) => f.amount !== 0).map((f, i, arr) => {
          const angle = (i / arr.length) * Math.PI * 2;
          const x2 = `calc(50% + ${Math.cos(angle) * r}px)`;
          const y2 = `calc(50% + ${Math.sin(angle) * r}px)`;
          const color = f.amount > 0 ? '#45C285' : '#D95555';
          return (
            <motion.line
              key={f._id}
              x1="50%"
              y1="50%"
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={Math.max(2, Math.min(Math.abs(f.amount) / 100, 8))}
              opacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: i * 0.1 }}
            />
          );
        })}
      </svg>

      <div style={{ position: 'relative', zIndex: 3, width: '100%', height: 480 }}>
        <motion.div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            x: '-50%',
            y: '-50%',
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#D4A853',
            boxShadow: '0 0 40px rgba(212,168,83,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #F0C878',
          }}
        >
          {user?.avatar ? (
            <img src={user.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} draggable="false" alt="avatar" />
          ) : (
            <span style={{ color: '#1A0800', fontWeight: 800, fontSize: 24, userSelect: 'none' }}>
              {user?.name?.[0]?.toUpperCase()}
            </span>
          )}
        </motion.div>

        {friends.filter((f) => f.amount !== 0).map((f, i, arr) => {
          const angle = (i / arr.length) * Math.PI * 2;
          const color = f.amount > 0 ? '#45C285' : '#D95555';
          const nodeRadius = Math.max(60, Math.min(60 + Math.abs(f.amount) / 100, 110));
          const targetX = `calc(50% + ${Math.cos(angle) * r}px)`;
          const targetY = `calc(50% + ${Math.sin(angle) * r}px)`;

          return (
            <motion.div
              key={f._id}
              initial={{ top: '50%', left: '50%', x: '-50%', opacity: 0, y: '-50%' }}
              animate={{ top: targetY, left: targetX, opacity: 1, y: '-50%' }}
              transition={{ type: 'spring', stiffness: 50, damping: 10, delay: i * 0.1 }}
              style={{
                position: 'absolute',
                width: nodeRadius,
                height: nodeRadius,
                borderRadius: '50%',
                background: '#1A1A1F',
                border: `3px solid ${color}`,
                boxShadow: `0 0 20px ${color}40`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
            >
              <span style={{ color: '#EDEAE4', fontWeight: 700, fontSize: nodeRadius / 4.5 }}>{f.name.split(' ')[0]}</span>
              <span style={{ color, fontWeight: 800, fontSize: nodeRadius / 5.5, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                {f.amount > 0 ? '+' : '−'}₹{Math.abs(f.amount)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
