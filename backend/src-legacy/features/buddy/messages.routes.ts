import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";
import { requireVerification } from "../../shared/middleware/require-verification";

const router = Router();

router.use(authenticate);
router.use(requireVerification);

router.get("/:conversationId/messages", async (req, res) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { page = "1", pageSize = "20" } = req.query;
  const { data, error } = await req.supabase
    .from("buddy_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range((Number(page) - 1) * Number(pageSize), Number(page) * Number(pageSize) - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/:conversationId/messages", async (req, res) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { content } = req.body;
  const { data: userMsg, error: userErr } = await req.supabase
    .from("buddy_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content })
    .select()
    .single();
  if (userErr) return res.status(500).json({ error: userErr.message });
  const { data: buddyMsg, error: buddyErr } = await req.supabase
    .from("buddy_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "buddy", content: "I hear you. Take a gentle breath and tell me more about what is present." })
    .select()
    .single();
  if (buddyErr) return res.status(500).json({ error: buddyErr.message });
  res.status(201).json({ data: { userMessage: userMsg, buddyMessage: buddyMsg } });
});

export default router;
