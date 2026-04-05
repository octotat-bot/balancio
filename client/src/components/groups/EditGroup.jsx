import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { FileText, Edit, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useGroupStore } from '../../stores/groupStore';
import { useToast } from '../ui/Toast';

const groupSchema = z.object({
    name: z.string().min(1, 'Group name is required').max(50, 'Group name must be 50 characters or less'),
    description: z.string().max(200, 'Description must be 200 characters or less').optional(),
    icon: z.string().optional(),
});

const icons = [
    '👥', '👨‍👩‍👧‍👦', '🏠', '✈️', '🎉', '🎯',
    '💼', '🎮', '🍕', '☕', '🏖️', '🎭',
    '🚗', '🏕️', '🎨', '🎵', '🏋️', '📚'
];

export function EditGroup({ group, onSuccess, onCancel }) {
    const { updateGroup, isLoading } = useGroupStore();
    const toast = useToast();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(groupSchema),
        defaultValues: {
            name: group.name || '',
            description: group.description || '',
            icon: group.icon || '👥',
        },
    });

    const selectedIcon = watch('icon');

    const onSubmit = async (data) => {
        const result = await updateGroup(group._id, data);

        if (result.success) {
            toast.success('✨ Group updated!', 'Changes have been saved');
            onSuccess?.();
        } else {
            toast.error('Couldn\'t update group', result.message || 'Please try again');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Icon Selection */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#EDEAE4' }}>
                    Group Icon
                </label>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '8px',
                    padding: '16px',
                    backgroundColor: '#16161B',
                    borderRadius: '16px',
                    border: '2px solid #e5e5e5'
                }}>
                    {icons.map((icon) => (
                        <motion.button
                            key={icon}
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setValue('icon', icon)}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                border: '2px solid',
                                borderColor: selectedIcon === icon ? '#000' : 'transparent',
                                backgroundColor: selectedIcon === icon ? '#fff' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {icon}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Group Name */}
            <Input
                label="Group Name"
                placeholder="e.g., Weekend Trip, Roommates"
                icon={Edit}
                error={errors.name?.message}
                {...register('name')}
            />

            {/* Description */}
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#EDEAE4' }}>
                    Description (optional)
                </label>
                <textarea
                    placeholder="What's this group for?"
                    {...register('description')}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e5e5',
                        borderRadius: '12px',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                        minHeight: '100px',
                        transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#000'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                />
                {errors.description && (
                    <p style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444' }}>{errors.description.message}</p>
                )}
            </div>

            {/* Preview */}
            <div style={{
                padding: '20px',
                backgroundColor: '#16161B',
                borderRadius: '16px',
                border: '2px solid #e5e5e5'
            }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '600', color: '#8A8680', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Preview
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: '#131316',
                        border: '2px solid #e5e5e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px'
                    }}>
                        {selectedIcon}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#EDEAE4' }}>
                            {watch('name') || 'Group Name'}
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#8A8680' }}>
                            {watch('description') || 'No description'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid #252530' }}>
                <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" icon={Check} loading={isLoading} style={{ flex: 1 }}>
                    Save Changes
                </Button>
            </div>
        </form>
    );
}

export default EditGroup;
