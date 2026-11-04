// Send push notification 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// VAPID keys from environment
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

// ─── Native Web Push helpers (no npm web-push needed) ───

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createVapidJwt(endpoint: string): Promise<{ token: string; publicKey: string }> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:support@momnest.com",
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key (raw base64url-encoded 32-byte EC private key)
  const rawPrivateKey = base64UrlDecode(VAPID_PRIVATE_KEY);
  const rawPublicKey = base64UrlDecode(VAPID_PUBLIC_KEY);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(rawPublicKey.slice(1, 33)),
    y: base64UrlEncode(rawPublicKey.slice(33, 65)),
    d: base64UrlEncode(rawPrivateKey),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER encoded
    let offset = 2;
    const rLen = sigBytes[offset + 1];
    offset += 2;
    r = sigBytes.slice(offset, offset + rLen);
    offset += rLen;
    const sLen = sigBytes[offset + 1];
    offset += 2;
    s = sigBytes.slice(offset, offset + sLen);

    // Trim leading zeros and pad to 32 bytes
    while (r.length > 32) r = r.slice(1);
    while (s.length > 32) s = s.slice(1);
    while (r.length < 32) r = new Uint8Array([0, ...r]);
    while (s.length < 32) s = new Uint8Array([0, ...s]);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const token = `${unsignedToken}.${base64UrlEncode(rawSig)}`;
  return { token, publicKey: VAPID_PUBLIC_KEY };
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payloadStr: string
): Promise<Response> {
  const { token, publicKey } = await createVapidJwt(subscription.endpoint);

  // Encrypt payload using Web Push encryption (aes128gcm)
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

  const subscriberPubKey = await crypto.subtle.importKey(
    "raw",
    base64UrlDecode(subscription.keys.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPubKey },
    localKeyPair.privateKey,
    256
  );

  const authSecret = base64UrlDecode(subscription.keys.auth);
  const enc = new TextEncoder();

  const subscriberPubRaw = base64UrlDecode(subscription.keys.p256dh);
  const infoAuth = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...subscriberPubRaw,
    ...new Uint8Array(localPublicKeyRaw),
  ]);

  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: infoAuth },
    ikmKey,
    256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") },
    prkKey,
    128
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") },
    prkKey,
    96
  );

  const aesKey = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const paddedPayload = new Uint8Array([...enc.encode(payloadStr), 2]); // delimiter byte
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, aesKey, paddedPayload);

  const localPubBytes = new Uint8Array(localPublicKeyRaw);
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPubBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPubBytes.length;
  header.set(localPubBytes, 21);

  const body = new Uint8Array(header.length + encrypted.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(encrypted), header.length);

  return await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
}

// ─── Main handler ───

interface ProfileWithToken {
  id: string;
  fcm_token: string | null;
}

// Keep FCM logic for Capacitor app
async function getFCMAccessToken(): Promise<string | null> {
  try {
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) return null;
    const serviceAccount = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const jwtPayload = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      new TextEncoder().encode(serviceAccount.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${jwtPayload}`));
    const jwt = `${header}.${jwtPayload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenResponse.json();
    return tokenData.access_token ?? null;
  } catch (err) {
    console.error("Failed to get FCM access token:", err);
    return null;
  }
}

/** Where a tap on the notification should land inside the app. */
function buildNotificationUrl(type: string, data: Record<string, any>): string {
  if (data?.circle_id) return `/circle/${data.circle_id}`;
  if (data?.conversationId || data?.conversation_id) return "/messages";
  if (type === "helper_request" || type === "sos_alert") return "/safe";
  return "/notifications";
}

// Emergency-type notifications stay on screen until the user interacts
const URGENT_TYPES = ["helper_request", "sos_alert"];

/**
 * Deliver a notification to every device of the target users:
 * Web Push for browser/PWA subscriptions, FCM for native tokens (only when
 * Firebase secrets are configured — the hook for future Capacitor builds).
 */
async function deliverToUsers(
  supabase: ReturnType<typeof createClient>,
  targetUserIds: string[],
  title: string,
  body: string,
  data: Record<string, any>,
  notificationType = "system"
): Promise<string[]> {
  let webPushResults: string[] = [];

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    const { data: webSubs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (webSubs?.length) {
      const pushPayload = JSON.stringify({
        title,
        body,
        data: { ...data, url: data?.url || buildNotificationUrl(notificationType, data) },
        // Same-type notifications replace each other in the tray instead of piling up
        tag: notificationType,
        requireInteraction: URGENT_TYPES.includes(notificationType),
        icon: "/icon-192.png",
        badge: "/badge-72.png",
      });

      const results = await Promise.allSettled(
        webSubs.map(async (sub) => {
          try {
            const res = await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload
            );
            if (res.status === 410 || res.status === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              return `Removed stale subscription ${sub.id}`;
            }
            if (!res.ok) {
              const errText = await res.text();
              return `Push failed (${res.status}): ${errText}`;
            }
            return `Push sent to ${sub.id}`;
          } catch (err) {
            return `Error: ${err.message}`;
          }
        })
      );
      webPushResults = results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));
    }
  }

  // FCM branch — inert until FIREBASE_* secrets exist (future native apps)
  const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const accessToken = await getFCMAccessToken();
  if (accessToken && firebaseProjectId) {
    const { data: profilesWithTokens } = await supabase
      .from("profiles")
      .select("id, fcm_token")
      .in("id", targetUserIds)
      .not("fcm_token", "is", null);

    if (profilesWithTokens?.length) {
      const fcmUrl = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;
      await Promise.allSettled(
        (profilesWithTokens as ProfileWithToken[])
          .filter((p) => p.fcm_token && !p.fcm_token.startsWith("web_"))
          .map((profile) =>
            fetch(fcmUrl, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                message: {
                  token: profile.fcm_token,
                  notification: { title, body },
                  data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
                },
              }),
            })
          )
      );
    }
  }

  return webPushResults;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const payload = await req.json();

    // ── Deliver-only mode: fired by the DB trigger on push_notifications ──
    // The request carries only a row id; title/body come from the row itself,
    // so callers can't forge content. The atomic delivered_at claim makes
    // duplicate or replayed calls harmless.
    const notificationId =
      payload.notification_id ??
      (payload.table === "push_notifications" ? payload.record?.id : null);

    if (notificationId) {
      const { data: claimed } = await supabase
        .from("push_notifications")
        .update({ delivered_at: new Date().toISOString() })
        .eq("id", notificationId)
        .is("delivered_at", null)
        .select()
        .maybeSingle();

      if (!claimed) {
        return new Response(JSON.stringify({ skipped: "already delivered or unknown id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webPushResults = await deliverToUsers(
        supabase,
        [claimed.user_id],
        claimed.title,
        claimed.body,
        (claimed.data as Record<string, any>) ?? {},
        claimed.notification_type ?? "system"
      );

      return new Response(JSON.stringify({ success: true, webPushResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserIds: string[] = [];
    let title = "New Notification";
    let body = "You have a new update!";
    let notificationType = "system";
    let data: Record<string, any> = {};

    if (payload.type === "INSERT" && payload.table && payload.record) {
      if (payload.table === "follows") {
        targetUserIds = [payload.record.following_id];
        notificationType = "follow";
        const { data: prof } = await supabase.from("profiles").select("name").eq("id", payload.record.follower_id).single();
        title = "New Follower";
        body = `${prof?.name || "Someone"} started following you!`;
      } else if (payload.table === "messages") {
        const senderId = payload.record.sender_id;
        const convId = payload.record.conversation_id;
        notificationType = "message";
        data = { conversationId: convId };
        const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", convId).neq("user_id", senderId);
        if (members?.length) targetUserIds = [members[0].user_id];
        const { data: prof } = await supabase.from("profiles").select("name").eq("id", senderId).single();
        title = `New message from ${prof?.name || "Someone"}`;
        body = payload.record.content;
      } else {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      title = payload.title || title;
      body = payload.body || body;
      notificationType = payload.notificationType || notificationType;
      data = payload.data || {};
      if (payload.userId) targetUserIds = [payload.userId];
      else if (payload.userIds) targetUserIds = payload.userIds;
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Producing modes only insert rows — the on_push_notification_created
    // trigger invokes this function back in deliver-only mode, so a row insert
    // from ANY producer (client, RPC, another function) reaches devices.
    const { error: insertError } = await supabase.from("push_notifications").insert(
      targetUserIds.map((userId) => ({
        user_id: userId,
        notification_type: notificationType,
        title,
        body,
        data,
      }))
    );
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, queued: targetUserIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
