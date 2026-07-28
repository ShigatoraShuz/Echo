import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/profile", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("profiles")
    .select("display_name, timezone, theme_variant, theme_mode")
    .eq("id", userId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.patch("/profile", async (req, res) => {
  const userId = req.user!.id;
  const { display_name, timezone } = req.body;
  const { data, error } = await req.supabase
    .from("profiles")
    .update({ display_name, timezone })
    .eq("id", userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.get("/privacy", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("user_consents")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.patch("/privacy", async (req, res) => {
  const userId = req.user!.id;
  const { facial_analysis_enabled, crisis_support_visible } = req.body;
  const { data, error } = await req.supabase
    .from("user_consents")
    .update({ facial_analysis_enabled, crisis_support_visible })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
