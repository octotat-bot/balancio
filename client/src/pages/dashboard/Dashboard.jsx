import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

// ─── Skeletons ───────────────────────────────────────────────────────────────
const Skeleton = ({ width, height, borderRadius = 8, style = {} }) => (
  <motion.div
    initial={{ opacity: 0.5 }}
    animate={{ opacity: 1 }}
    transition={{ repeat: Infinity, duration: 1, repeatType: "mirror" }}
    style={{
      width, height, borderRadius,
      background: "linear-gradient(90deg, #1A1A1F 0%, #252530 50%, #1A1A1F 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 2s infinite linear",
      ...style
    }}
  />
);

// ─── Donut chart (Animated) ──────────────────────────────────────────────────
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
        const finalOffset = -offset;
        
        const el = (
          <motion.circle
            key={i}
            cx="60" cy="60" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={18}
            strokeDasharray={`${dash.toFixed(1)} ${gap.toFixed(1)}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: finalOffset }}
            transition={{ duration: 1 + i * 0.2, ease: "easeOut" }}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ─── Bar chart (Animated) ────────────────────────────────────────────────────
function BarChart({ data, labels, highlightIndex }) {
  const max = Math.max(...data, 80);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 120 }}>
        {data.map((v, i) => {
          const targetH = Math.max(3, Math.round((v / max) * 110));
          const isHi = i === highlightIndex;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <motion.div
                initial={{ height: 3 }}
                animate={{ height: targetH }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                style={{
                  width: "100%",
                  borderRadius: "3px 3px 0 0",
                  background: isHi ? "#D4A853" : "#222228",
                  cursor: "pointer",
                }}
                title={`₹${v}`}
                whileHover={{ scaleY: 1.05, background: isHi ? "#F0C878" : "#8A6520", originY: 1 }}
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

// ─── Universe Mode (Physics Simulation) ────────────────────────────────────────
function BalanceUniverse({ friends, user }) {
  const r = 160; 

  return (
    <motion.div 
       initial={{ opacity: 0, scale: 0.95 }} 
       animate={{ opacity: 1, scale: 1 }} 
       exit={{ opacity: 0 }} 
       style={{ position: 'relative', width: '100%', height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gridColumn: '1 / -1' }}
    >
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 6, repeat: Infinity }} style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.15) 0%, transparent 70%)', filter: 'blur(40px)', zIndex: 1 }} />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
        {friends.filter(f => f.amount !== 0).map((f, i, arr) => {
          const angle = (i / arr.length) * Math.PI * 2;
          const x2 = `calc(50% + ${Math.cos(angle) * r}px)`;
          const y2 = `calc(50% + ${Math.sin(angle) * r}px)`;
          const color = f.amount > 0 ? "#45C285" : "#D95555";
          
          return (
            <motion.line 
              key={f._id}
              x1="50%" y1="50%" 
              x2={x2} y2={y2} 
              stroke={color} 
              strokeWidth={Math.max(2, Math.min(Math.abs(f.amount) / 100, 8))}
              opacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.1 }}
            />
          );
        })}
      </svg>

      <div style={{ position: 'relative', zIndex: 3, width: '100%', height: '100%' }}>
        {/* User Node */}
        <motion.div 
          style={{ position: 'absolute', top: '50%', left: '50%', x: '-50%', y: '-50%', width: 80, height: 80, borderRadius: '50%', background: '#D4A853', boxShadow: '0 0 40px rgba(212,168,83,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F0C878', cursor: 'grab' }}
          drag 
          dragConstraints={{ top: -50, left: -50, right: 50, bottom: 50 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
           {user?.avatar ? <img src={user.avatar} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} draggable="false" alt="avatar" /> : <span style={{ color: '#1A0800', fontWeight: 800, fontSize: 24, userSelect:'none' }}>{user?.name?.[0]?.toUpperCase()}</span>}
        </motion.div>
        
        {/* Friend Nodes */}
        {friends.filter(f => f.amount !== 0).map((f, i, arr) => {
          const angle = (i / arr.length) * Math.PI * 2;
          const color = f.amount > 0 ? "#45C285" : "#D95555";
          const nodeRadius = Math.max(60, Math.min(60 + Math.abs(f.amount)/100, 110));
          
          const targetX = `calc(50% + ${Math.cos(angle) * r}px)`;
          const targetY = `calc(50% + ${Math.sin(angle) * r}px)`;

          return (
            <motion.div
               key={f._id}
               drag
               dragConstraints={{ top: -40, left: -40, right: 40, bottom: 40 }}
               dragElastic={0.2}
               whileHover={{ scale: 1.1, zIndex: 10 }}
               whileTap={{ scale: 0.9 }}
               initial={{ top: '50%', left: '50%', x: '-50%', opacity: 0, y: '-50%' }}
               animate={{ 
                 top: targetY, 
                 left: targetX,
                 opacity: 1,
                 y: ['-50%', `calc(-50% - ${Math.random() * 10}px)`, '-50%'],
               }}
               transition={{ 
                 top: { type: 'spring', stiffness: 50, damping: 10, delay: i * 0.1 },
                 left: { type: 'spring', stiffness: 50, damping: 10, delay: i * 0.1 },
                 opacity: { duration: 0.5, delay: i * 0.1 },
                 y: { duration: 3 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }
               }}
               style={{ 
                 position: 'absolute', 
                 width: nodeRadius, height: nodeRadius, borderRadius: '50%', 
                 background: '#1A1A1F', border: `3px solid ${color}`,
                 boxShadow: `0 0 20px ${color}40`,
                 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'grab',
                 userSelect: 'none'
               }}
            >
              <div style={{ width: nodeRadius*0.8, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: '#EDEAE4', fontWeight: 700, fontSize: nodeRadius/4.5 }}>{f.name.split(' ')[0]}</span>
              </div>
              <span style={{ color: color, fontWeight: 800, fontSize: nodeRadius/5.5, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{f.amount > 0 ? '+' : '−'}₹{Math.abs(f.amount)}</span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { groups, fetchGroups } = useGroupStore();
  const { friends, fetchFriends } = useFriendStore();
  
  const [activeDock, setActiveDock] = useState("Home");
  const [activeFilter, setActiveFilter] = useState("This year");
  const [viewMode, setViewMode] = useState("classic");
  const [time, setTime] = useState("");
  const [friendBalances, setFriendBalances] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const acceptedFriends = friends?.accepted || [];

  useEffect(() => {
    Promise.all([fetchGroups(), fetchFriends()]).then(() => {
      // Small delay for skeleton showcase
      setTimeout(() => setIsLoading(false), 500); 
    });
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

  const mappedGroups = (groups || []).slice(0, 4).map(g => ({
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
      background: "rgba(19, 19, 22, 0.75)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(37, 37, 48, 0.5)",
      position: "sticky", top: 0, zIndex: 50,
    },
    logoWrap: { display: "flex", alignItems: "center", gap: 10 },
    logoMark: {
      width: 32, height: 32, borderRadius: 8, background: "#D4A853",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 14px rgba(212, 168, 83, 0.2)",
    },
    logoName: { fontSize: 16, fontWeight: 800, letterSpacing: "0.02em" },
    topRight: { display: "flex", alignItems: "center", gap: 10 },
    timeText: { fontSize: 11, color: "#4A4845", fontFamily: "'JetBrains Mono', monospace" },
    avatarCircle: {
      width: 32, height: 32, borderRadius: "50%",
      background: "#5C3A10", border: "1.5px solid #8A6520",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#F0C878", cursor: "pointer",
      overflow: "hidden"
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
      boxShadow: netBalance >= 0 ? "0 4px 12px rgba(69, 194, 133, 0.3)" : "0 4px 12px rgba(217, 85, 85, 0.3)"
    },
    statCard: {
      padding: "24px 28px", display: "flex", flexDirection: "column",
      justifyContent: "center", borderRight: "1px solid #252530",
      position: "relative",
    },
    statIcon: {
      width: 28, height: 28, borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
    },
    statLabel: {
      fontSize: 10, color: "#4A4845", textTransform: "uppercase",
      letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8,
    },
    statVal: { fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", position: "relative", zIndex: 2 },
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
      padding: "12px 14px", borderBottom: "1px solid rgba(37,37,48,0.4)",
      cursor: "pointer",
      borderRadius: "12px",
      margin: "0 -14px 4px",
      transition: "background 0.2s"
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
      background: "rgba(19, 19, 22, 0.8)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(37, 37, 48, 0.5)",
      position: "sticky", bottom: 0, zIndex: 50,
    },
    fabInner: {
      display: "flex", alignItems: "center", gap: 6,
      background: "#1A1A1F", border: "1px solid #252530",
      borderRadius: 999, padding: "6px 8px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
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
      cursor: "pointer", border: "none", flexShrink: 0, transition: "transform 0.15s, box-shadow 0.15s",
      boxShadow: "0 4px 14px rgba(212, 168, 83, 0.3)",
    },
    fabLbl: {
      fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
      fontFamily: "'JetBrains Mono', monospace",
    },
  };

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
        /* Add glow to stat values */
        .glow-owed { text-shadow: 0 0 20px rgba(69, 194, 133, 0.3); }
        .glow-owes { text-shadow: 0 0 20px rgba(217, 85, 85, 0.3); }
      `}</style>

      <div style={s.root}>
        {/* ── Dynamic Aura Background ── */}
        <motion.div
           animate={{ opacity: [0.15, 0.25, 0.15], scale: [1, 1.05, 1] }}
           transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
           style={{
             position: 'fixed', inset: '-20%',
             background: `radial-gradient(circle at 50% 50%, ${netBalance >= 0 ? 'rgba(69, 194, 133, 0.15)' : 'rgba(217, 85, 85, 0.15)'} 0%, transparent 60%)`,
             zIndex: 0, pointerEvents: 'none', filter: 'blur(60px)'
           }}
        />

        <header style={s.topbar}>
          <div style={s.logoWrap}>
            <motion.div style={s.logoMark} whileHover={{ rotate: 10, scale: 1.05 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </motion.div>
            <span style={s.logoName}>Balancio</span>
          </div>
          <div style={s.topRight}>
            <span style={s.timeText}>{time}</span>
            <motion.div style={s.avatarCircle} onClick={() => navigate('/profile')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'M'
              )}
            </motion.div>
          </div>
        </header>

        <motion.section style={s.hero} variants={containerVariants} initial="hidden" animate="visible">
          <motion.div style={s.heroMain} variants={itemVariants}>
            <p style={s.heroGreeting}>{getGreeting()}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h1 style={{ ...s.heroName, margin: 0 }}>{user?.name?.split(' ')[0] || "User"}</h1>
                <div style={{ display: 'flex', background: '#1A1A1F', border: '1px solid #252530', borderRadius: 999, padding: 4, zIndex: 10 }}>
                   <button onClick={() => setViewMode('classic')} style={{ padding: '6px 12px', borderRadius: 999, background: viewMode === 'classic' ? '#3B3B46' : 'transparent', color: viewMode === 'classic' ? '#EDEAE4' : '#8A8680', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif", transition: 'all 0.2s' }}>Classic</button>
                   <button onClick={() => setViewMode('universe')} style={{ padding: '6px 12px', borderRadius: 999, background: viewMode === 'universe' ? '#3B3B46' : 'transparent', color: viewMode === 'universe' ? '#EDEAE4' : '#8A8680', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif", transition: 'all 0.2s' }}>Universe</button>
                </div>
            </div>
            <div style={s.heroBadgeRow}>
              <span style={s.heroBal}>Net balance</span>
              {isLoading ? <Skeleton width={60} height={20} /> : (
                <>
                  <span style={s.heroBalNum}>{netBalance < 0 ? "−" : ""}₹{Math.abs(netBalance).toFixed(2)}</span>
                  <span style={s.heroBadge}>{netBalance >= 0 ? "You are owed" : "You owe"}</span>
                </>
              )}
            </div>
          </motion.div>

          <motion.div style={s.statCard} variants={itemVariants}>
            <div style={{ ...s.statIcon, background: "#1A3025" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#45C285" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <p style={s.statLabel}>You are owed</p>
            {isLoading ? <Skeleton width={120} height={40} /> : (
              <p className="glow-owed" style={{ ...s.statVal, color: "#45C285" }}>₹{totals.owed.toFixed(2)}</p>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '50px', background: 'radial-gradient(ellipse at bottom, rgba(69,194,133,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          </motion.div>

          <motion.div style={{ ...s.statCard, borderRight: "none" }} variants={itemVariants}>
            <div style={{ ...s.statIcon, background: "#2A1515" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D95555" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            </div>
            <p style={s.statLabel}>You owe</p>
            {isLoading ? <Skeleton width={120} height={40} /> : (
              <p className="glow-owes" style={{ ...s.statVal, color: "#D95555" }}>₹{totals.owes.toFixed(2)}</p>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '50px', background: 'radial-gradient(ellipse at bottom, rgba(217,85,85,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          </motion.div>
        </motion.section>

        <AnimatePresence mode="wait">
        {viewMode === 'universe' ? (
           <motion.div key="universe" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
             <BalanceUniverse friends={mappedFriends} user={user} />
           </motion.div>
        ) : (
        <motion.div key="classic" style={s.body} variants={containerVariants} initial="hidden" animate="visible" exit="hidden">
          <motion.div style={s.left} variants={itemVariants}>
            <div style={s.section}>
              <div style={s.secHeader}>
                <span style={s.secTitle}>Spending trend</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["This year", "6 mo", "3 mo"].map(f => (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={f} onClick={() => setActiveFilter(f)} style={{
                      fontSize: 11, padding: "4px 12px", borderRadius: 999,
                      border: "1px solid #252530", fontFamily: "'Syne', sans-serif",
                      background: activeFilter === f ? "#222228" : "transparent",
                      color: activeFilter === f ? "#EDEAE4" : "#4A4845",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      {f}
                    </motion.button>
                  ))}
                </div>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
                  {[...Array(12)].map((_, i) => <Skeleton key={i} width="100%" height={Math.random() * 80 + 20} style={{ flex: 1, borderRadius: '3px 3px 0 0' }} />)}
                </div>
              ) : (
                <BarChart data={spendData} labels={months} highlightIndex={4} />
              )}
            </div>

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
                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...Array(3)].map((_, i) => <Skeleton key={i} width="100%" height={50} />)}
                  </div>
                ) : mappedGroups.length === 0 ? (
                  <div style={s.emptyBox}>
                     <p style={{ fontSize: 12, color: "#4A4845", marginBottom: 12 }}>No groups yet</p>
                  </div>
                ) : (
                  mappedGroups.map((g, i) => (
                    <motion.div key={i} whileHover={{ backgroundColor: '#1A1A1F', x: 4 }} drag="x" dragConstraints={{ left: 0, right: 0 }} onClick={() => navigate(`/groups/${g._id}`)} style={{ ...s.listRow, borderBottom: i < mappedGroups.length - 1 ? "1px solid rgba(37,37,48,0.4)" : "none" }}>
                      <div style={s.lav}>{g.name[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "#4A4845" }}>{g.members} member{g.members !== 1 ? "s" : ""}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: g.amount < 0 ? "#D95555" : "#45C285" }}>
                        {g.amount < 0 ? "−" : "+"}₹{Math.abs(g.amount).toFixed(2)}
                      </span>
                    </motion.div>
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
                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...Array(3)].map((_, i) => <Skeleton key={i} width="100%" height={50} />)}
                  </div>
                ) : mappedFriends.length === 0 ? (
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
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/friends')} style={{
                      background: "#D4A853", color: "#1A0800", border: "none",
                      borderRadius: 8, padding: "9px 18px", fontSize: 12,
                      fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(212, 168, 83, 0.3)",
                    }}>
                      Add Friend
                    </motion.button>
                  </div>
                ) : (
                  mappedFriends.map((f, i) => (
                    <motion.div key={i} whileHover={{ backgroundColor: '#1A1A1F', x: 4 }} drag="x" dragConstraints={{ left: -60, right: 0 }} onClick={() => navigate('/friends')} style={{ ...s.listRow, position: 'relative', overflow: 'hidden', borderBottom: i < mappedFriends.length - 1 ? "1px solid rgba(37,37,48,0.4)" : "none" }}>
                      <div style={s.lav}>{f.name[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: "#4A4845" }}>{f.amount !== 0 ? "Settlement pending" : "Settled"}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: f.amount < 0 ? "#D95555" : (f.amount > 0 ? "#45C285" : "#8A8680") }}>
                        {f.amount < 0 ? "−" : (f.amount > 0 ? "+" : "")}₹{Math.abs(f.amount).toFixed(2)}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          <motion.div style={s.right} variants={itemVariants}>
            <div style={s.catBody}>
              <div style={{ ...s.secHeader, marginBottom: 16 }}>
                <span style={s.secTitle}>Categories</span>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  <Skeleton width={120} height={120} borderRadius="50%" />
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...Array(3)].map((_, i) => <Skeleton key={i} width="100%" height={20} />)}
                  </div>
                </div>
              ) : categories.length > 0 ? (
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
                          <motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }} style={{ height: 4, borderRadius: 2, background: c.color }} />
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

            <div style={s.qaSec}>
              <div style={{ ...s.secHeader, marginBottom: 12 }}>
                <span style={s.secTitle}>Quick actions</span>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/groups/new')} style={{ ...s.qaBtn, background: "#D4A853", borderColor: "#D4A853", color: "#1A0800", fontWeight: 700, boxShadow: "0 4px 14px rgba(212, 168, 83, 0.2)" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F0C878"}
                onMouseLeave={e => e.currentTarget.style.background = "#D4A853"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Group
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/friends')} style={s.qaBtn}
                onMouseEnter={e => { e.currentTarget.style.background = "#1A1A1F"; e.currentTarget.style.borderColor = "#2A2A32"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#252530"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
                Add Friend
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
        )}
        </AnimatePresence>

        <footer style={s.fabBar}>
          <div style={s.fabInner}>
            {dockItems.slice(0, 2).map(item => {
              const isOn = activeDock === item.label;
              return (
                <motion.a key={item.label}
                  whileTap={{ scale: 0.9 }}
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
                </motion.a>
              );
            })}

            <div style={s.fabSep} />

            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }} 
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/groups/new')} style={s.fabAdd}
              onMouseEnter={e => e.currentTarget.style.background = "#F0C878"}
              onMouseLeave={e => e.currentTarget.style.background = "#D4A853"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </motion.button>

            <div style={s.fabSep} />

            {dockItems.slice(2).map(item => {
              const isOn = activeDock === item.label;
              return (
                <motion.a key={item.label}
                  whileTap={{ scale: 0.9 }}
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
                </motion.a>
              );
            })}
          </div>
        </footer>
      </div>
    </>
  );
}
