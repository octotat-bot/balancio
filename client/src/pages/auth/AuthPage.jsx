import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, Shield, Users, Zap } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ui/Toast';

const loginSchema = z.object({
    identifier: z.string().min(1, 'Email or phone is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    rememberMe: z.boolean().optional(),
});

const signupSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

const features = [
    { icon: Users, title: 'Split Expenses', description: 'Easily divide bills with friends and groups' },
    { icon: Zap, title: 'Instant Sync', description: 'Real-time updates across all devices' },
    { icon: Shield, title: 'Secure', description: 'Your financial data is always protected' },
];

export function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();
    const { login, signup, isLoading } = useAuthStore();
    const toast = useToast();

    const loginForm = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { identifier: '', password: '', rememberMe: false },
        mode: 'onChange'
    });

    const signupForm = useForm({
        resolver: zodResolver(signupSchema),
        defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
        mode: 'onChange'
    });

    const handleLogin = async (data) => {
        const isEmail = data.identifier.includes('@');
        const result = await login(data.identifier, data.password, data.rememberMe, isEmail ? 'email' : 'phone');
        if (result.success) {
            toast.success('👋 Welcome back!', 'Great to see you again');
            navigate('/dashboard');
        } else {
            console.error('Login error:', result);
            toast.error('Login failed', result.message || 'Please check your credentials');
        }
    };

    const handleSignup = async (data) => {
        console.log('Attempting signup with data:', { ...data, password: '***' });
        const result = await signup({
            name: data.name,
            email: data.email,
            phone: data.phone,
            password: data.password
        });
        if (result.success) {
            toast.success('🎊 Welcome aboard!', 'Your account is ready to go');
            navigate('/dashboard');
        } else {
            console.error('Signup error:', result);
            toast.error('Signup failed', result.message || 'Please try again with different details');
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        loginForm.reset();
        signupForm.reset();
    };

    const contentVariants = {
        hidden: {
            opacity: 0,
            x: 20,
        },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.5,
                delay: 0.3,
                staggerChildren: 0.08,
            }
        },
        exit: {
            opacity: 0,
            x: -20,
            transition: { duration: 0.3 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    };

    const floatingVariants = {
        animate: {
            y: [-8, 8, -8],
            transition: {
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut'
            }
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            padding: '20px',
            overflow: 'hidden',
        }}>
            {/* Main Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    width: '100%',
                    maxWidth: '1000px',
                    minHeight: '650px',
                    backgroundColor: '#fff',
                    borderRadius: '32px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Left Side - Dark Panel (Slides) */}
                <motion.div
                    animate={{
                        x: isLogin ? 0 : '100%',
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 350,
                        damping: 35,
                        mass: 1,
                    }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '50%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 50%, #0a0a0a 100%)',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px',
                        overflow: 'hidden',
                    }}
                >
                    {/* Decorative Elements */}
                    <motion.div
                        variants={floatingVariants}
                        animate="animate"
                        style={{
                            position: 'absolute',
                            top: '15%',
                            left: '10%',
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                        }}
                    />
                    <motion.div
                        animate={{
                            y: [8, -8, 8],
                            transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' }
                        }}
                        style={{
                            position: 'absolute',
                            bottom: '20%',
                            right: '10%',
                            width: '140px',
                            height: '140px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                        }}
                    />

                    {/* Grid Pattern */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `
                            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                        `,
                        backgroundSize: '50px 50px',
                    }} />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={isLogin ? 'login-panel' : 'signup-panel'}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            style={{
                                textAlign: 'center',
                                color: '#fff',
                                zIndex: 1,
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, #fff 0%, #e5e5e5 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 32px',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                }}
                            >
                                <Sparkles size={36} style={{ color: '#0a0a0a' }} />
                            </motion.div>

                            <h2 style={{
                                fontSize: '32px',
                                fontWeight: '800',
                                margin: '0 0 16px',
                                letterSpacing: '-0.02em',
                            }}>
                                {isLogin ? 'Welcome Back!' : 'Join Balancio'}
                            </h2>

                            <p style={{
                                fontSize: '16px',
                                opacity: 0.8,
                                margin: '0 0 40px',
                                lineHeight: 1.6,
                                maxWidth: '280px',
                            }}>
                                {isLogin
                                    ? 'Sign in to continue managing your shared expenses with ease.'
                                    : 'Create an account to start splitting bills and tracking expenses.'}
                            </p>

                            {/* Features */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {features.map((feature, index) => (
                                    <motion.div
                                        key={feature.title}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + index * 0.1 }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '14px',
                                            padding: '14px 18px',
                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                            borderRadius: '14px',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        <feature.icon size={22} style={{ opacity: 0.9, flexShrink: 0 }} />
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                                                {feature.title}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
                                                {feature.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.03, boxShadow: '0 15px 35px rgba(0,0,0,0.3)' }}
                                whileTap={{ scale: 0.97 }}
                                onClick={toggleMode}
                                style={{
                                    marginTop: '40px',
                                    padding: '16px 36px',
                                    backgroundColor: '#fff',
                                    color: '#0a0a0a',
                                    border: 'none',
                                    borderRadius: '14px',
                                    fontSize: '15px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    margin: '40px auto 0',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                }}
                            >
                                {isLogin ? 'Create Account' : 'Sign In Instead'}
                                <ArrowRight size={18} />
                            </motion.button>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Right Side - Login Form (visible when isLogin is true) */}
                <div style={{
                    width: '50%',
                    marginLeft: '50%',
                    padding: '48px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: '650px',
                }}>
                    <AnimatePresence mode="wait">
                        {isLogin && (
                            <motion.div
                                key="login-form"
                                variants={contentVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                <motion.div variants={itemVariants}>
                                    <h1 style={{
                                        fontSize: '28px',
                                        fontWeight: '800',
                                        color: '#0a0a0a',
                                        margin: '0 0 8px',
                                    }}>
                                        Sign In
                                    </h1>
                                    <p style={{
                                        fontSize: '15px',
                                        color: '#737373',
                                        margin: '0 0 32px',
                                    }}>
                                        Enter your credentials to access your account
                                    </p>
                                </motion.div>

                                <form onSubmit={loginForm.handleSubmit(handleLogin)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <motion.div variants={itemVariants}>
                                        <Input
                                            label="Email or Phone"
                                            placeholder="Enter your email or phone"
                                            icon={Mail}
                                            error={loginForm.formState.errors.identifier?.message}
                                            {...loginForm.register('identifier')}
                                        />
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                label="Password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Enter your password"
                                                icon={Lock}
                                                error={loginForm.formState.errors.password?.message}
                                                {...loginForm.register('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '14px',
                                                    top: '38px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#737373',
                                                    padding: '4px',
                                                }}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </motion.div>

                                    <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                {...loginForm.register('rememberMe')}
                                                style={{ width: '18px', height: '18px', accentColor: '#0a0a0a' }}
                                            />
                                            <span style={{ fontSize: '14px', color: '#525252' }}>Remember me</span>
                                        </label>
                                        <a href="#" style={{ fontSize: '14px', color: '#0a0a0a', fontWeight: '500', textDecoration: 'none' }}>
                                            Forgot password?
                                        </a>
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <Button
                                            type="submit"
                                            loading={isLoading}
                                            icon={ArrowRight}
                                            iconPosition="right"
                                            style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                                        >
                                            Sign In
                                        </Button>
                                    </motion.div>
                                </form>

                                <motion.p
                                    variants={itemVariants}
                                    style={{
                                        textAlign: 'center',
                                        marginTop: '24px',
                                        fontSize: '14px',
                                        color: '#737373',
                                    }}
                                >
                                    Don't have an account?{' '}
                                    <button
                                        onClick={toggleMode}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#0a0a0a',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                        }}
                                    >
                                        Sign up
                                    </button>
                                </motion.p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Left Side - Signup Form (visible when isLogin is false) */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    padding: '48px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}>
                    <AnimatePresence mode="wait">
                        {!isLogin && (
                            <motion.div
                                key="signup-form"
                                variants={contentVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                <motion.div variants={itemVariants}>
                                    <h1 style={{
                                        fontSize: '28px',
                                        fontWeight: '800',
                                        color: '#0a0a0a',
                                        margin: '0 0 8px',
                                    }}>
                                        Create Account
                                    </h1>
                                    <p style={{
                                        fontSize: '15px',
                                        color: '#737373',
                                        margin: '0 0 24px',
                                    }}>
                                        Fill in your details to get started
                                    </p>
                                </motion.div>

                                <form onSubmit={signupForm.handleSubmit(handleSignup, (errors) => console.error('Validation errors:', errors))} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <motion.div variants={itemVariants}>
                                        <Input
                                            label="Full Name"
                                            placeholder="Enter your name"
                                            icon={User}
                                            error={signupForm.formState.errors.name?.message}
                                            {...signupForm.register('name')}
                                        />
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <Input
                                            label="Email"
                                            type="email"
                                            placeholder="Enter your email"
                                            icon={Mail}
                                            error={signupForm.formState.errors.email?.message}
                                            {...signupForm.register('email')}
                                        />
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <Input
                                            label="Phone Number"
                                            placeholder="Enter your phone"
                                            icon={Phone}
                                            error={signupForm.formState.errors.phone?.message}
                                            {...signupForm.register('phone')}
                                        />
                                    </motion.div>

                                    <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                label="Password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Password"
                                                icon={Lock}
                                                error={signupForm.formState.errors.password?.message}
                                                {...signupForm.register('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '12px',
                                                    top: '38px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#737373',
                                                    padding: '4px',
                                                }}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <Input
                                                label="Confirm"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="Confirm"
                                                icon={Lock}
                                                error={signupForm.formState.errors.confirmPassword?.message}
                                                {...signupForm.register('confirmPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '12px',
                                                    top: '38px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#737373',
                                                    padding: '4px',
                                                }}
                                            >
                                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </motion.div>

                                    <motion.div variants={itemVariants}>
                                        <Button
                                            type="submit"
                                            loading={isLoading}
                                            icon={ArrowRight}
                                            iconPosition="right"
                                            style={{ width: '100%', padding: '16px', fontSize: '16px', marginTop: '8px' }}
                                        >
                                            Create Account
                                        </Button>
                                    </motion.div>
                                </form>

                                <motion.p
                                    variants={itemVariants}
                                    style={{
                                        textAlign: 'center',
                                        marginTop: '20px',
                                        fontSize: '14px',
                                        color: '#737373',
                                    }}
                                >
                                    Already have an account?{' '}
                                    <button
                                        onClick={toggleMode}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#0a0a0a',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                        }}
                                    >
                                        Sign in
                                    </button>
                                </motion.p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default AuthPage;
