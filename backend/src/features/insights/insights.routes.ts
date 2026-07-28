import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/summary", async (req, res) => {
  const userId = req.user!.id;
  const { data: entries } = await req.supabase
    .from("journals")
    .select("mood, emotions, risk_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  res.json({ data: { totalEntries: entries?.length ?? 0, summary: "Your emotional landscape shows a predominance of calm and neutral states." } });
});

router.get("/trends", async (req, res) => {
  const userId = req.user!.id;
  const { range = "30d" } = req.query;
  const { data } = await req.supabase
    .from("mood_entries")
    .select("mood, energy, created_at")
    .eq("user_id", userId);
  res.json({ data: data ?? [] });
});

export default router;
