import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-:]+$/);

/** Fetch the most-recent encrypted session blob for a profile. */
export const getProfileSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ profileId: profileIdSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profile_sessions")
      .select("encrypted_blob, blob_iv, device_id, updated_at")
      .eq("user_id", userId)
      .eq("profile_id", data.profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/** Push (upsert) an encrypted session blob for a profile. */
export const putProfileSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        profileId: profileIdSchema,
        // Base64-encoded ciphertext + IV (kept as strings for transport).
        encryptedBlob: z.string().min(1).max(8 * 1024 * 1024),
        blobIv: z.string().min(1).max(256),
        deviceId: z.string().min(1).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // PostgREST accepts bytea as `\x<hex>` literal in JSON.
    const toHex = (b64: string) => "\\x" + Buffer.from(b64, "base64").toString("hex");
    const blob = toHex(data.encryptedBlob);
    const iv = toHex(data.blobIv);
    const { error } = await supabase
      .from("profile_sessions")
      .upsert(
        {
          user_id: userId,
          profile_id: data.profileId,
          encrypted_blob: blob,
          blob_iv: iv,
          device_id: data.deviceId,
        },
        { onConflict: "user_id,profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** List all profile ids that have a synced session. */
export const listProfileSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profile_sessions")
      .select("profile_id, device_id, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });