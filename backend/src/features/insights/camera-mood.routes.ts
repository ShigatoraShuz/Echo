import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/camera-settings", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("user_preferences")
    .select("camera_enabled, camera_interval_minutes, facial_analysis_consent")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") return res.status(500).json({ error: error.message });
  res.json({ data: data ?? { camera_enabled: false, camera_interval_minutes: 30, facial_analysis_consent: false } });
});

router.put("/camera-settings", async (req, res) => {
  const userId = req.user!.id;
  const { camera_enabled, camera_interval_minutes, facial_analysis_consent } = req.body;
  const { data, error } = await req.supabase
    .from("user_preferences")
    .upsert({ user_id: userId, camera_enabled, camera_interval_minutes, facial_analysis_consent })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/mood-entries", async (req, res) => {
  const userId = req.user!.id;
  const { mood, energy, notes } = req.body;
  const { data, error } = await req.supabase
    .from("mood_entries")
    .insert({ user_id: userId, mood, energy, notes })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.get("/mood-entries", async (req, res) => {
  const userId = req.user!.id;
  const { range = "7d" } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(range));
  const { data, error } = await req.supabase
    .from("mood_entries")
    .select("mood, energy, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
