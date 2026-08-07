import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const action = process.argv.includes("--revoke") ? "revoke" : "grant";

if (!email || !email.includes("@")) {
  console.error(
    "Usage: npm run admin:verification -- person@example.com [--revoke]",
  );
  process.exitCode = 1;
} else {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exitCode = 1;
  } else {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let user = null;
    for (let page = 1; page <= 50 && !user; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw error;
      user = data.users.find(
        (candidate) => candidate.email?.toLowerCase() === email,
      );
      if (data.users.length < 1000) break;
    }

    if (!user) {
      console.error(`No authenticated user was found for ${email}.`);
      process.exitCode = 1;
    } else {
      const { error } = await admin.from("verification_admins").upsert(
        {
          user_id: user.id,
          is_active: action === "grant",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      console.log(
        action === "grant"
          ? `Verification administrator access granted to ${email}.`
          : `Verification administrator access revoked for ${email}.`,
      );
    }
  }
}
