export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function showBrowserNotification(title, body, url) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/pwa-icon.svg" });
    if (url && url.startsWith("/") && !url.startsWith("//")) {
      n.onclick = () => {
        window.focus();
        window.location.assign(url);
      };
    }
  } catch {
    // ignore unsupported environments
  }
}
