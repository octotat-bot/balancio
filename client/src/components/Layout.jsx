import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';

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
};

const GridIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export function Layout() {
    const { user } = useAuthStore();
    const { connect, joinUserRoom, disconnect } = useChatStore();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Derived state for bottom dock
    const activeDock = location.pathname.includes('/groups') ? 'Groups' :
                       location.pathname.includes('/friends') ? 'Friends' :
                       location.pathname.includes('/settlements') ? 'Settle' :
                       location.pathname.includes('/profile') ? 'Profile' : 'Home';

    const [time, setTime] = useState("");

    useEffect(() => {
        if (user?._id) {
            connect();
            joinUserRoom(user._id);
        }
        return () => disconnect();
    }, [user?._id, connect, joinUserRoom, disconnect]);

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

    const dockItems = [
        { label: "Home",    href: "/dashboard", icon: <GridIcon size={16} color="currentColor" /> },
        { label: "Groups",  href: "/groups",    icon: <Icon {...icons.groups}  size={16} /> },
        { label: "Friends", href: "/friends",   icon: <Icon {...icons.friends} size={16} /> },
        { label: "Settle",  href: "/settlements", icon: <Icon {...icons.settle}  size={16} /> },
        { label: "Profile", href: "/profile",   icon: <Icon {...icons.profile} size={16} /> },
    ];

    const s = {
        root: {
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: '#0C0C0F',
            color: '#EDEAE4',
            fontFamily: "'Syne', sans-serif"
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
        main: {
            flex: 1,
            padding: "24px",
            paddingBottom: "100px", /* space for dock */
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
        },
        fabBar: {
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "14px 0 18px",
            background: "#131316", borderTop: "1px solid #252530",
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
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

    return (
        <div style={s.root}>
            <header style={s.topbar}>
                <div onClick={() => navigate('/dashboard')} style={{...s.logoWrap, cursor: 'pointer'}}>
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
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            user?.name?.[0]?.toUpperCase() || 'M'
                        )}
                    </div>
                </div>
            </header>

            <main style={s.main}>
                <Outlet />
            </main>

            <footer style={s.fabBar}>
                <div style={s.fabInner}>
                    {dockItems.slice(0, 2).map((item) => {
                        const isOn = activeDock === item.label;
                        return (
                            <a key={item.label}
                                href={item.href}
                                onClick={(e) => { e.preventDefault(); navigate(item.href); }}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = "#F0C878"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#D4A853"}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>

                    <div style={s.fabSep} />

                    {dockItems.slice(2).map((item) => {
                        const isOn = activeDock === item.label;
                        return (
                            <a key={item.label}
                                href={item.href}
                                onClick={(e) => { e.preventDefault(); navigate(item.href); }}
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
    );
}

export default Layout;
