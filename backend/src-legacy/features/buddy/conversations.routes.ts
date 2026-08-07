import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";
import { requireVerification } from "../../shared/middleware/require-verification";

const router = Router();

router.use(authenticate);
router.use(requireVerification);

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("buddy_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { title, initialMood } = req.body;
  const { data, error } = await req.supabase
    .from("buddy_conversations")
    .insert({ user_id: userId, title, mood: initialMood })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

router.patch("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { title } = req.body;
  const { data, error } = await req.supabase
    .from("buddy_conversations")
    .update({ title })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data });
});

router.delete("/:id", async (req, res) => {
  const userId = req.user!.id;
  const { error } = await req.supabase
    .from("buddy_conversations")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);
  if (error) return res.status(404).json({ error: "Conversation not found" });
  res.status(204).send();
});

export default router;
