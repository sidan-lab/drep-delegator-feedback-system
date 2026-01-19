import webpush from "web-push";

// Initialize VAPID credentials
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let isInitialized = false;

/**
 * Initialize web push with VAPID credentials
 * Call this once at startup
 */
export function initWebPush(): boolean {
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    console.warn(
      "[WebPush] VAPID credentials not configured. Web push notifications disabled."
    );
    console.warn(
      "[WebPush] Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY in .env"
    );
    return false;
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isInitialized = true;
    console.log("[WebPush] Initialized successfully");
    return true;
  } catch (error) {
    console.error("[WebPush] Failed to initialize:", error);
    return false;
  }
}

/**
 * Check if web push is configured and ready
 */
export function isWebPushEnabled(): boolean {
  return isInitialized;
}

/**
 * Get the public VAPID key for frontend subscription
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  proposalId?: string;
  tag?: string;
  icon?: string;
}

export interface PushResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  expired?: boolean; // True if subscription is no longer valid
}

/**
 * Send a push notification to a single subscription
 *
 * @param subscriptionJson - JSON-stringified PushSubscription object
 * @param payload - Notification content
 * @returns Result indicating success or failure
 */
export async function sendPushNotification(
  subscriptionJson: string,
  payload: PushNotificationPayload
): Promise<PushResult> {
  if (!isInitialized) {
    return {
      success: false,
      error: "Web push not initialized. Check VAPID configuration.",
    };
  }

  try {
    const subscription = JSON.parse(subscriptionJson);

    // Validate subscription structure
    if (!subscription.endpoint || !subscription.keys) {
      return {
        success: false,
        error: "Invalid subscription: missing endpoint or keys",
      };
    }

    // Send the notification
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
        urgency: "normal",
      }
    );

    return {
      success: true,
      statusCode: result.statusCode,
    };
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number; body?: string };

    // Handle specific error cases
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      // Subscription has expired or is no longer valid
      return {
        success: false,
        statusCode: webPushError.statusCode,
        error: "Subscription expired or invalid",
        expired: true,
      };
    }

    if (webPushError.statusCode === 429) {
      // Rate limited
      return {
        success: false,
        statusCode: 429,
        error: "Rate limited by push service",
      };
    }

    return {
      success: false,
      statusCode: webPushError.statusCode,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send push notifications to multiple subscriptions
 *
 * @param notifications - Array of {subscriptionJson, payload} pairs
 * @returns Array of results for each notification
 */
export async function sendBatchPushNotifications(
  notifications: Array<{
    subscriptionJson: string;
    payload: PushNotificationPayload;
  }>
): Promise<Array<PushResult & { index: number }>> {
  const results = await Promise.all(
    notifications.map(async ({ subscriptionJson, payload }, index) => {
      const result = await sendPushNotification(subscriptionJson, payload);
      return { ...result, index };
    })
  );

  return results;
}

/**
 * Create a deadline alert notification payload
 */
export function createDeadlineAlertPayload(options: {
  proposalTitle: string;
  proposalId: string;
  daysRemaining: number;
  drepHasVoted: boolean;
  proposalType?: string;
  frontendUrl?: string;
}): PushNotificationPayload {
  const {
    proposalTitle,
    proposalId,
    daysRemaining,
    drepHasVoted,
    frontendUrl = process.env.FRONTEND_URL || "https://drep.sidan.io",
  } = options;

  const urgency =
    daysRemaining <= 1 ? "URGENT" : daysRemaining <= 3 ? "Soon" : "Reminder";

  const voteStatus = drepHasVoted ? "" : " - You haven't voted yet!";

  return {
    title: `${urgency}: Voting deadline in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    body: `${proposalTitle}${voteStatus}`,
    url: `${frontendUrl}/governance/${proposalId}`,
    proposalId,
    tag: `deadline-${proposalId}`, // Prevents duplicate notifications for same proposal
    icon: "/icon-192.png",
  };
}
