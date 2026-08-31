/** Server-only bootstrap. No passwords, user metadata roles, or legacy public tables. */
export async function provisionVerificationAdmin(client, email, action = "check") {
  email = email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid account email is required.");
  if (!["check", "grant", "revoke"].includes(action)) throw new Error("Choose check, grant, or revoke.");
  let user = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Account lookup failed. Check the server's Supabase configuration.");
    user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) break;
  }
  if (!user)
    throw new Error(
      "No ECHO account matches that email. Create and verify the account through ECHO signup first; do not use a shared default password.",
    );
  const table = client.schema("verification_service").from("verification_admins");
  const before = await table.select("user_id,is_active").eq("user_id", user.id).maybeSingle();
  if (before.error) throw new Error("The canonical administrator table could not be read. No role was changed.");
  if (action === "check") return { userId: user.id, email, active: before.data?.is_active === true, changed: false };
  if (action === "grant" && !user.email_confirmed_at)
    throw new Error("Verify this account's email before granting administrator access.");
  const active = action === "grant";
  if (before.data?.is_active === active || (!before.data && !active))
    return { userId: user.id, email, active, changed: false };
  const result = await client
    .schema("verification_service")
    .from("verification_admins")
    .upsert({ user_id: user.id, is_active: active }, { onConflict: "user_id" });
  if (result.error) throw new Error("Administrator access could not be saved.");
  const verified = await client
    .schema("verification_service")
    .from("verification_admins")
    .select("user_id,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (verified.error || verified.data?.is_active !== active)
    throw new Error("The role write could not be verified. Run --check before retrying.");
  return { userId: user.id, email, active, changed: true };
}
