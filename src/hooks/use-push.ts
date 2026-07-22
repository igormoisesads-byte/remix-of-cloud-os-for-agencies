import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";
import { registerPWA } from "@/lib/pwa";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(deletePushSubscription);
  const test = useServerFn(sendTestPush);

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("Seu navegador não suporta notificações.");
      return;
    }
    setLoading(true);
    try {
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = (await registerPWA()) ?? (await navigator.serviceWorker.ready);
      if (!reg) throw new Error("Service worker indisponível (rode no app publicado, não no preview).");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
      await save({
        data: {
          endpoint: json.endpoint!,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent,
        },
      });
      setSubscribed(true);
      await test();
    } finally {
      setLoading(false);
    }
  }, [save, test]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [remove]);

  return { permission, subscribed, loading, enable, disable };
}
