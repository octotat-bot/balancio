import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Users,
    Plus,
    X,
    User,
    Phone,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { useGroupStore } from '../../stores/groupStore';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../stores/authStore';

const createGroupSchema = z.object({
    name: z.string().min(1, 'Group name is required').max(50, 'Group name must be 50 characters or less'),
    description: z.string().max(200, 'Description must be 200 characters or less').optional(),
    members: z.array(z.object({
        name: z.string().min(1, 'Name is required'),
        phone: z.string().min(10, 'Please enter a valid phone number'),
    })).optional(),
});

// Group icons/colors
const groupIcons = [
    { emoji: '🏠', label: 'Home' },
    { emoji: '✈️', label: 'Travel' },
    { emoji: '🍔', label: 'Food' },
    { emoji: '🎉', label: 'Party' },
    { emoji: '💼', label: 'Work' },
    { emoji: '🛒', label: 'Shopping' },
    { emoji: '🎮', label: 'Gaming' },
    { emoji: '❤️', label: 'Couple' },
];

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

export function CreateGroup() {
    const navigate = useNavigate();
    const { createGroup, isLoading } = useGroupStore();
    const { user } = useAuthStore();
    const toast = useToast();
    const [selectedIcon, setSelectedIcon] = useState(0);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm({
        resolver: zodResolver(createGroupSchema),
        defaultValues: {
            name: '',
            description: '',
            members: [{ name: '', phone: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'members',
    });

    const nameValue = watch('name');

    const onSubmit = async (data) => {
        // Filter out empty members
        const members = data.members
            .filter((m) => m.name && m.phone)
            .filter((m) => m.phone !== user.phone); // Don't add yourself

        const result = await createGroup({
            name: data.name,
            description: data.description,
            icon: groupIcons[selectedIcon].emoji,
            members,
        });

        if (result.success) {
            toast.success('🎉 Group created!', `"${data.name}" is ready for splitting expenses`);
            navigate(`/groups/${result.group._id}`);
        } else {
            toast.error('Couldn\'t create group', result.message || 'Please try again');
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '100px' }}
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}
            >
                <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: '#1A1A1F' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(-1)}
                    style={{
                        padding: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#B0ADA8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft style={{ width: '20px', height: '20px' }} />
                </motion.button>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#EDEAE4', margin: '0 0 4px' }}>
                        Create Group
                    </h1>
                    <p style={{ fontSize: '15px', color: '#8A8680', margin: 0 }}>
                        Start splitting expenses with friends
                    </p>
                </div>
            </motion.div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Group Info */}
                <motion.div variants={itemVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Group Info</CardTitle>
                        </CardHeader>
                        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Icon Selection */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#B0ADA8', marginBottom: '8px' }}>
                                    Group Icon
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {groupIcons.map((icon, index) => (
                                        <motion.button
                                            key={index}
                                            type="button"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setSelectedIcon(index)}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: selectedIcon === index ? '#000' : '#f5f5f5',
                                                color: selectedIcon === index ? '#fff' : '#000',
                                                transition: 'background-color 0.2s',
                                            }}
                                        >
                                            {icon.emoji}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Name */}
                            <div style={{ position: 'relative' }}>
                                <Input
                                    label="Group Name"
                                    placeholder="e.g., Trip to Paris, Roommates"
                                    error={errors.name?.message}
                                    {...register('name')}
                                />
                                <p style={{ position: 'absolute', right: 0, top: 0, fontSize: '12px', color: '#6A6763' }}>
                                    {nameValue?.length || 0}/50
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#EDEAE4', marginBottom: '8px' }}>
                                    Description (optional)
                                </label>
                                <textarea
                                    placeholder="What's this group for?"
                                    rows={3}
                                    {...register('description')}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid #e5e5e5',
                                        fontSize: '15px',
                                        outline: 'none',
                                        resize: 'none',
                                        fontFamily: 'inherit',
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#000'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                                />
                                {errors.description && (
                                    <p style={{ marginTop: '6px', fontSize: '13px', color: '#dc2626' }}>{errors.description.message}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Members */}
                <motion.div variants={itemVariants}>
                    <Card>
                        <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <CardTitle>Members</CardTitle>
                            <span style={{ fontSize: '13px', color: '#8A8680' }}>
                                {fields.length + 1} members (including you)
                            </span>
                        </CardHeader>
                        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Current User */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#1A1A1F', borderRadius: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#D4A853', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: '500', margin: 0 }}>{user?.name}</p>
                                    <p style={{ fontSize: '13px', color: '#8A8680', margin: 0 }}>{user?.email}</p>
                                </div>
                                <span style={{ fontSize: '12px', color: '#6A6763', textTransform: 'uppercase', fontWeight: '600' }}>You</span>
                            </div>

                            {/* Member Inputs */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {fields.map((field, index) => (
                                    <motion.div
                                        key={field.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                    >
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ flex: 1 }}>
                                                <Input
                                                    placeholder="Member name"
                                                    icon={User}
                                                    error={errors.members?.[index]?.name?.message}
                                                    {...register(`members.${index}.name`)}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <Input
                                                    placeholder="Phone number"
                                                    icon={Phone}
                                                    error={errors.members?.[index]?.phone?.message}
                                                    {...register(`members.${index}.phone`)}
                                                />
                                            </div>
                                            {fields.length > 1 && (
                                                <motion.button
                                                    type="button"
                                                    whileHover={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                                                    onClick={() => remove(index)}
                                                    style={{
                                                        padding: '10px',
                                                        color: '#6A6763',
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <X style={{ width: '20px', height: '20px' }} />
                                                </motion.button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {errors.members?.message && (
                                <p style={{ fontSize: '13px', color: '#dc2626' }}>{errors.members.message}</p>
                            )}

                            <Button
                                type="button"
                                variant="ghost"
                                style={{ width: '100%', border: '2px dashed #e5e5e5', backgroundColor: '#16161B' }}
                                icon={Plus}
                                onClick={() => append({ name: '', phone: '' })}
                            >
                                Add Another Member
                            </Button>

                            <p style={{ fontSize: '12px', color: '#6A6763', textAlign: 'center', margin: 0 }}>
                                Add members by name and phone number (registered or not)
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Submit */}
                <motion.div variants={itemVariants} style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        type="button"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onClick={() => navigate(-1)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        style={{ flex: 1 }}
                        loading={isLoading}
                        icon={Users}
                    >
                        Create Group
                    </Button>
                </motion.div>
            </form >
        </motion.div >
    );
}

export default CreateGroup;
