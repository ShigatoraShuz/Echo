import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/sessions", async (req, res) => {
  const userId = req.user!.id;
  const { type, duration, pace } = req.body;
  const { data, error } = await req.supabase
    .from("grounding_sessions")
    .insert({ user_id: userId, exercise_type: type, duration_seconds: duration, pace })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.get("/history", async (req, res) => {
  const userId = req.user!.id;
  const { limit = "10" } = req.query;
  const { data, error } = await req.supabase
    .from("grounding_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Number(limit));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
