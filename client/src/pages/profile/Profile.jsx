import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
    User,
    Mail,
    Phone,
    Lock,
    LogOut,
    Trash2,
    Camera,
    ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/helpers';
import { useGroupStore } from '../../stores/groupStore';
import { useFriendStore } from '../../stores/friendStore';
import api from '../../services/api';

const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
};

const cardVariants = {
    hidden: { scale: 0.95, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { duration: 0.4 } }
};

export function Profile() {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuthStore();
    const { groups, fetchGroups } = useGroupStore();
    const { friends, fetchFriends } = useFriendStore();
    const toast = useToast();
    const fileInputRef = useRef(null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expenseCount, setExpenseCount] = useState(0);

    useEffect(() => {
        fetchGroups();
        fetchFriends();

        const fetchStats = async () => {
            try {
                const res = await api.get('/users/analytics');
                setExpenseCount(res.data.totalExpenses || 0);
            } catch (error) {
                // Skip
            }
        };
        fetchStats();
    }, []);

    const profileForm = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: user?.name || '',
            phone: user?.phone || '',
        },
    });

    const passwordForm = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Invalid file', 'Please select an image file');
            return;
        }

        // 1MB limit for base64 images
        if (file.size > 1024 * 1024) {
            toast.error('Image too large', 'Please choose an image under 1MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const result = await updateUser({ avatar: reader.result });
                if (result.success) {
                    toast.success('📸 New look!', 'Profile photo updated successfully');
                } else {
                    toast.error('Upload failed', result.message || 'Please try again');
                }
            } catch (error) {
                toast.error('Upload failed', 'Please try again');
            }
        };
        reader.onerror = () => {
            toast.error('File error', 'Could not read the image file');
        };
        reader.readAsDataURL(file);
    };

    const handleProfileUpdate = async (data) => {
        await updateUser({ ...data });
        toast.success('✨ Profile updated!', 'Your changes have been saved');
    };

    const handlePasswordChange = async (data) => {
        toast.success('🔒 Password changed!', 'Your account is now more secure');
        setShowPasswordModal(false);
        passwordForm.reset();
    };

    const handleLogout = () => {
        logout();
        navigate('/auth');
    };

    const handleDeleteAccount = async () => {
        toast.success('Account deleted', 'We\'re sad to see you go!');
        logout();
        navigate('/auth');
    };

    const SettingRow = ({ icon: Icon, label, value, onClick, danger }) => (
        <motion.button
            whileHover={{ x: 4, backgroundColor: danger ? '#fef2f2' : '#fafafa' }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 20px',
                backgroundColor: '#131316',
                border: 'none',
                borderBottom: '1px solid #f5f5f5',
                cursor: 'pointer',
                textAlign: 'left',
            }}
        >
            <div
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: danger ? '#fef2f2' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon style={{ width: '20px', height: '20px', color: danger ? '#dc2626' : '#525252' }} />
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '500', fontSize: '15px', color: danger ? '#dc2626' : '#0a0a0a' }}>
                    {label}
                </p>
                {value && <p style={{ margin: 0, fontSize: '13px', color: '#6A6763' }}>{value}</p>}
            </div>
            <ChevronRight style={{ width: '20px', height: '20px', color: '#d4d4d4' }} />
        </motion.button>
    );

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '100px' }}
        >
            {/* Header */}
            <motion.div variants={itemVariants} style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}>
                    Profile
                </h1>
                <p style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}>
                    Manage your account settings
                </p>
            </motion.div>

            {/* Profile Card */}
            <motion.div
                variants={cardVariants}
                whileHover={{ y: -4 }}
                style={{
                    backgroundColor: '#131316',
                    borderRadius: '20px',
                    padding: '32px',
                    border: '1px solid #252530',
                    marginBottom: '24px',
                    textAlign: 'center',
                }}
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}
                >
                    <Avatar name={user?.name} src={user?.avatar} size="xl" />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '36px',
                            height: '36px',
                            backgroundColor: '#D4A853',
                            border: '3px solid #fff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <Camera style={{ width: '16px', height: '16px', color: '#fff' }} />
                    </motion.button>
                </motion.div>

                <motion.h2
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}
                >
                    {user?.name}
                </motion.h2>
                <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}
                >
                    {user?.email}
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '32px',
                        marginTop: '24px',
                        paddingTop: '24px',
                        borderTop: '1px solid #f5f5f5',
                    }}
                >
                    <div>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: 0 }}>{expenseCount}</p>
                        <p style={{ fontSize: '13px', color: '#8A8680', margin: 0 }}>Expenses</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: 0 }}>{groups.length}</p>
                        <p style={{ fontSize: '13px', color: '#8A8680', margin: 0 }}>Groups</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: 0 }}>{friends.accepted.length}</p>
                        <p style={{ fontSize: '13px', color: '#8A8680', margin: 0 }}>Friends</p>
                    </div>
                </motion.div>
            </motion.div>

            {/* Personal Info */}
            <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6A6763', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Personal Information
                </h3>
                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)}>
                    <div
                        style={{
                            backgroundColor: '#131316',
                            borderRadius: '16px',
                            border: '1px solid #252530',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '20px', borderBottom: '1px solid #f5f5f5' }}>
                            <Input
                                label="Display Name"
                                icon={User}
                                error={profileForm.formState.errors.name?.message}
                                {...profileForm.register('name')}
                            />
                        </div>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f5f5f5' }}>
                            <Input
                                label="Email"
                                icon={Mail}
                                value={user?.email}
                                disabled
                            />
                        </div>
                        <div style={{ padding: '20px' }}>
                            <Input
                                label="Phone"
                                icon={Phone}
                                {...profileForm.register('phone')}
                            />
                        </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} style={{ marginTop: '16px' }}>
                        <Button type="submit" style={{ width: '100%' }}>
                            Save Changes
                        </Button>
                    </motion.div>
                </form>
            </motion.div>


            {/* Security */}
            <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6A6763', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Security
                </h3>
                <div
                    style={{
                        backgroundColor: '#131316',
                        borderRadius: '16px',
                        border: '1px solid #252530',
                        overflow: 'hidden',
                    }}
                >
                    <SettingRow icon={Lock} label="Change Password" onClick={() => setShowPasswordModal(true)} />
                    <SettingRow icon={LogOut} label="Logout" onClick={handleLogout} />
                </div>
            </motion.div>

            {/* Danger Zone */}
            <motion.div variants={itemVariants}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Danger Zone
                </h3>
                <div
                    style={{
                        backgroundColor: '#131316',
                        borderRadius: '16px',
                        border: '1px solid #fecaca',
                        overflow: 'hidden',
                    }}
                >
                    <SettingRow icon={Trash2} label="Delete Account" danger onClick={() => setShowDeleteModal(true)} />
                </div>
            </motion.div>

            {/* Password Modal */}
            <Modal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                title="Change Password"
                size="sm"
            >
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input
                        label="Current Password"
                        type="password"
                        icon={Lock}
                        error={passwordForm.formState.errors.currentPassword?.message}
                        {...passwordForm.register('currentPassword')}
                    />
                    <Input
                        label="New Password"
                        type="password"
                        icon={Lock}
                        error={passwordForm.formState.errors.newPassword?.message}
                        {...passwordForm.register('newPassword')}
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        icon={Lock}
                        error={passwordForm.formState.errors.confirmPassword?.message}
                        {...passwordForm.register('confirmPassword')}
                    />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button type="submit" style={{ flex: 1 }}>
                            Change
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Account"
                size="sm"
            >
                <p style={{ color: '#B0ADA8', marginBottom: '24px' }}>
                    Are you sure you want to delete your account? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteAccount} style={{ flex: 1 }}>
                        Delete
                    </Button>
                </div>
            </Modal>
        </motion.div>
    );
}

export default Profile;
