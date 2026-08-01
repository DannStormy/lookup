/* Look Up service worker: receive pushes, show the notification, open the app. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Look Up";
  const options = {
    body: data.body || "Something is happening in the sky above you.",
    tag: data.tag || "lookup",
    renotify: true,
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/" },
    requireInteraction: data.tag === "lookup-iss",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
