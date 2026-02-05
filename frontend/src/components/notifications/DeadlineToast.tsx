/**
 * DeadlineToast Component
 * Custom toast notification for voting deadline alerts
 * Features urgency-based styling and proposal navigation
 */

import React from 'react';
import { useRouter } from 'next/router';
import { ExternalToast, toast as sonnerToast } from 'sonner';

interface DeadlineToastProps {
  toastId: string | number;
  proposalId: string;
  proposalTitle: string;
  daysBeforeExpiry: number;
  drepHasVoted: boolean;
  onDismiss: () => void;
}

export function DeadlineToastContent({
  toastId,
  proposalId,
  proposalTitle,
  daysBeforeExpiry,
  drepHasVoted,
  onDismiss,
}: DeadlineToastProps) {
  const router = useRouter();

  // Determine urgency level and styling
  const urgency =
    daysBeforeExpiry <= 1 ? 'URGENT' : daysBeforeExpiry <= 3 ? 'Soon' : 'Reminder';

  const emoji = daysBeforeExpiry <= 1 ? '🔴' : daysBeforeExpiry <= 3 ? '🟠' : '🟡';

  const borderColor =
    daysBeforeExpiry <= 1
      ? 'border-red-500'
      : daysBeforeExpiry <= 3
      ? 'border-orange-500'
      : 'border-yellow-500';

  const voteStatus = drepHasVoted ? '' : " - You haven't voted yet!";

  const title = `${urgency}: Voting deadline in ${daysBeforeExpiry} day${daysBeforeExpiry === 1 ? '' : 's'}`;

  const handleDismiss = () => {
    sonnerToast.dismiss(toastId);
    onDismiss();
  };

  const handleViewProposal = () => {
    // Navigate to proposal page using Next.js router (client-side navigation)
    // This maintains the app state and wallet connection
    router.push(`/governance/${proposalId}`);
    handleDismiss();
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 max-w-md border-l-4 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{emoji}</span>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {proposalTitle}
            {voteStatus && (
              <span className="font-medium text-red-600 dark:text-red-400">
                {voteStatus}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleViewProposal}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              View Proposal
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 p-1"
          aria-label="Dismiss notification"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Show a deadline alert toast notification
 * This is a helper function that uses sonner's toast.custom()
 */
export function showDeadlineToast(
  alert: {
    id: string;
    proposalId: string;
    daysBeforeExpiry: number;
    drepHasVoted: boolean;
    proposal: {
      title: string;
    };
  },
  onDismiss: () => void,
  options?: ExternalToast
) {
  const toastId = sonnerToast.custom(
    (t) => (
      <DeadlineToastContent
        toastId={t}
        proposalId={alert.proposalId}
        proposalTitle={alert.proposal.title}
        daysBeforeExpiry={alert.daysBeforeExpiry}
        drepHasVoted={alert.drepHasVoted}
        onDismiss={onDismiss}
      />
    ),
    {
      duration: Infinity, // Stay until manually dismissed
      position: 'top-right',
      ...options,
    }
  );

  return toastId;
}
