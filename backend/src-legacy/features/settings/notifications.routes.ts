import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/notifications", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") return res.status(500).json({ error: error.message });
  res.json({ data: data ?? {} });
});

router.put("/notifications", async (req, res) => {
  const userId = req.user!.id;
  const prefs = req.body;
  const { data, error } = await req.supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...prefs })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.get("/trusted-contacts", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("trusted_contacts")
    .select("*")
    .eq("user_id", userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/trusted-contacts", async (req, res) => {
  const userId = req.user!.id;
  const { contact_name, contact_email, contact_phone, relationship } = req.body;
  const { data, error } = await req.supabase
    .from("trusted_contacts")
    .insert({ user_id: userId, contact_name, contact_email, contact_phone, relationship })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.delete("/trusted-contacts/:id", async (req, res) => {
  const userId = req.user!.id;
  const { error } = await req.supabase
    .from("trusted_contacts")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);
  if (error) return res.status(404).json({ error: "Contact not found" });
  res.status(204).send();
});

export default router;
