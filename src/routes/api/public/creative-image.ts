import { createFileRoute } from "@tanstack/react-router";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function isAllowedImageSource(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "cdn.clouddigital.com.br") return true;
  if (host.endsWith(".fbcdn.net") || host.endsWith(".fbcdn.com")) return true;
  if (host === "facebook.com" || host.endsWith(".facebook.com")) return true;
  return false;
}

export const Route = createFileRoute("/api/public/creative-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const requestUrl = new URL(request.url);
          const encoded = requestUrl.searchParams.get("u") || "";
          if (!encoded) return new Response("Missing image", { status: 400 });

          const decoded = decodeBase64Url(encoded);
          const source = new URL(decoded);
          if (source.protocol !== "https:" || !isAllowedImageSource(source)) {
            return new Response("Image source not allowed", { status: 400 });
          }

          const upstream = await fetch(source.toString(), {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*",
              Referer: "https://www.facebook.com/",
            },
          });

          if (!upstream.ok || !upstream.body) {
            return new Response("Image unavailable", { status: upstream.status || 502 });
          }

          const contentType = upstream.headers.get("content-type") || "image/jpeg";
          if (!contentType.startsWith("image/")) {
            return new Response("Invalid image", { status: 415 });
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
          });
        } catch {
          return new Response("Image unavailable", { status: 400 });
        }
      },
    },
  },
});