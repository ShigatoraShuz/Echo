import {z} from 'zod';
import { Router, raw } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../../shared/middleware/verified-ai-access.middleware.js";
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
  router.post('/journals/face/evaluate',authenticate,requireVerifiedAi,raw({type:['image/jpeg','image/png','image/webp'],limit:'2mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body)||!req.body.length){res.status(422).json({error:{message:'A camera frame is required.'}});return;}try{res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.evaluateFace(req.auth!.id,req.body)});}finally{req.body.fill(0);}});
  router.get('/journals/facial-history' ,authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.faceHistory(req.auth!.id)});});
  router.post('/journals/:journalId/face',authenticate,requireVerifiedAi,raw({type:['image/jpeg','image/png','image/webp'],limit:'2mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body)){res.status(422).json({error:{message:'A camera image is required.'}});return;}try{await service.submitFace(req.auth!.id,String(req.params.journalId),req.body);res.status(202).json({success:true,data:{accepted:true}});}finally{req.body.fill(0);}});
  router.get('/journals/:journalId/face',authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.faceStatus(req.auth!.id,String(req.params.journalId))});});
  router.get("/journal-support/check-in", authenticate, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: await service.supportCheckIn(req.auth!.id) });
  });
  router.get('/journals/:journalId/export',authenticate,async(req,res)=>{
    if(req.query.format!=='pdf'){res.status(400).json({success:false,error:{message:'Choose PDF export.'}});return;}
    const entry=await service.get(req.auth!.id,String(req.params.journalId));
    const {journalPdf}=await import('./journal-pdf.js');
    const bytes=await journalPdf(entry);
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="journal-${String(req.params.journalId).replace(/[^a-zA-Z0-9-]/g,'').slice(0,36)}.pdf"`);res.send(bytes);
  });
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
  router.post('/analysis-jobs/confirm-current-crisis',authenticate,requireVerifiedAi,endpointLimiter(10),async(req,res)=>{
    const input=z.strictObject({key:z.string().uuid(),ids:z.array(z.string().uuid()).max(200),steps:z.tuple([z.literal(true),z.literal(true),z.literal(true),z.literal(true)])}).parse(req.body);
    if(new Set(input.ids).size!==input.ids.length)throw Error('Duplicate pause identities');
    res.json({success:true,data:await service.confirmCurrentCrisisPauses(req.auth!.id,input.ids,input.key)});
  });
  router.get('/analysis-jobs/blocked-local',authenticate,requireVerifiedAi,async(req,res)=>{res.json({success:true,data:await service.blockedLocalReflections(req.auth!.id)});});
  router.post('/analysis-jobs/:jobId/confirm-continuation',authenticate,requireVerifiedAi,endpointLimiter(10),async(req,res)=>{
    const id=z.string().uuid().parse(req.params.jobId);
    const input=z.strictObject({key:z.string().uuid(),steps:z.tuple([z.literal(true),z.literal(true),z.literal(true),z.literal(true)])}).parse(req.body);
    res.json({success:true,data:await service.confirmLocalContinuation(req.auth!.id,id,input.key)});
  });
  router.post("/analysis-jobs/:jobId/safety-review", authenticate, controller.safetyReview);
  router.get("/journals/draft", authenticate, controller.getDraft);
  router.put("/journals/draft", authenticate, controller.saveDraft);
  router.delete("/journals/draft", authenticate, controller.deleteDraft);
  router.get("/journals/:journalId", authenticate, controller.get);
  router.get("/journals/:journalId/analysis-state", authenticate, controller.analysisAvailability);
  router.patch("/journals/:journalId", authenticate, controller.update);
  router.delete("/journals/:journalId", authenticate, controller.remove);
  router.post('/journals/:journalId/screening/retry',authenticate,requireVerifiedAi,async(req,res)=>{await service.retryScreening(req.auth!.id,String(req.params.journalId));res.json({success:true,data:{updated:true}});});
  router.post("/journals/:journalId/analyze", authenticate, requireVerifiedAi, controller.analyze);
  router.get("/journals/:journalId/analyses", authenticate, requireVerifiedAi, controller.analyses);
  return router;
}
