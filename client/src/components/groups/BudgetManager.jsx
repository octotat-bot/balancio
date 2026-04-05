import React, { useState, useEffect } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useToast } from '../ui/Toast';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, AlertTriangle, CheckCircle, Save } from 'lucide-react';

const CATEGORIES = [
    'Food', 'Transport', 'Rent', 'Utilities', 'Entertainment',
    'Health', 'Shopping', 'Travel', 'Groceries', 'Other'
];

export function BudgetManager({ groupId, budgets = [], isAdmin }) {
    const { updateBudgets, isLoading } = useGroupStore();
    const toast = useToast();
    const [localBudgets, setLocalBudgets] = useState(budgets);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setLocalBudgets(budgets);
    }, [budgets]);

    const handleAddBudget = () => {
        setLocalBudgets([...localBudgets, { category: 'Food', limit: 1000 }]);
        setIsEditing(true);
    };

    const handleRemoveBudget = (index) => {
        const newBudgets = [...localBudgets];
        newBudgets.splice(index, 1);
        setLocalBudgets(newBudgets);
        setIsEditing(true);
    };

    const handleUpdateBudget = (index, field, value) => {
        const newBudgets = [...localBudgets];
        newBudgets[index] = { ...newBudgets[index], [field]: value };
        setLocalBudgets(newBudgets);
        setIsEditing(true);
    };

    const handleSave = async () => {
        // Validate
        if (localBudgets.some(b => b.limit <= 0)) {
            toast.error('Invalid limit', 'Budget limit must be greater than 0');
            return;
        }

        // Check for duplicate categories
        const categories = localBudgets.map(b => b.category);
        if (new Set(categories).size !== categories.length) {
            toast.error('Duplicate categories', 'Each category can only have one budget');
            return;
        }

        const result = await updateBudgets(groupId, localBudgets);
        if (result.success) {
            toast.success('Budgets saved', 'Group spending limits updated');
            setIsEditing(false);
        } else {
            toast.error('Failed', result.message);
        }
    };

    if (!isAdmin && localBudgets.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8A8680', fontSize: '14px' }}>
                No budgets set for this group.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Category Budgets</h3>
                </div>
                {isAdmin && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAddBudget}
                        icon={Plus}
                    >
                        Add Limit
                    </Button>
                )}
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#8A8680' }}>
                Get warned when group spending exceeds these monthly limits.
            </p>

            <AnimatePresence>
                {localBudgets.map((budget, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                            backgroundColor: '#131316',
                            padding: '12px',
                            borderRadius: '12px',
                            border: '1px solid #252530'
                        }}
                    >
                        {isAdmin ? (
                            <>
                                <select
                                    value={budget.category}
                                    onChange={(e) => handleUpdateBudget(index, 'category', e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: '1px solid #252530',
                                        fontSize: '14px'
                                    }}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'relative', width: '100px' }}>
                                    <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#8A8680', fontSize: '12px' }}>₹</span>
                                    <input
                                        type="number"
                                        value={budget.limit}
                                        onChange={(e) => handleUpdateBudget(index, 'limit', parseFloat(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '8px 8px 8px 20px',
                                            borderRadius: '6px',
                                            border: '1px solid #252530',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => handleRemoveBudget(index)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            // Read-only view for non-admins
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500' }}>{budget.category}</span>
                                <span style={{ fontWeight: '600', color: '#B0ADA8' }}>Limit: ₹{budget.limit}</span>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            {isAdmin && isEditing && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        icon={Save}
                    >
                        Save Budgets
                    </Button>
                </div>
            )}
        </div>
    );
}

export default BudgetManager;
