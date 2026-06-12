export const normalizePhone = (phone) => {
    if (!phone) return '';

    let cleaned = String(phone).replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');

    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.slice(2);
    }

    return cleaned;
};

export const phonesMatch = (phone1, phone2) => {
    return normalizePhone(phone1) === normalizePhone(phone2);
};
