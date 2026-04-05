import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useGroupStore } from "../../stores/groupStore";
import { useFriendStore } from "../../stores/friendStore";
import api from "../../services/api";

// ─── tiny SVG icon helpers ───────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = "currentColor", strokeWidth = 2, fill = "none", extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={extra || d} />
    {extra && <path d={d} />}
  </svg>
);

const icons = {
  logo:       { d: "M12 2L2 7l10 5 10-5-10-5z", extra: "M2 17l10 5 10-5 M2 12l10 5 10-5" },
  grid:       null,
  groups:     { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", extra: "M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  friends:    { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", extra: "M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0" },
  settle:     { d: "M3 10h18M3 14h18", extra: "M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" },
  profile:    { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" },
  plus:       { d: "M12 5v14M5 12h14" },
  addFriend:  { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", extra: "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8v6 M16 11h6" },
  trendUp:    { d: "M23 6L13.5 15.5 8.5 10.5 1 18", extra: "M17 6h6v6" },
  trendDown:  { d: "M23 18L13.5 8.5 8.5 13.5 1 6", extra: "M17 18h6v-6" },
  logout:     { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", extra: "M16 17l5-5-5-5 M21 12H9" },
};

const GridIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

// ─── Donut chart ─────────────────────────────────────────────────────────────
function DonutChart({ segments }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1A1A1F" strokeWidth={18} />
      {segments.map((seg, i) => {
        const dash = (Math.max(seg.pct, 0.1) / 100) * circ;
        const gap  = circ - dash;
        const el = (
          <circle
            key={i}
            cx="60" cy="60" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={18}
            strokeDasharray={`${dash.toFixed(1)} ${gap.toFixed(1)}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ─── Bar chart ───────────────────────────────────────────────────────────────
function BarChart({ data, labels, highlightIndex }) {
  const max = Math.max(...data, 80);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 120 }}>
        {data.map((v, i) => {
          const h = Math.max(3, Math.round((v / max) * 110));
          const isHi = i === highlightIndex;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "100%", height: h,
                borderRadius: "3px 3px 0 0",
                background: isHi ? "#D4A853" : "#222228",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
                title={`₹${v}`}
                onMouseEnter={e => { if (!isHi) e.currentTarget.style.background = "#8A6520"; }}
                onMouseLeave={e => { if (!isHi) e.currentTarget.style.background = "#222228"; }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, overflowX: "hidden" }}>
        {labels.map((l, i) => (
          <span key={i} style={{
            flex: 1, textAlign: "center",
            fontSize: 10, color: "#4A4845",
            fontFamily: "'JetBrains Mono', monospace",
            overflow: "hidden", textOverflow: "ellipsis"
          }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { groups = [], fetchGroups } = useGroupStore();
  const { friends, fetchFriends } = useFriendStore();
  
  const [activeDock, setActiveDock] = useState("Home");
  const [activeFilter, setActiveFilter] = useState("This year");
  const [time, setTime] = useState("");
  const [friendBalances, setFriendBalances] = useState({});
  const [analytics, setAnalytics] = useState(null);

  const acceptedFriends = friends?.accepted || [];

  useEffect(() => {
    fetchGroups();
    fetchFriends();
  }, [fetchGroups, fetchFriends]);

  useEffect(() => {
    const fetchAllFriendBalances = async () => {
      const balances = {};
      for (const friend of acceptedFriends) {
        try {
          const response = await api.get(`/friends/${friend._id}/direct-balance`);
          balances[friend._id] = response.data.balance || 0;
        } catch (error) {
          balances[friend._id] = 0;
        }
      }
      setFriendBalances(balances);
    };
    if (acceptedFriends.length > 0) fetchAllFriendBalances();
  }, [acceptedFriends]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/users/analytics');
        setAnalytics(res.data);
      } catch (error) {
        console.error("Error loading analytics");
      }
    };
    const timeout = setTimeout(fetchAnalytics, 500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const fmt = () => {
      const n = new Date();
      let h = n.getHours(), m = n.getMinutes();
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setTime(`${h}:${m < 10 ? "0" + m : m} ${ap}`);
    };
    fmt();
    const id = setInterval(fmt, 30000);
    return () => clearInterval(id);
  }, []);

  // Compute Totals
  const groupTotals = (groups || []).reduce((acc, g) => {
    const b = g.userBalance || 0;
    if (b > 0) acc.owed += b; else acc.owes += Math.abs(b);
    return acc;
  }, { owed: 0, owes: 0 });

  const friendTotals = Object.values(friendBalances).reduce((acc, b) => {
    if (b > 0) acc.owed += b; else acc.owes += Math.abs(b);
    return acc;
  }, { owed: 0, owes: 0 });

  const totals = { owed: groupTotals.owed + friendTotals.owed, owes: groupTotals.owes + friendTotals.owes };
  const netBalance = totals.owed - totals.owes;

  // Compute Analytics Data for charts
  const spendData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  
  if (analytics?.history) {
    analytics.history.forEach((item, i) => {
      if(i < 12) spendData[i] = item.amount;
    });
  }

  const categoryColors = ["#D4A853", "#D95555", "#45C285", "#3b82f6", "#8b5cf6"];
  const categories = (analytics?.categories || []).slice(0, 3).map((c, i) => ({
    name: c.name,
    pct: analytics.total ? Math.round((c.value / analytics.total) * 100) : 0,
    color: categoryColors[i % categoryColors.length]
  }));

  const mappedGroups = groups.slice(0, 4).map(g => ({
    _id: g._id,
    name: g.name || "Group",
    members: g.members?.length || 1,
    amount: g.userBalance || 0
  }));

  const mappedFriends = acceptedFriends.slice(0, 4).map(f => {
    const bal = friendBalances[f._id] || 0;
    const isRequester = f.requester?._id === user?._id || f.requester === user?._id;
    let friendName = isRequester ? (f.recipient?.name || f.recipientName) : (f.requester?.name);
    return {
      _id: f._id,
      name: friendName || "Friend",
      amount: bal
    };
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const dockItems = [
    { label: "Home",    href: "/dashboard", icon: <GridIcon size={16} color="currentColor" /> },
    { label: "Groups",  href: "/groups",    icon: <Icon {...icons.groups}  size={16} /> },
    { label: "Friends", href: "/friends",   icon: <Icon {...icons.friends} size={16} /> },
    { label: "Settle",  href: "/settlements", icon: <Icon {...icons.settle}  size={16} /> },
    { label: "Profile", href: "/profile",   icon: <Icon {...icons.profile} size={16} /> },
  ];

  // ── styles ──────────────────────────────────────────────────────────────────
  const s = {
    root: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      overflowY: 'auto',
      fontFamily: "'Syne', sans-serif",
      background: "#0C0C0F",
      color: "#EDEAE4",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    },
    topbar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px",
      background: "#131316",
      borderBottom: "1px solid #252530",
      position: "sticky", top: 0, zIndex: 50,
    },
    logoWrap: { display: "flex", alignItems: "center", gap: 10 },
    logoMark: {
      width: 32, height: 32, borderRadius: 8, background: "#D4A853",
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    logoName: { fontSize: 16, fontWeight: 800, letterSpacing: "0.02em" },
    topRight: { display: "flex", alignItems: "center", gap: 10 },
    timeText: { fontSize: 11, color: "#4A4845", fontFamily: "'JetBrains Mono', monospace" },
    avatarCircle: {
      width: 32, height: 32, borderRadius: "50%",
      background: "#5C3A10", border: "1.5px solid #8A6520",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#F0C878", cursor: "pointer",
    },
    hero: {
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderBottom: "1px solid #252530",
    },
    heroMain: { padding: "28px 32px", borderRight: "1px solid #252530" },
    heroGreeting: {
      fontSize: 11, color: "#4A4845", letterSpacing: "0.1em",
      textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace",
      marginBottom: 6,
    },
    heroName: { fontSize: 42, fontWeight: 800, lineHeight: 1, marginBottom: 10 },
    heroBadgeRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    heroBal: { fontSize: 14, color: "#8A8680" },
    heroBalNum: { fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: netBalance >= 0 ? "#45C285" : "#D95555" },
    heroBadge: {
      fontSize: 10, fontWeight: 700, background: netBalance >= 0 ? "#45C285" : "#D95555", color: "#fff",
      padding: "3px 10px", borderRadius: 999, letterSpacing: "0.06em", textTransform: "uppercase",
    },
    statCard: {
      padding: "24px 28px", display: "flex", flexDirection: "column",
      justifyContent: "center", borderRight: "1px solid #252530",
    },
    statIcon: {
      width: 28, height: 28, borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
    },
    statLabel: {
      fontSize: 10, color: "#4A4845", textTransform: "uppercase",
      letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8,
    },
    statVal: { fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
    body: {
      display: "grid", gridTemplateColumns: "1fr 300px",
      flex: 1,
    },
    left: { borderRight: "1px solid #252530", display: "flex", flexDirection: "column" },
    right: { display: "flex", flexDirection: "column" },
    section: { padding: "22px 26px", borderBottom: "1px solid #252530" },
    secHeader: {
      display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
    },
    secTitle: {
      fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "#8A8680",
      display: "flex", alignItems: "center", gap: 6,
    },
    viewAll: { fontSize: 11, color: "#D4A853", cursor: "pointer", fontWeight: 500 },
    twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1 },
    halfSec: { padding: "20px 22px" },
    listRow: {
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 0", borderBottom: "1px solid #252530",
      cursor: "pointer"
    },
    lav: {
      width: 34, height: 34, borderRadius: 10, background: "#222228",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#D4A853",
      border: "1px solid #252530", flexShrink: 0,
    },
    catBody: { padding: "22px 22px 18px", borderBottom: "1px solid #252530", flex: 1 },
    donutWrap: { position: "relative", width: 120, height: 120, margin: "0 auto 18px" },
    donutCenter: {
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)", textAlign: "center",
    },
    catRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
    catDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
    catBarBg: { flex: 2, height: 4, background: "#222228", borderRadius: 2 },
    qaSec: { padding: "18px 22px" },
    qaBtn: {
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px", borderRadius: 12,
      border: "1px solid #252530", background: "transparent",
      color: "#EDEAE4", fontSize: 13, fontWeight: 500,
      fontFamily: "'Syne', sans-serif", cursor: "pointer",
      width: "100%", marginBottom: 8, transition: "all 0.15s",
    },
    emptyBox: { textAlign: "center", padding: "20px 0", borderBottom: "none" },
    fabBar: {
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "14px 0 18px",
      background: "#131316", borderTop: "1px solid #252530",
      position: "sticky", bottom: 0, zIndex: 50,
    },
    fabInner: {
      display: "flex", alignItems: "center", gap: 6,
      background: "#1A1A1F", border: "1px solid #252530",
      borderRadius: 999, padding: "6px 8px",
    },
    fabItem: {
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      padding: "8px 22px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
      background: "transparent", border: "none", fontFamily: "'Syne', sans-serif",
    },
    fabSep: { width: 1, height: 32, background: "#252530" },
    fabAdd: {
      width: 46, height: 46, background: "#D4A853", borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", border: "none", flexShrink: 0, transition: "background 0.15s",
    },
    fabLbl: {
      fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
      fontFamily: "'JetBrains Mono', monospace",
    },
  };

  // Add media query hook for better responsiveness similar to original grid layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    s.hero.gridTemplateColumns = "1fr";
    s.hero.borderBottom = "none";
    s.heroMain.borderRight = "none";
    s.heroMain.borderBottom = "1px solid #252530";
    s.statCard.borderRight = "none";
    s.statCard.borderBottom = "1px solid #252530";
    s.body.gridTemplateColumns = "1fr";
    s.left.borderRight = "none";
    s.twoCol.gridTemplateColumns = "1fr";
    s.halfSec.borderRight = "none";
    s.halfSec.borderBottom = "1px solid #252530";
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #131316; }
        ::-webkit-scrollbar-thumb { background: #252530; border-radius: 2px; }
      `}</style>

      <div style={s.root}>
        {/* ── TOP BAR ── */}
        <header style={s.topbar}>
          <div style={s.logoWrap}>
            <div style={s.logoMark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span style={s.logoName}>Balancio</span>
          </div>
          <div style={s.topRight}>
            <span style={s.timeText}>{time}</span>
            <div style={s.avatarCircle} onClick={() => navigate('/profile')}>
              {user?.name?.[0]?.toUpperCase() || 'M'}
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section style={s.hero}>
          <div style={s.heroMain}>
            <p style={s.heroGreeting}>{getGreeting()}</p>
            <h1 style={s.heroName}>{user?.name?.split(' ')[0] || "User"}</h1>
            <div style={s.heroBadgeRow}>
              <span style={s.heroBal}>Net balance</span>
              <span style={s.heroBalNum}>{netBalance < 0 ? "−" : ""}₹{Math.abs(netBalance).toFixed(2)}</span>
              <span style={s.heroBadge}>{netBalance >= 0 ? "You are owed" : "You owe"}</span>
            </div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statIcon, background: "#1A3025" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#45C285" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <p style={s.statLabel}>You are owed</p>
            <p style={{ ...s.statVal, color: "#45C285" }}>₹{totals.owed.toFixed(2)}</p>
          </div>
          <div style={{ ...s.statCard, borderRight: "none" }}>
            <div style={{ ...s.statIcon, background: "#2A1515" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D95555" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            </div>
            <p style={s.statLabel}>You owe</p>
            <p style={{ ...s.statVal, color: "#D95555" }}>₹{totals.owes.toFixed(2)}</p>
          </div>
        </section>

        {/* ── BODY ── */}
        <div style={s.body}>
          <div style={s.left}>
            {/* Spending trend */}
            <div style={s.section}>
              <div style={s.secHeader}>
                <span style={s.secTitle}>Spending trend</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["This year", "6 mo", "3 mo"].map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)} style={{
                      fontSize: 11, padding: "4px 12px", borderRadius: 999,
                      border: "1px solid #252530", fontFamily: "'Syne', sans-serif",
                      background: activeFilter === f ? "#222228" : "transparent",
                      color: activeFilter === f ? "#EDEAE4" : "#4A4845",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <BarChart data={spendData} labels={months} highlightIndex={4} />
            </div>

            {/* Groups + Friends */}
            <div style={{ ...s.twoCol, borderTop: "1px solid #252530" }}>
              <div style={{ ...s.halfSec, borderRight: !isMobile ? "1px solid #252530" : "none" }}>
                <div style={s.secHeader}>
                  <span style={s.secTitle}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Groups
                  </span>
                  <span style={s.viewAll} onClick={() => navigate('/groups')}>View all</span>
                </div>
                {mappedGroups.length === 0 ? (
                  <div style={s.emptyBox}>
                     <p style={{ fontSize: 12, color: "#4A4845", marginBottom: 12 }}>No groups yet</p>
                  </div>
                ) : (
                  mappedGroups.map((g, i) => (
                    <div key={i} onClick={() => navigate(`/groups/${g._id}`)} style={{ ...s.listRow, borderBottom: i < mappedGroups.length - 1 ? "1px solid #252530" : "none" }}>
                      <div style={s.lav}>{g.name[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "#4A4845" }}>{g.members} member{g.members !== 1 ? "s" : ""}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: g.amount < 0 ? "#D95555" : "#45C285" }}>
                        {g.amount < 0 ? "−" : "+"}₹{Math.abs(g.amount).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div style={s.halfSec}>
                <div style={s.secHeader}>
                  <span style={s.secTitle}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    Friends
                  </span>
                  <span style={s.viewAll} onClick={() => navigate('/friends')}>View all</span>
                </div>
                {mappedFriends.length === 0 ? (
                  <div style={s.emptyBox}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", background: "#1A1A1F",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 10px",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4845" strokeWidth="2" strokeLinecap="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="16" y1="11" x2="22" y2="11" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 12, color: "#4A4845", marginBottom: 12 }}>No friends yet</p>
                    <button onClick={() => navigate('/friends')} style={{
                      background: "#D4A853", color: "#1A0800", border: "none",
                      borderRadius: 8, padding: "9px 18px", fontSize: 12,
                      fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer",
                    }}>
                      Add Friend
                    </button>
                  </div>
                ) : (
                  mappedFriends.map((f, i) => (
                    <div key={i} onClick={() => navigate('/friends')} style={{ ...s.listRow, borderBottom: i < mappedFriends.length - 1 ? "1px solid #252530" : "none" }}>
                      <div style={s.lav}>{f.name[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: "#4A4845" }}>{f.amount !== 0 ? "Settlement pending" : "Settled"}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: f.amount < 0 ? "#D95555" : (f.amount > 0 ? "#45C285" : "#8A8680") }}>
                        {f.amount < 0 ? "−" : (f.amount > 0 ? "+" : "")}₹{Math.abs(f.amount).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={s.right}>
            {/* Categories */}
            <div style={s.catBody}>
              <div style={{ ...s.secHeader, marginBottom: 16 }}>
                <span style={s.secTitle}>Categories</span>
              </div>
              {categories.length > 0 ? (
                <>
                  <div style={s.donutWrap}>
                    <DonutChart segments={categories} />
                    <div style={s.donutCenter}>
                      <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: "block", lineHeight: 1.1 }}>
                        {analytics?.categories?.length || 0}
                      </span>
                      <span style={{ fontSize: 10, color: "#4A4845" }}>categories</span>
                    </div>
                  </div>
                  <div>
                    {categories.map((c, i) => (
                      <div key={i} style={s.catRow}>
                        <div style={{ ...s.catDot, background: c.color }} />
                        <span style={{ flex: 1, fontSize: 13, color: "#8A8680" }}>{c.name}</span>
                        <div style={s.catBarBg}>
                          <div style={{ height: 4, borderRadius: 2, background: c.color, width: `${c.pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", minWidth: 28, textAlign: "right" }}>
                          {c.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={s.emptyBox}>
                   <p style={{ fontSize: 12, color: "#4A4845" }}>No spending data</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={s.qaSec}>
              <div style={{ ...s.secHeader, marginBottom: 12 }}>
                <span style={s.secTitle}>Quick actions</span>
              </div>
              <button onClick={() => navigate('/groups/new')} style={{ ...s.qaBtn, background: "#D4A853", borderColor: "#D4A853", color: "#1A0800", fontWeight: 700 }}
                onMouseEnter={e => e.currentTarget.style.background = "#F0C878"}
                onMouseLeave={e => e.currentTarget.style.background = "#D4A853"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Group
              </button>
              <button onClick={() => navigate('/friends')} style={s.qaBtn}
                onMouseEnter={e => { e.currentTarget.style.background = "#1A1A1F"; e.currentTarget.style.borderColor = "#2A2A32"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#252530"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
                Add Friend
              </button>
            </div>
          </div>
        </div>

        {/* ── BOTTOM DOCK ── */}
        <footer style={s.fabBar}>
          <div style={s.fabInner}>
            {dockItems.slice(0, 2).map(item => {
              const isOn = activeDock === item.label;
              return (
                <a key={item.label}
                  href={item.href}
                  onClick={e => { e.preventDefault(); setActiveDock(item.label); navigate(item.href); }}
                  style={{
                    ...s.fabItem,
                    textDecoration: "none",
                    background: isOn ? "#2A2A32" : "transparent",
                    color: isOn ? "#D4A853" : "#4A4845",
                  }}>
                  <span style={{ display: "flex", color: "inherit" }}>{item.icon}</span>
                  <span style={{ ...s.fabLbl, color: "inherit" }}>{item.label}</span>
                </a>
              );
            })}

            <div style={s.fabSep} />

            <button onClick={() => navigate('/groups/new')} style={s.fabAdd}
              onMouseEnter={e => e.currentTarget.style.background = "#F0C878"}
              onMouseLeave={e => e.currentTarget.style.background = "#D4A853"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <div style={s.fabSep} />

            {dockItems.slice(2).map(item => {
              const isOn = activeDock === item.label;
              return (
                <a key={item.label}
                  href={item.href}
                  onClick={e => { e.preventDefault(); setActiveDock(item.label); navigate(item.href); }}
                  style={{
                    ...s.fabItem,
                    textDecoration: "none",
                    background: isOn ? "#2A2A32" : "transparent",
                    color: isOn ? "#D4A853" : "#4A4845",
                  }}>
                  <span style={{ display: "flex", color: "inherit" }}>{item.icon}</span>
                  <span style={{ ...s.fabLbl, color: "inherit" }}>{item.label}</span>
                </a>
              );
            })}
          </div>
        </footer>
      </div>
    </>
  );
}
