self.addEventListener("push", (event) => {
  let payload = { title: "ECHO update", body: "Open ECHO to view this privately.", url: "/dashboard" };
  try {
    const received = event.data?.json();
    if (received && typeof received.title === "string" && typeof received.body === "string") {
      payload = { title: received.title, body: received.body, url: "/dashboard" };
    }
  } catch { /* Keep the private fallback for malformed provider payloads. */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("/dashboard", self.location.origin).href;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      await existing.navigate(target);
    } else {
      await self.clients.openWindow(target);
    }
  })());
});
