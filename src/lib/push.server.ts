// Server-only Web Push helpers.
// Uses @block65/webcrypto-web-push (edge/Cloudflare Workers compatible).
import { buildPushPayload, type PushSubscription, type PushMessage, type VapidKeys } from "@block65/webcrypto-web-push";

function getVapid(): VapidKeys {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@cloudos.app";
  if (!publicKey || !privateKey) throw new Error("VAPID keys missing");
  return { publicKey, privateKey, subject };
}

export type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: NotificationPayload,
): Promise<{ ok: boolean; status?: number; gone?: boolean; error?: string }> {
  try {
    const subscription: PushSubscription = {
      endpoint: sub.endpoint,
      expirationTime: null,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    const message: PushMessage = {
      data: JSON.stringify(payload),
      options: { ttl: 60 * 60 * 24 },
    };
    const req = await buildPushPayload(message, subscription, getVapid());
    const resp = await fetch(subscription.endpoint, req as RequestInit);
    if (resp.status === 404 || resp.status === 410) {
      return { ok: false, status: resp.status, gone: true };
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return { ok: false, status: resp.status, error: t };
    }
    return { ok: true, status: resp.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Send to all subscriptions for the given user IDs. Removes gone subscriptions. */
export async function sendPushToUsers(userIds: string[], payload: NotificationPayload) {
  if (!userIds.length) return { sent: 0, removed: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);
  let sent = 0, removed = 0;
  for (const s of subs ?? []) {
    const r = await sendPushToSubscription(s, payload);
    if (r.ok) sent++;
    if (r.gone) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      removed++;
    }
  }
  return { sent, removed };
}
