/**
 * Web Push Notification Utilities
 * Handles browser push notification subscription management
 */

// Get VAPID public key from environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Check if push notifications are supported in the browser
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get the current push permission state
 */
export async function getPushPermissionState(): Promise<PermissionState> {
  if (!isPushSupported()) {
    return "denied";
  }
  return Notification.permission as PermissionState;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }
  return await Notification.requestPermission();
}

/**
 * Convert a base64 string to a Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register the service worker if not already registered
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new Error("Service workers are not supported in this browser");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });

  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready;

  return registration;
}

/**
 * Get existing push subscription if any
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error("Error getting existing subscription:", error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 * Returns the PushSubscription object to send to the server
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key is not configured");
  }

  // Request permission if not already granted
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied");
  }

  try {
    // Register service worker
    const registration = await registerServiceWorker();

    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return existingSubscription;
    }

    // Subscribe to push
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    return subscription;
  } catch (error) {
    console.error("Error subscribing to push:", error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      return await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
    return false;
  }
}

/**
 * Check if the service worker is registered and active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!registration?.active;
  } catch {
    return false;
  }
}
