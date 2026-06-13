import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, UserPlus, Plus, ArrowRight, TrendingUp, Wallet } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useFriendStore } from '../../stores/friendStore';
import api from '../../services/api';
import { GLOBAL_SYNC_EVENT } from '../../constants/realtime';

const Skeleton = ({ width, height, borderRadius = 8, style = {} }) => (
  <div
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

const card = {
  background: '#131316',
  border: '1px solid #252530',
  borderRadius: 16,
  overflow: 'hidden',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { groups, fetchGroups } = useGroupStore();
  const { friends, fetchFriends } = useFriendStore();
  const [friendBalances, setFriendBalances] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const acceptedFriends = friends?.accepted || [];

  useEffect(() => {
    Promise.all([fetchGroups(), fetchFriends()]).finally(() => setIsLoading(false));
  }, [fetchGroups, fetchFriends]);

  useEffect(() => {
    const fetchAllFriendBalances = async () => {
      if (acceptedFriends.length === 0) {
        setFriendBalances({});
        return;
      }
      try {
        const response = await api.get('/friends/balances');
        setFriendBalances(response.data.balances || {});
      } catch {
        setFriendBalances({});
      }
    };
    fetchAllFriendBalances();
  }, [acceptedFriends]);

  useEffect(() => {
    const onGlobalSync = () => {
      if (acceptedFriends.length === 0) return;
      api.get('/friends/balances')
        .then((res) => setFriendBalances(res.data.balances || {}))
        .catch(() => {});
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
  }, [acceptedFriends]);

  const groupTotals = (groups || []).reduce(
    (acc, g) => {
      const b = g.userBalance || 0;
      if (b > 0) acc.owed += b;
      else acc.owes += Math.abs(b);
      return acc;
    },
    { owed: 0, owes: 0 }
  );

  const friendTotals = Object.values(friendBalances).reduce(
    (acc, b) => {
      if (b > 0) acc.owed += b;
      else acc.owes += Math.abs(b);
      return acc;
    },
    { owed: 0, owes: 0 }
  );

  const totals = { owed: groupTotals.owed + friendTotals.owed, owes: groupTotals.owes + friendTotals.owes };
  const netBalance = totals.owed - totals.owes;
  const hasDebts = totals.owed > 0 || totals.owes > 0;

  const mappedGroups = (groups || []).slice(0, 5).map((g) => ({
    _id: g._id,
    name: g.name || 'Group',
    members: g.members?.length || 1,
    amount: g.userBalance || 0,
  }));

  const mappedFriends = acceptedFriends.slice(0, 5).map((f) => {
    const bal = friendBalances[f._id] || 0;
    const isRequester = f.requester?._id === user?._id || f.requester === user?._id;
    const friendName = isRequester ? f.recipient?.name || f.recipientName : f.requester?.name;
    return { _id: f._id, name: friendName || 'Friend', amount: bal };
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatAmount = (amount) => {
    const abs = Math.abs(amount).toFixed(2);
    if (amount < 0) return `−₹${abs}`;
    if (amount > 0) return `+₹${abs}`;
    return `₹${abs}`;
  };

  const listRow = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(37,37,48,0.5)',
    transition: 'background 0.15s',
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: "'Syne', sans-serif" }}>
      {/* Greeting + net balance */}
      <div data-tour="balance-summary" style={{ marginBottom: 20 }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#4A4845', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {getGreeting()}
        </p>
        <h1 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
          {user?.name?.split(' ')[0] || 'there'}
        </h1>

        <div style={{ ...card, padding: '20px 22px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#8A8680' }}>Your net balance</p>
          {isLoading ? (
            <Skeleton width={140} height={36} />
          ) : (
            <>
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 36,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: netBalance >= 0 ? '#45C285' : '#D95555',
                }}
              >
                {netBalance < 0 ? '−' : ''}₹{Math.abs(netBalance).toFixed(2)}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: netBalance >= 0 ? 'rgba(69,194,133,0.15)' : 'rgba(217,85,85,0.15)',
                  color: netBalance >= 0 ? '#45C285' : '#D95555',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {netBalance > 0 ? 'You are owed overall' : netBalance < 0 ? 'You owe overall' : 'All settled up'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Owed / Owe summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'You are owed', value: totals.owed, color: '#45C285', bg: 'rgba(69,194,133,0.08)' },
          { label: 'You owe', value: totals.owes, color: '#D95555', bg: 'rgba(217,85,85,0.08)' },
        ].map((stat) => (
          <div key={stat.label} style={{ ...card, padding: '16px 18px', background: stat.bg }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {stat.label}
            </p>
            {isLoading ? (
              <Skeleton width={80} height={28} />
            ) : (
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: stat.color }}>
                ₹{stat.value.toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>

      {hasDebts && !isLoading && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/settlements')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 20px',
            marginBottom: 20,
            borderRadius: 12,
            border: '1px solid #D4A853',
            background: 'rgba(212,168,83,0.12)',
            color: '#D4A853',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Wallet size={16} />
          Settle up
          <ArrowRight size={16} />
        </motion.button>
      )}

      {/* Groups */}
      <div data-tour="groups" style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} />
            Groups
          </span>
          <button type="button" onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: '#D4A853', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            View all
          </button>
        </div>
        {isLoading ? (
          <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={52} borderRadius={10} />
            ))}
          </div>
        ) : mappedGroups.length === 0 ? (
          <div style={{ padding: '8px 20px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4A4845' }}>No groups yet</p>
            <button
              type="button"
              onClick={() => navigate('/groups/new')}
              style={{
                background: '#D4A853',
                color: '#1A0800',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Create your first group
            </button>
          </div>
        ) : (
          mappedGroups.map((g, i) => (
            <div
              key={g._id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/groups/${g._id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/groups/${g._id}`)}
              style={{ ...listRow, borderBottom: i < mappedGroups.length - 1 ? listRow.borderBottom : 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1F'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#222228', border: '1px solid #252530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#D4A853', flexShrink: 0 }}>
                {g.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: '#4A4845' }}>{g.members} member{g.members !== 1 ? 's' : ''}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: g.amount < 0 ? '#D95555' : g.amount > 0 ? '#45C285' : '#8A8680' }}>
                {formatAmount(g.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Friends */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Friends
          </span>
          <button type="button" onClick={() => navigate('/friends')} style={{ background: 'none', border: 'none', color: '#D4A853', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            View all
          </button>
        </div>
        {isLoading ? (
          <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={52} borderRadius={10} />
            ))}
          </div>
        ) : mappedFriends.length === 0 ? (
          <div style={{ padding: '8px 20px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4A4845' }}>Split expenses with friends 1-on-1</p>
            <button
              type="button"
              onClick={() => navigate('/friends')}
              style={{
                background: 'transparent',
                color: '#EDEAE4',
                border: '1px solid #252530',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Add a friend
            </button>
          </div>
        ) : (
          mappedFriends.map((f, i) => (
            <div
              key={f._id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/friends?friend=${f._id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/friends?friend=${f._id}`)}
              style={{ ...listRow, borderBottom: i < mappedFriends.length - 1 ? listRow.borderBottom : 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1F'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#222228', border: '1px solid #252530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#D4A853', flexShrink: 0 }}>
                {f.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: 12, color: '#4A4845' }}>{f.amount !== 0 ? 'Balance pending' : 'Settled'}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: f.amount < 0 ? '#D95555' : f.amount > 0 ? '#45C285' : '#8A8680' }}>
                {formatAmount(f.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Quick actions */}
      <div data-tour="quick-actions" style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Quick actions
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate('/groups/new')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 12px',
              borderRadius: 12,
              border: 'none',
              background: '#D4A853',
              color: '#1A0800',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Plus size={16} />
            New group
          </button>
          <button
            type="button"
            onClick={() => navigate('/friends')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 12px',
              borderRadius: 12,
              border: '1px solid #252530',
              background: 'transparent',
              color: '#EDEAE4',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <UserPlus size={16} />
            Add friend
          </button>
        </div>
      </div>

      {/* Link to analytics */}
      <button
        type="button"
        onClick={() => navigate('/analytics')}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 20px',
          borderRadius: 16,
          border: '1px solid #252530',
          background: '#131316',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={20} color="#D4A853" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#EDEAE4' }}>Spending insights</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8A8680' }}>Trends, categories & balance map</p>
        </div>
        <ArrowRight size={18} color="#4A4845" />
      </button>
    </div>
  );
}
