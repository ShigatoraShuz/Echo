import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/export", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("export_requests")
    .insert({ user_id: userId, status: "pending" })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.get("/export/status", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("export_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") return res.status(500).json({ error: error.message });
  res.json({ data: data ?? { status: "none" } });
});

router.post("/deletion", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("deletion_requests")
    .insert({ user_id: userId, status: "pending", scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.post("/deletion/cancel", async (req, res) => {
  const userId = req.user!.id;
  const { error } = await req.supabase
    .from("deletion_requests")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: { status: "cancelled" } });
});

export default router;
