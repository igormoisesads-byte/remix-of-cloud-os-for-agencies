import { createFileRoute } from "@tanstack/react-router";
import { AwsClient } from "aws4fetch";

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export const Route = createFileRoute("/api/r2-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Auth: require a supabase bearer token
          const auth = request.headers.get("authorization") || "";
          if (!auth.toLowerCase().startsWith("bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401, headers: { "Content-Type": "application/json" },
            });
          }
          const token = auth.slice(7).trim();
          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!supaUrl || !supaKey) {
            return new Response(JSON.stringify({ error: `Variáveis ausentes: ${[!supaUrl && "SUPABASE_URL", !supaKey && "SUPABASE_PUBLISHABLE_KEY"].filter(Boolean).join(", ")}` }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          const meResp = await fetch(`${supaUrl}/auth/v1/user`, {
            headers: { apikey: supaKey, Authorization: `Bearer ${token}` },
          });
          if (!meResp.ok) {
            return new Response(JSON.stringify({ error: "Invalid session" }), {
              status: 401, headers: { "Content-Type": "application/json" },
            });
          }

          const accessKeyId = process.env.R2_ACCESS_KEY_ID;
          const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
          const endpoint = process.env.R2_ENDPOINT;
          const bucket = process.env.R2_BUCKET;
          const publicBase = process.env.R2_PUBLIC_URL;
          const missing = Object.entries({
            R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey,
            R2_ENDPOINT: endpoint, R2_BUCKET: bucket, R2_PUBLIC_URL: publicBase,
          }).filter(([, v]) => !v).map(([k]) => k);
          if (missing.length || !accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicBase) {
            return new Response(JSON.stringify({ error: `R2 não configurado. Variáveis ausentes: ${missing.join(", ")}` }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }

          const folderRaw = request.headers.get("x-folder") || "chat/misc";
          const filenameRaw = request.headers.get("x-filename") || "file.bin";
          const contentType = request.headers.get("content-type") || "application/octet-stream";

          if (!/^[a-z0-9/_-]+$/i.test(folderRaw)) {
            return new Response(JSON.stringify({ error: "invalid folder" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          const now = new Date();
          const yyyy = now.getUTCFullYear();
          const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
          const uid = crypto.randomUUID();
          const key = `${folderRaw}/${yyyy}/${mm}/${uid}-${safeName(filenameRaw)}`;

          const client = new AwsClient({
            accessKeyId, secretAccessKey, service: "s3", region: "auto",
          });
          const objectUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURI(key)}`;
          const body = await request.arrayBuffer();

          const putResp = await client.fetch(objectUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body,
          });
          if (!putResp.ok) {
            const txt = await putResp.text().catch(() => "");
            return new Response(JSON.stringify({ error: `R2 ${putResp.status}: ${txt.slice(0, 200)}` }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }

          const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;
          return Response.json({ url: publicUrl, key });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
