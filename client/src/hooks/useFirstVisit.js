import { useCallback, useState } from 'react';

export const FIRST_VISIT_KEY = 'balancio_first_visit';

export function useFirstVisit() {
    const [isFirstVisit, setIsFirstVisit] = useState(() => {
        try {
            return localStorage.getItem(FIRST_VISIT_KEY) === '1';
        } catch {
            return false;
        }
    });

    const clearFirstVisit = useCallback(() => {
        try {
            localStorage.removeItem(FIRST_VISIT_KEY);
        } catch {
            // ignore
        }
        setIsFirstVisit(false);
    }, []);

    return { isFirstVisit, clearFirstVisit };
}

export default useFirstVisit;
