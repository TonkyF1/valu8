import { corsHeaders, guard, json, adminClient } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const g = await guard(req, { feature: "claim", requireUser: true, perMinute: 10, ipPerHour: 60 });
    if (g.response) return g.response;
    const userId = g.userId;
    if (!userId) return json({ error: "Please sign in to continue." }, 401);
    const body = await req.json().catch(() => null);
    if (typeof body?.guestToken !== "string" || !/^[a-f0-9]{64}$/.test(body.guestToken)) {
      return json({ error: "Please refresh the page and try again." }, 400);
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.guestToken));
    const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const admin = adminClient();
    if (!admin) return json({ error: "We couldn't save your reports — please try again." }, 500);
    const { data: rows, error } = await admin.from("valuations").select("id, photo_urls")
      .eq("guest_token_hash", tokenHash).is("user_id", null).limit(50);
    if (error) { console.error("Guest claim lookup failed", error.message); return json({ error: "We couldn't save your reports — please try again." }, 500); }
    let claimed = 0;
    for (const row of rows ?? []) {
      const paths: string[] = [];
      const photos = Array.isArray(row.photo_urls) ? row.photo_urls : [];
      for (const path of photos) {
        if (typeof path !== "string") continue;
        if (!path.startsWith(`guest/${row.id}/`) || path.split("/").some((part) => part === "." || part === "..")) { paths.push(path); continue; }
        const basename = path.split("/").pop();
        if (!basename) { paths.push(path); continue; }
        const target = `${userId}/guest-${row.id}-${basename}`;
        try {
          const { error: moveError } = await admin.storage.from("vehicle-photos").move(path, target);
          if (moveError) { console.warn("Guest photo move failed", moveError.message); paths.push(path); }
          else paths.push(target);
        } catch (e) { console.warn("Guest photo move failed", e); paths.push(path); }
      }
      const { data: updated, error: updateError } = await admin.from("valuations")
        .update({ user_id: userId, guest_token_hash: null, photo_urls: paths })
        .eq("id", row.id).eq("guest_token_hash", tokenHash).is("user_id", null).select("id");
      if (updateError) { console.error("Guest claim update failed", updateError.message); return json({ error: "We couldn't save your reports — please try again." }, 500); }
      claimed += updated?.length ?? 0;
    }
    return json({ claimed });
  } catch (e) {
    console.error("claim-guest-valuations error", e);
    return json({ error: "We couldn't save your reports — please try again." }, 500);
  }
});