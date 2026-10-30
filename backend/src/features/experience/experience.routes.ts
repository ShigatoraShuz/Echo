import { z } from "zod";
import { Router, raw } from "express";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../verification/verification.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import { createExperienceController } from "./experience.controller.js";
import type { ExperienceService } from "./experience.service.js";

export function createExperienceRouter(
  service: ExperienceService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
): Router {
  const controller = createExperienceController(service);
  const router = Router();

  // Buddy messages and grounding sessions carry AI inference and database
  // write costs, so they get a stricter budget than the global rate limit.
  const aiWriteLimiter = endpointLimiter(20);

  // Verified support resources are intentionally public. All personal routes
  // below this line require a valid Supabase access token.
  router.get("/support-resources", controller.supportResources);
  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  router.post('/buddy/voice/transcribe',authenticate,requireVerifiedAi,aiWriteLimiter,raw({type:'application/octet-stream',limit:'10mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body)||!req.body.length){res.status(422).json({error:{message:'Audio required'}});return;}const abort=new AbortController();res.on('close',()=>abort.abort());res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.transcribeVoice(req.auth!.id,req.body,abort.signal)});});
  router.post('/buddy/voice/speak',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{const input=z.object({text:z.string().min(1).max(12000)}).parse(req.body);const abort=new AbortController();res.on('close',()=>abort.abort());const result=await service.speakVoice(req.auth!.id,input.text,abort.signal);if(!result.audio)throw new Error('Missing generated audio');res.setHeader('Cache-Control','no-store');res.type('audio/wav').send(Buffer.from(result.audio,'base64'));});
  router.get("/dashboard", authenticate, controller.dashboard);
  router.get("/wellness", authenticate, controller.wellnessStatus);
  router.post("/wellness/phq8", authenticate, aiWriteLimiter, controller.saveAssessment);
  router.post("/wellness/support-prompt", authenticate, aiWriteLimiter, controller.claimSupportPrompt);
  router.get("/buddy/session", authenticate, requireVerifiedAi, controller.buddySession);
  router.get("/buddy/privacy", authenticate, requireVerifiedAi, controller.buddyPrivacy);
  router.post("/buddy/messages", authenticate, requireVerifiedAi, aiWriteLimiter, controller.sendBuddyMessage);
  router.get("/buddy/history", authenticate, requireVerifiedAi, controller.buddyHistory);
  router.post("/buddy/conversations", authenticate, requireVerifiedAi, aiWriteLimiter, controller.createBuddyConversation);
  router.get("/buddy/conversations/:id", authenticate, requireVerifiedAi, controller.buddyConversation);
  router.patch("/buddy/conversations/:id", authenticate, requireVerifiedAi, aiWriteLimiter, controller.renameBuddyConversation);
  router.delete("/buddy/conversations/:id", authenticate, requireVerifiedAi, aiWriteLimiter, controller.deleteBuddyConversation);
  router.put("/buddy/conversations/:id/pin", authenticate, requireVerifiedAi, aiWriteLimiter, controller.pinBuddyConversation);
  router.put('/buddy/conversations/:id/archive',authenticate,requireVerifiedAi,aiWriteLimiter,async(request,response)=>{const input=z.object({archived:z.boolean()}).parse(request.body);response.json({success:true,data:service.archiveLocal(request.auth!.id,String(request.params.id),input.archived)});});
  router.get("/insights/emotions", authenticate, controller.emotionInsights);
  router.post("/grounding/sessions", authenticate, aiWriteLimiter, controller.completeGrounding);
  router.get("/grounding/sessions", authenticate, controller.groundingHistory);
  router.delete('/local-data/analysis/:id',authenticate,async(request,response)=>{await service.cancelLocal(request.auth!.id,String(request.params.id));response.json({data:{cancelled:true}});});
  router.get('/local-data',authenticate,async(request,response)=>{if(!service.localBuddy)throw new Error('Local storage is disabled.');response.setHeader('Content-Disposition','attachment; filename="echo-local-data.json"');response.json(service.exportLocal(request.auth!.id));});
  router.delete('/local-data',authenticate,async(request,response)=>{service.clearLocal(request.auth!.id);response.json({data:{deleted:true}});});
  router.post('/local-data/analysis/:id/retry',authenticate,requireVerifiedAi,aiWriteLimiter,async(request,response)=>{await service.retryLocal(request.auth!.id,String(request.params.id));response.json({data:{queued:true}});});
  return router;
}
