export const normalizePhone = (phone) => {
    if (!phone) return '';

    let cleaned = String(phone).replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');

    // Treat +91 / 91 prefix the same as a 10-digit Indian mobile number
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.slice(2);
    }

    return cleaned;
};

export const phonesMatch = (phone1, phone2) => {
    return normalizePhone(phone1) === normalizePhone(phone2);
};

/** DB lookup variants for numbers stored before normalization was consistent */
export const phoneLookupVariants = (phone) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return [];

    const variants = new Set([normalized]);
    if (normalized.length === 10) {
        variants.add(`91${normalized}`);
    }
    return [...variants];
};
