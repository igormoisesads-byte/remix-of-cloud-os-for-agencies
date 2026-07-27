import { AwsClient } from "aws4fetch";

let _client: AwsClient | null = null;
function client() {
  if (_client) return _client;
  _client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  return _client;
}

/**
 * Baixa uma URL externa (ex.: CDN do Meta, que expira em horas)
 * e armazena no R2, devolvendo a URL pública permanente.
 * Idempotente: se `sourceUrl` já está no R2 devolve como está.
 * Se o R2 não estiver configurado, devolve `sourceUrl` inalterado.
 */
export async function mirrorUrlToR2(
  sourceUrl: string | null | undefined,
  objectKey: string,
): Promise<string | null> {
  if (!sourceUrl) return null;
  const publicBase = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!publicBase || !endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return sourceUrl;
  }
  if (sourceUrl.startsWith(publicBase)) return sourceUrl;

  try {
    const resp = await fetch(sourceUrl, {
      headers: {
        // A CDN do Meta devolve 403 pra clientes sem user-agent/referer.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
        Referer: "https://www.facebook.com/",
      },
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const body = await resp.arrayBuffer();
    // Guarda: não subir arquivos gigantes (evita estourar em vídeo)
    if (body.byteLength > 15 * 1024 * 1024) return null;

    const objectUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURI(objectKey)}`;
    const putResp = await client().fetch(objectUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      body,
    });
    if (!putResp.ok) return null;
    return `${publicBase.replace(/\/$/, "")}/${objectKey}`;
  } catch {
    return null;
  }
}
