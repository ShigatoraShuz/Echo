import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { search, mood, sort = "desc", page = "1", limit = "20", startDate, endDate } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let query = req.supabase
    .from("journals")
    .select("*", { count: "exact" })
    .eq("user_id", userId);
  if (search) query = query.ilike("content", `%${search}%`);
  if (mood) query = query.eq("mood", mood);
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);
  query = query.order("created_at", { ascending: sort === "asc" }).range(offset, offset + Number(limit) - 1);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, meta: { total: count, page: Number(page), limit: Number(limit) } });
});

router.get("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("journals")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .single();
  if (error) return res.status(404).json({ error: "Journal entry not found" });
  res.json({ data });
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { title, content, mood, emotions, energy, is_private } = req.body;
  const { data, error } = await req.supabase
    .from("journals")
    .insert({ user_id: userId, title, content, mood, emotions, energy, is_private })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.put("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { title, content, mood, emotions, energy, is_private } = req.body;
  const { data, error } = await req.supabase
    .from("journals")
    .update({ title, content, mood, emotions, energy, is_private, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) return res.status(404).json({ error: "Journal entry not found" });
  res.json({ data });
});

router.delete("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { error } = await req.supabase
    .from("journals")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);
  if (error) return res.status(404).json({ error: "Journal entry not found" });
  res.status(204).send();
});

export default router;
