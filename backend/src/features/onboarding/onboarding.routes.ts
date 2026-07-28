import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/consent", async (req, res) => {
  const userId = req.user!.id;
  const { terms, privacy, dataProcessing, aiInformation, journalAnalysis } = req.body;
  const { data, error } = await req.supabase
    .from("user_consents")
    .upsert({
      user_id: userId,
      terms_accepted: terms,
      privacy_accepted: privacy,
      data_processing_accepted: dataProcessing,
      ai_information_acknowledged: aiInformation,
      journal_analysis_consent: journalAnalysis,
      consent_version: "2026-07-28",
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/profile", async (req, res) => {
  const userId = req.user!.id;
  const { display_name, goals, buddy_tone } = req.body;
  const { data, error } = await req.supabase
    .from("profiles")
    .upsert({ id: userId, display_name, goals, buddy_tone_preference: buddy_tone, onboarding_completed: false })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

router.post("/complete", async (req, res) => {
  const userId = req.user!.id;
  const { data, error } = await req.supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
