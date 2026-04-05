import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    User,
    LogOut,
    Menu,
    X,
    Plus,
    Sparkles,
    Wallet,
    UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Avatar } from './ui/Avatar';
import { useChatStore } from '../stores/chatStore';

const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/groups', icon: Users, label: 'Groups' },
    { path: '/friends', icon: UserPlus, label: 'Friends' },
    { path: '/settlements', icon: Wallet, label: 'Settlements' },
    { path: '/profile', icon: User, label: 'Profile' },
];

const sidebarVariants = {
    hidden: { x: -280, opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 100, damping: 20 }
    },
};

const navItemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: (i) => ({
        x: 0,
        opacity: 1,
        transition: { delay: i * 0.1, duration: 0.3 }
    }),
};

const mobileMenuVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
};

const mobileSidebarVariants = {
    hidden: { x: '-100%' },
    visible: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit: { x: '-100%', transition: { duration: 0.2 } },
};

export function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const { connect, joinUserRoom, disconnect } = useChatStore();
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        if (user?._id) {
            connect();
            joinUserRoom(user._id);
        }
        return () => disconnect();
    }, [user?._id]);

    const handleLogout = () => {
        logout();
        navigate('/auth');
    };

    const NavItem = ({ item, index, onClick }) => {
        const isActive = location.pathname === item.path ||
            (item.path === '/groups' && location.pathname.startsWith('/groups'));

        return (
            <motion.div
                custom={index}
                variants={navItemVariants}
                initial="hidden"
                animate="visible"
            >
                <NavLink
                    to={item.path}
                    onClick={onClick}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? '#D4A853' : '#8A8680',
                        backgroundColor: isActive ? '#222228' : 'transparent',
                        transition: 'all 0.2s ease',
                        textDecoration: 'none',
                        fontFamily: "'Syne', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                        if (!isActive) { e.target.style.backgroundColor = '#1A1A1F'; e.target.style.color = '#EDEAE4'; }
                    }}
                    onMouseLeave={(e) => {
                        if (!isActive) { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#8A8680'; }
                    }}
                >
                    <item.icon style={{ width: '18px', height: '18px' }} />
                    {item.label}
                </NavLink>
            </motion.div>
        );
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0C0C0F', color: '#EDEAE4', fontFamily: "'Syne', sans-serif" }}>
            {/* Desktop Sidebar */}
            <motion.aside
                variants={sidebarVariants}
                initial="hidden"
                animate="visible"
                className="hidden lg:flex"
                style={{
                    width: '260px',
                    backgroundColor: '#131316',
                    borderRight: '1px solid #252530',
                    flexDirection: 'column',
                    padding: '24px 20px',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    zIndex: 40,
                }}
            >
                {/* Logo */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', padding: '0 8px' }}
                >
                    <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#D4A853',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.02em', color: '#EDEAE4' }}>Balancio</span>
                </motion.div>

                {/* Quick Action */}
                <motion.button
                    whileHover={{ backgroundColor: '#F0C878' }}
                    onClick={() => navigate('/groups/new')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px',
                        backgroundColor: '#D4A853',
                        color: '#1A0800',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '700',
                        border: 'none',
                        cursor: 'pointer',
                        marginBottom: '24px',
                        transition: 'background 0.2s',
                        fontFamily: "'Syne', sans-serif"
                    }}
                >
                    <Plus style={{ width: '16px', height: '16px' }} />
                    New Group
                </motion.button>

                {/* Navigation */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {navItems.map((item, index) => (
                        <NavItem key={item.path} item={item} index={index} />
                    ))}
                </nav>

                {/* User Section */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px',
                        backgroundColor: '#1A1A1F',
                        borderRadius: '12px',
                        border: '1px solid #252530'
                    }}
                >
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#5C3A10', border: '1.5px solid #8A6520',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: '700', color: '#F0C878'
                    }}>
                        {user?.name?.[0]?.toUpperCase() || 'M'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: '600', fontSize: '13px', color: '#EDEAE4', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {user?.name || 'User'}
                        </p>
                        <p style={{ fontSize: '11px', color: '#8A8680', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                            {user?.email}
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1, color: '#D95555' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleLogout}
                        style={{
                            padding: '8px', backgroundColor: 'transparent',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            color: '#8A8680', transition: 'color 0.2s'
                        }}
                    >
                        <LogOut style={{ width: '16px', height: '16px' }} />
                    </motion.button>
                </motion.div>
            </motion.aside>

            {/* Mobile Header */}
            <motion.header
                initial={{ y: -60 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100 }}
                className="lg:hidden"
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
                    backgroundColor: '#131316', borderBottom: '1px solid #252530',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 20px', zIndex: 50,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '30px', height: '30px', backgroundColor: '#D4A853',
                        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#EDEAE4' }}>Balancio</span>
                </div>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{ padding: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#EDEAE4' }}
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </motion.button>
            </motion.header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            variants={mobileMenuVariants} initial="hidden" animate="visible" exit="exit"
                            onClick={() => setIsMobileMenuOpen(false)}
                            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 45 }}
                            className="lg:hidden"
                        />
                        <motion.div
                            variants={mobileSidebarVariants} initial="hidden" animate="visible" exit="exit"
                            className="lg:hidden"
                            style={{
                                position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px',
                                backgroundColor: '#131316', zIndex: 50, padding: '24px 20px',
                                display: 'flex', flexDirection: 'column', borderRight: '1px solid #252530'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                                <div style={{
                                    width: '32px', height: '32px', backgroundColor: '#D4A853',
                                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A0800" strokeWidth="2.5" strokeLinecap="round">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                                    </svg>
                                </div>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#EDEAE4' }}>Balancio</span>
                            </div>

                            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {navItems.map((item, index) => (
                                    <NavItem key={item.path} item={item} index={index} onClick={() => setIsMobileMenuOpen(false)} />
                                ))}
                            </nav>

                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                    color: '#D95555', backgroundColor: 'transparent', border: '1px solid #2A1515',
                                    borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                    fontFamily: "'Syne', sans-serif"
                                }}
                            >
                                <LogOut style={{ width: '18px', height: '18px' }} /> Logout
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main
                style={{
                    flex: 1,
                    marginLeft: '0',
                    marginTop: '64px',
                    padding: '24px',
                    paddingBottom: '100px',
                    minHeight: 'calc(100vh - 64px)',
                }}
                className="lg:ml-[260px] lg:mt-0 lg:min-h-screen lg:pb-0"
            >
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ maxWidth: '1200px', margin: '0 auto', height: '100%' }}
                >
                    <Outlet />
                </motion.div>
            </main>

            {/* Mobile Bottom Navigation */}
            <motion.nav
                initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                className="lg:hidden"
                style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
                    backgroundColor: '#131316', borderTop: '1px solid #252530',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                    padding: '0 12px', zIndex: 40,
                }}
            >
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path === '/groups' && location.pathname.startsWith('/groups'));
                    return (
                        <NavLink key={item.path} to={item.path}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                padding: '8px 12px', color: isActive ? '#D4A853' : '#8A8680',
                                textDecoration: 'none', transition: 'color 0.2s ease',
                                fontFamily: "'Syne', sans-serif"
                            }}
                        >
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                style={{
                                    padding: '8px', borderRadius: '12px',
                                    backgroundColor: isActive ? '#222228' : 'transparent',
                                }}
                            >
                                <item.icon style={{ width: '20px', height: '20px' }} />
                            </motion.div>
                            <span style={{ fontSize: '10px', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                        </NavLink>
                    );
                })}
            </motion.nav>
        </div>
    );
}

export default Layout;
