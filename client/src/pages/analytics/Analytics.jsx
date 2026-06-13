import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, PieChart, Orbit } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import api from '../../services/api';
import { BarChart, DonutChart, BalanceUniverse, Skeleton } from '../../components/analytics/AnalyticsCharts';

const PERIOD_OPTIONS = ['This year', '6 mo', '3 mo'];
const PERIOD_MAP = { 'This year': 'year', '6 mo': '6mo', '3 mo': '3mo' };
const CATEGORY_COLORS = ['#D4A853', '#D95555', '#45C285', '#3b82f6', '#8b5cf6'];

const card = {
  background: '#131316',
  border: '1px solid #252530',
  borderRadius: 16,
  padding: '22px 24px',
  marginBottom: 16,
};

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { friends, fetchFriends } = useFriendStore();
  const [activeFilter, setActiveFilter] = useState('This year');
  const [activeTab, setActiveTab] = useState('spending');
  const [analytics, setAnalytics] = useState(null);
  const [friendBalances, setFriendBalances] = useState({});
  const [loading, setLoading] = useState(true);

  const periodParam = PERIOD_MAP[activeFilter] || 'year';
  const acceptedFriends = friends?.accepted || [];

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsRes, balancesRes] = await Promise.all([
          api.get(`/users/analytics?period=${periodParam}`),
          acceptedFriends.length ? api.get('/friends/balances') : Promise.resolve({ data: { balances: {} } }),
        ]);
        setAnalytics(analyticsRes.data);
        setFriendBalances(balancesRes.data.balances || {});
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodParam, acceptedFriends.length]);

  const spendData = analytics?.history?.map((item) => item.amount) || [];
  const monthLabels =
    analytics?.history?.map((item) => item.month.split(' ')[0]) ||
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const categoryTotal = analytics?.totalSpend || 0;
  const categories = (analytics?.categories || []).slice(0, 5).map((c, i) => ({
    name: c.name,
    pct: categoryTotal ? Math.round((c.value / categoryTotal) * 100) : 0,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const mappedFriends = acceptedFriends.map((f) => {
    const bal = friendBalances[f._id] || 0;
    const isRequester = f.requester?._id === user?._id || f.requester === user?._id;
    const friendName = isRequester ? f.recipient?.name || f.recipientName : f.requester?.name;
    return { _id: f._id, name: friendName || 'Friend', amount: bal };
  });

  const tabs = [
    { id: 'spending', label: 'Spending', icon: TrendingUp },
    { id: 'categories', label: 'Categories', icon: PieChart },
    { id: 'map', label: 'Balance map', icon: Orbit },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: "'Syne', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
          style={{
            background: '#1A1A1F',
            border: '1px solid #252530',
            borderRadius: 10,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#EDEAE4',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Insights</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8A8680' }}>Spending trends and category breakdown</p>
        </div>
      </div>

      {!loading && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total spent', value: `₹${(analytics.totalSpend || 0).toFixed(0)}`, color: '#D4A853' },
            { label: 'Expenses', value: analytics.totalExpenses || 0, color: '#EDEAE4' },
            { label: 'Categories', value: analytics.categories?.length || 0, color: '#45C285' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...card, marginBottom: 0, padding: '16px 18px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#4A4845', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {stat.label}
              </p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 20,
          background: '#1A1A1F',
          border: '1px solid #252530',
          borderRadius: 12,
          padding: 4,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: active ? '#2A2A32' : 'transparent',
                color: active ? '#D4A853' : '#8A8680',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'spending' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Spending trend
            </h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIOD_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: '1px solid #252530',
                    background: activeFilter === f ? '#222228' : 'transparent',
                    color: activeFilter === f ? '#EDEAE4' : '#4A4845',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} width="100%" height={40 + i * 8} style={{ flex: 1, borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
          ) : (
            <BarChart data={spendData.length ? spendData : [0]} labels={monthLabels} highlightIndex={Math.max(0, spendData.length - 1)} />
          )}
        </motion.div>
      )}

      {activeTab === 'categories' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={card}>
          <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            By category
          </h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <Skeleton width={120} height={120} borderRadius="50%" />
            </div>
          ) : categories.length > 0 ? (
            <>
              <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 24px' }}>
                <DonutChart segments={categories} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: 'block' }}>
                    {analytics?.categories?.length || 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#4A4845' }}>types</span>
                </div>
              </div>
              {categories.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, color: '#EDEAE4' }}>{c.name}</span>
                  <div style={{ flex: 2, height: 4, background: '#222228', borderRadius: 2 }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                      style={{ height: 4, borderRadius: 2, background: c.color }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", minWidth: 32, textAlign: 'right', color: '#8A8680' }}>
                    {c.pct}%
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#4A4845', fontSize: 14, margin: '32px 0' }}>
              Add some expenses to see category breakdown
            </p>
          )}
        </motion.div>
      )}

      {activeTab === 'map' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p style={{ fontSize: 13, color: '#8A8680', marginBottom: 12 }}>
            See who owes you and who you owe at a glance.
          </p>
          {loading ? (
            <Skeleton width="100%" height={480} borderRadius={16} />
          ) : mappedFriends.some((f) => f.amount !== 0) ? (
            <BalanceUniverse friends={mappedFriends} user={user} />
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ margin: 0, color: '#4A4845', fontSize: 14 }}>All settled up — nothing to map!</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
