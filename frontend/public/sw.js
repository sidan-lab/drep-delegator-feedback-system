/**
 * Service Worker for Web Push Notifications
 * Handles push events and notification clicks
 */

// Default notification icon
const DEFAULT_ICON = "/icon-192.png";
const DEFAULT_BADGE = "/badge-72.png";

// Listen for push events
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event received but no data");
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || "You have a new notification",
      icon: data.icon || DEFAULT_ICON,
      badge: data.badge || DEFAULT_BADGE,
      tag: data.tag || "default",
      data: {
        url: data.url || "/",
        proposalId: data.proposalId,
      },
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Notification", options)
    );
  } catch (error) {
    console.error("Error processing push notification:", error);
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  const urlToOpen = data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there's already a window open with the URL
        for (const client of windowClients) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }

        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

// Service worker activation
self.addEventListener("activate", (event) => {
  console.log("Service worker activated");
  event.waitUntil(self.clients.claim());
});

// Service worker installation
self.addEventListener("install", (event) => {
  console.log("Service worker installed");
  event.waitUntil(self.skipWaiting());
});
