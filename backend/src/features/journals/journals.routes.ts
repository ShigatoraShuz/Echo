import { Router, raw } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../verification/verification.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import type { JournalService } from "./journals.service.js";
import { createJournalsController } from "./journals.controller.js";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";

export function createJournalsRouter(
  service: JournalService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
): Router {
  const controller = createJournalsController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  const writeLimit = endpointLimiter(30);
  router.use(["/journals", "/analysis-jobs", "/buddy/handoffs", "/support-contact-requests"], authenticate, (req, res, next) => {
    if (["GET", "HEAD"].includes(req.method)) return next();
    return writeLimit(req, res, next);
  });
  router.get('/journals/facial-history',authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.faceHistory(req.auth!.id)});});
  router.post('/journals/:journalId/face',authenticate,requireVerifiedAi,raw({type:['image/jpeg','image/png','image/webp'],limit:'2mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body)){res.status(422).json({error:{message:'A camera image is required.'}});return;}try{await service.submitFace(req.auth!.id,String(req.params.journalId),req.body);res.status(202).json({success:true,data:{accepted:true}});}finally{req.body.fill(0);}});
  router.get('/journals/:journalId/face',authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.faceStatus(req.auth!.id,String(req.params.journalId))});});
  router.get("/journals", authenticate, controller.list);
  router.post("/journals", authenticate, controller.create);
  router.get("/journals/draft/images", authenticate, controller.listDraftImages);
  router.put("/journals/draft/images/:imageId", authenticate, raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), controller.uploadDraftImage);
  router.delete("/journals/draft/images/:imageId", authenticate, controller.removeDraftImage);
  router.post("/journals/:journalId/draft-images/attach", authenticate, controller.attachDraftImages);
  router.put("/journals/:journalId/images/:imageId", authenticate, raw({type:["image/jpeg","image/png","image/webp"],limit:"5mb"}), controller.uploadImage);
  router.get("/analysis-jobs/:jobId/status", authenticate, controller.status);
  router.get("/dashboard/insights", authenticate, controller.dashboardInsights);
  router.post("/support-resources/resolve", authenticate, controller.supportResources);
  router.post("/support-contact-requests", authenticate, controller.supportContact);
  router.post("/buddy/handoffs", authenticate, controller.buddyHandoff);
  router.get("/buddy/handoffs/:handoffId", authenticate, controller.getBuddyHandoff);
  router.post("/analysis-jobs/:jobId/safety-review", authenticate, controller.safetyReview);
  router.get("/journals/draft", authenticate, controller.getDraft);
  router.put("/journals/draft", authenticate, controller.saveDraft);
  router.delete("/journals/draft", authenticate, controller.deleteDraft);
  router.get("/journals/:journalId", authenticate, controller.get);
  router.patch("/journals/:journalId", authenticate, controller.update);
  router.delete("/journals/:journalId", authenticate, controller.remove);
  router.post('/journals/:journalId/screening/retry',authenticate,requireVerifiedAi,async(req,res)=>{await service.retryScreening(req.auth!.id,String(req.params.journalId));res.json({success:true,data:{updated:true}});});
  router.post("/journals/:journalId/analyze", authenticate, requireVerifiedAi, controller.analyze);
  router.get("/journals/:journalId/analyses", authenticate, requireVerifiedAi, controller.analyses);
  return router;
}
