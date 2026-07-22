import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AwsClient } from "aws4fetch";
import { z } from "zod";

const InputSchema = z.object({
  folder: z.string().min(1).max(64).regex(/^[a-z0-9/_-]+$/i),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
});

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export const createR2UploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_URL;

    if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicBase) {
      throw new Error("R2 não configurado (verifique R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL).");
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const uid = crypto.randomUUID();
    const key = `${data.folder}/${yyyy}/${mm}/${uid}-${safeName(data.filename)}`;

    const client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const objectUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURI(key)}`;

    // Sign as query-string (presigned URL) valid for 10 min.
    const signed = await client.sign(
      new Request(`${objectUrl}?X-Amz-Expires=600`, {
        method: "PUT",
        headers: { "Content-Type": data.contentType },
      }),
      { aws: { signQuery: true } }
    );

    return {
      uploadUrl: signed.url,
      publicUrl: `${publicBase.replace(/\/$/, "")}/${key}`,
      key,
      userId: context.userId,
    };
  });
