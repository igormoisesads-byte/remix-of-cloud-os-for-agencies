// PWA registration + local notifications helper.
// Guarded to never register in Lovable preview or dev.

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

let regPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerPWA(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (isPreviewOrDev()) {
    // Cleanup any old registrations if present
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) if (r.active?.scriptURL.endsWith("/sw.js")) await r.unregister();
    } catch {}
    return null;
  }
  if (!regPromise) {
    regPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.warn("SW register failed", e); return null;
    });
  }
  return regPromise;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}

export async function notify(title: string, body: string, url = "/chat", tag = "cloudos") {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const reg = await registerPWA();
  if (reg && reg.active) {
    reg.active.postMessage({ type: "notify", title, body, url, tag });
  } else {
    try { new Notification(title, { body, icon: "/icon-192.png", tag }); } catch {}
  }
}
