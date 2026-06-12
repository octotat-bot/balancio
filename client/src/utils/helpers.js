/** Normalize MongoDB ObjectId / populated user to a comparable string id */
export const getId = (entity) => {
    if (entity == null) return '';
    if (typeof entity === 'string') return entity;
    const id = entity._id ?? entity;
    return id?.toString?.() ?? String(id);
};

/** Compare two user/entity ids safely */
export const isSameId = (a, b) => getId(a) === getId(b);

// Format currency with symbol
export const formatCurrency = (amount, currency = 'INR') => {
    const value = amount == null || Number.isNaN(Number(amount)) ? 0 : Number(amount);
    const formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return formatter.format(value);
};

// Format date to readable string
export const formatDate = (date, format = 'short') => {
    const d = new Date(date);

    if (format === 'short') {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    }

    if (format === 'long') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    if (format === 'relative') {
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    return d.toLocaleDateString();
};

// Truncate text with ellipsis
export const truncate = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

// Get initials from name
export const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

// Calculate password strength (0-4)
export const getPasswordStrength = (password) => {
    if (!password) return 0;

    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    return Math.min(strength, 4);
};

// Validate email format
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Round to 2 decimal places
export const roundToTwo = (num) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Calculate splits for an expense
export const calculateSplits = (totalAmount, participants, splitType, customSplits = {}) => {
    const count = participants.length;

    if (splitType === 'equal') {
        const perPerson = roundToTwo(totalAmount / count);
        const remainder = roundToTwo(totalAmount - perPerson * count);

        return participants.map((p, i) => ({
            participant: p,
            amount: i === 0 ? roundToTwo(perPerson + remainder) : perPerson,
        }));
    }

    if (splitType === 'percentage') {
        return participants.map((p) => ({
            participant: p,
            amount: roundToTwo(totalAmount * (customSplits[p._id] || 0) / 100),
        }));
    }

    if (splitType === 'shares') {
        const totalShares = participants.reduce((sum, p) => sum + (customSplits[p._id] || 1), 0);
        return participants.map((p) => ({
            participant: p,
            amount: roundToTwo(totalAmount * (customSplits[p._id] || 1) / totalShares),
        }));
    }

    // Unequal - custom amounts
    return participants.map((p) => ({
        participant: p,
        amount: roundToTwo(customSplits[p._id] || 0),
    }));
};

// Simplify debts using min-cash flow algorithm
export const simplifyDebts = (balances) => {
    // balances is an array of { userId, balance } where positive = owed to them, negative = they owe
    const settlements = [];

    const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
    const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);

    let i = 0;
    let j = 0;

    while (i < creditors.length && j < debtors.length) {
        const credit = creditors[i].balance;
        const debt = Math.abs(debtors[j].balance);
        const amount = Math.min(credit, debt);

        if (amount > 0.01) {
            settlements.push({
                from: debtors[j],
                to: creditors[i],
                amount: roundToTwo(amount),
            });
        }

        creditors[i].balance -= amount;
        debtors[j].balance += amount;

        if (creditors[i].balance < 0.01) i++;
        if (Math.abs(debtors[j].balance) < 0.01) j++;
    }

    return settlements;
};

// Debounce function
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Generate random color for avatars
export const getAvatarColor = (name) => {
    const colors = [
        'bg-gray-200',
        'bg-gray-300',
        'bg-gray-400',
    ];

    if (!name) return colors[0];

    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
};
