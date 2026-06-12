import React, { useState } from 'react';
import { useFirstVisit } from '../../hooks/useFirstVisit';
import { IntroLoader } from './IntroLoader';
import { DashboardTour } from './DashboardTour';

export function FirstTimeExperience() {
    const { isFirstVisit, clearFirstVisit } = useFirstVisit();
    const [phase, setPhase] = useState('loader');

    if (!isFirstVisit) return null;

    if (phase === 'loader') {
        return <IntroLoader onComplete={() => setPhase('walkthrough')} />;
    }

    if (phase === 'walkthrough') {
        return (
            <DashboardTour
                onComplete={() => {
                    clearFirstVisit();
                    setPhase('done');
                }}
            />
        );
    }

    return null;
}

export default FirstTimeExperience;
