import { Router } from "express";
import buddyConversationsRouter from "../features/buddy/conversations.routes";
import buddyMessagesRouter from "../features/buddy/messages.routes";
import insightsRouter from "../features/insights/insights.routes";
import cameraMoodRouter from "../features/insights/camera-mood.routes";
import groundingRouter from "../features/grounding/grounding.routes";
import profileSettingsRouter from "../features/settings/profile-settings.routes";
import notificationsRouter from "../features/settings/notifications.routes";
import dataManagementRouter from "../features/settings/data-management.routes";
import onboardingRouter from "../features/onboarding/onboarding.routes";
import journalRouter from "../features/journal/journal.routes";

const router = Router();

router.use("/buddy/conversations", buddyConversationsRouter);
router.use("/buddy/messages", buddyMessagesRouter);
router.use("/insights", insightsRouter);
router.use("/insights", cameraMoodRouter);
router.use("/grounding", groundingRouter);
router.use("/settings", profileSettingsRouter);
router.use("/settings", notificationsRouter);
router.use("/settings", dataManagementRouter);
router.use("/onboarding", onboardingRouter);
router.use("/journal", journalRouter);

export default router;
