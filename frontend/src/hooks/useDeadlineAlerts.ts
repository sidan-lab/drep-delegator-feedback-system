/**
 * Hook for polling deadline alerts and showing toast notifications
 * Tracks dismissed alerts in localStorage to avoid re-showing them
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyDeadlineAlerts } from '@/services/api';
import { showDeadlineToast } from '@/components/notifications/DeadlineToast';

const DISMISSED_ALERTS_KEY = 'dismissedDeadlineAlerts';
const POLL_INTERVAL = 60 * 1000; // 60 seconds

/**
 * Load dismissed alerts from localStorage
 */
function getDismissedAlerts(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (error) {
    console.error('Failed to load dismissed alerts from localStorage:', error);
    return new Set();
  }
}

/**
 * Save dismissed alert to localStorage
 */
function markAlertDismissed(alertId: string) {
  if (typeof window === 'undefined') return;

  try {
    const dismissed = getDismissedAlerts();
    dismissed.add(alertId);
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...dismissed]));
  } catch (error) {
    console.error('Failed to save dismissed alert to localStorage:', error);
  }
}

/**
 * Hook that polls for deadline alerts and shows toast notifications
 * Only polls when:
 * - User is authenticated with a JWT token
 * - User has a DRep registration
 * - Page is visible (not in background tab)
 */
export function useDeadlineAlerts() {
  const { jwtToken, drepRegistration } = useAuth();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() =>
    getDismissedAlerts()
  );

  const handleDismiss = useCallback((alertId: string) => {
    markAlertDismissed(alertId);
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
  }, []);

  const pollAlerts = useCallback(async () => {
    // Only poll when page is visible
    if (document.hidden) return;

    // Only poll when authenticated
    if (!jwtToken || !drepRegistration) return;

    try {
      const response = await getMyDeadlineAlerts(jwtToken);

      if (!response.success) {
        console.error('Failed to fetch deadline alerts:', response);
        return;
      }

      // Show toast for new alerts (not dismissed)
      response.alerts
        .filter((alert) => !dismissedAlerts.has(alert.id))
        .forEach((alert) => {
          showDeadlineToast(alert, () => handleDismiss(alert.id));
        });
    } catch (error) {
      console.error('Error polling deadline alerts:', error);
    }
  }, [jwtToken, drepRegistration, dismissedAlerts, handleDismiss]);

  useEffect(() => {
    if (!jwtToken || !drepRegistration) return;

    // Initial poll
    pollAlerts();

    // Poll every 60 seconds
    const interval = setInterval(pollAlerts, POLL_INTERVAL);

    // Poll when page becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        pollAlerts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [jwtToken, drepRegistration, pollAlerts]);

  return null;
}
