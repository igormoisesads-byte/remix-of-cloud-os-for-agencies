import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src?: string | null;
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
  eager?: boolean;
};

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlEncode(value: string) {
  let output = "";
  for (let i = 0; i < value.length; i += 3) {
    const a = value.charCodeAt(i);
    const b = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
    const c = i + 2 < value.length ? value.charCodeAt(i + 2) : 0;
    const triple = (a << 16) | (b << 8) | c;
    output += BASE64_ALPHABET[(triple >> 18) & 63];
    output += BASE64_ALPHABET[(triple >> 12) & 63];
    output += i + 1 < value.length ? BASE64_ALPHABET[(triple >> 6) & 63] : "=";
    output += i + 2 < value.length ? BASE64_ALPHABET[triple & 63] : "=";
  }
  return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function shouldProxyImage(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      (host === "cdn.clouddigital.com.br" && parsed.pathname.startsWith("/ads/")) ||
      host.endsWith(".fbcdn.net") ||
      host.endsWith(".fbcdn.com") ||
      host.includes("facebook.com")
    );
  } catch {
    return false;
  }
}

function displayUrl(url: string) {
  return shouldProxyImage(url) ? `/api/public/creative-image?u=${base64UrlEncode(url)}` : url;
}

/**
 * Miniatura de criativo com fallback: tenta a URL principal (R2), depois a
 * alternativa (CDN do Meta) e, se ambas falharem, mostra um placeholder.
 */
export function CreativeThumb({ src, fallbackSrc, alt = "", className = "w-full h-full object-cover", eager }: Props) {
  const candidates = Array.from(new Set([src, fallbackSrc].filter(Boolean) as string[]));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src, fallbackSrc]);

  const current = candidates[index];
  if (!current) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={displayUrl(current)}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
