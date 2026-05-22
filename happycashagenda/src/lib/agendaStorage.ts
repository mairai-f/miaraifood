import { supabase } from "@/integrations/supabase/client";

export async function uploadAgendaBrandingImage(
  ownerUserId: string,
  file: File,
  kind: "logo" | "hero" | "about" | "team" | "location",
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${ownerUserId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("agenda-branding").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    return { url: null as string | null, error: error.message };
  }

  const { data } = supabase.storage.from("agenda-branding").getPublicUrl(path);
  return { url: data.publicUrl, error: null as string | null };
}
