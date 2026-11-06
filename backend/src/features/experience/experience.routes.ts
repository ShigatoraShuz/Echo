import type {JournalService} from '../journals/journals.service.js';
import {NotFoundError,ValidationError} from '../../shared/errors/app-error.js';
import { z } from "zod";
import { Router, raw } from "express";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../../shared/middleware/verified-ai-access.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import { createExperienceController } from "./experience.controller.js";
import type { ExperienceService } from "./experience.service.js";

export function createExperienceRouter(
  service: ExperienceService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
  journalService?:JournalService,
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
  const leaseActor=(profile:unknown)=>{if(profile==='journal'){if(!journalService)throw new NotFoundError('Journal runtime unavailable.');return journalService;}if(profile&&profile!=='buddy_chat')throw new ValidationError();return service;};
  const leaseSession=(req:import('express').Request)=>{if(!req.auth?.sessionId)throw new ValidationError({session:['A verified session is required.']});return req.auth.sessionId;};
  const leaseAction=async<T>(fn:()=>T):Promise<Awaited<T>>=>{try{return await fn();}catch(error){if((error as Error).message==='RUNTIME_LEASE_NOT_FOUND')throw new NotFoundError('Runtime lease unavailable.');throw error;}};
  router.post('/ai/runtime/leases',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{
    const input=z.object({profile:z.enum(['buddy_chat','journal']),clientInstanceId:z.string().uuid()}).strict().parse(req.body);
    const lease=await leaseActor(input.profile).acquireModelLease(req.auth!.id,leaseSession(req),input.clientInstanceId);res.status(202).json({success:true,data:lease});
  });
  router.get('/ai/runtime/leases/:leaseId',authenticate,requireVerifiedAi,async(req,res)=>{res.json({success:true,data:await leaseAction(()=>leaseActor(req.query.profile).modelLeaseStatus(req.auth!.id,leaseSession(req),String(req.params.leaseId)))});});
  router.put('/ai/runtime/leases/:leaseId',authenticate,requireVerifiedAi,async(req,res)=>{res.json({success:true,data:await leaseAction(()=>leaseActor(req.query.profile).heartbeatModelLease(req.auth!.id,leaseSession(req),String(req.params.leaseId)))});});
  router.delete('/ai/runtime/leases/:leaseId',authenticate,async(req,res)=>{res.json({success:true,data:await leaseAction(()=>leaseActor(req.query.profile).releaseModelLease(req.auth!.id,leaseSession(req),String(req.params.leaseId)))});});
  router.post('/buddy/runtime/unload',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{res.json({success:true,data:await service.unloadBuddyRuntime(req.auth!.id)});});
  router.get('/buddy/runtime',authenticate,requireVerifiedAi,(_req,res)=>{res.json({success:true,data:service.buddyRuntimeStatus()});});
  router.post('/buddy/runtime/prepare',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{if(req.body&&Object.keys(req.body).length)throw Error('Preparation accepts no draft text');res.status(202).json({success:true,data:await service.requestBuddyPreparation(req.auth!.id)});});
  router.post('/buddy/voice/sessions',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{if(!service.realtime){res.status(503).json({error:{code:'TALK_DISABLED',message:'Experimental Talk is disabled.'}});return;}res.setHeader('Cache-Control','no-store');res.status(201).json({success:true,data:await service.realtime.create(req.auth!.id,req.auth!.accessToken!,req.body)});});
  router.post('/buddy/voice/sessions/:sessionId/refresh',authenticate,requireVerifiedAi,async(req,res)=>{if(!service.realtime){res.status(503).end();return;}res.setHeader('Cache-Control','no-store');res.json({success:true,data:await service.realtime.refresh(req.auth!.id,String(req.params.sessionId),req.auth!.accessToken!)});});
  router.delete('/buddy/voice/sessions/:sessionId',authenticate,async(req,res)=>{await service.realtime?.end(req.auth!.id,String(req.params.sessionId));res.json({success:true,data:{closed:true}});});
  router.post('/buddy/voice/jobs',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{const input=z.object({kind:z.enum(['speak','transcribe'])}).strict().parse(req.body);res.setHeader('Cache-Control','no-store');res.status(202).json({success:true,data:await service.createVoiceOperation(req.auth!.id,input.kind)});});
  router.get('/buddy/voice/jobs/:id',authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({success:true,data:service.voiceOperationStatus(req.auth!.id,z.string().uuid().parse(req.params.id))});});
  router.get('/buddy/voice/jobs/:id/result',authenticate,requireVerifiedAi,async(req,res)=>{res.setHeader('Cache-Control','no-store');const output=service.voiceOperationResult(req.auth!.id,z.string().uuid().parse(req.params.id));if(output.audio)res.type('audio/wav').send(Buffer.from(output.audio,'base64'));else res.json({success:true,data:output});});
  router.delete('/buddy/voice/jobs/:id',authenticate,async(req,res)=>{await service.cancelVoiceOperation(req.auth!.id,z.string().uuid().parse(req.params.id));res.json({success:true,data:{cancelled:true}});});
  router.post('/buddy/voice/transcribe' ,authenticate,requireVerifiedAi,aiWriteLimiter,raw({type:'application/octet-stream',limit:'10mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body)||!req.body.length){res.status(422).json({error:{message:'Audio required'}});return;}res.setHeader('Cache-Control','no-store');if(req.query.operationId){const id=z.string().uuid().parse(req.query.operationId);try{res.status(202).json({success:true,data:await service.submitVoiceOperation(req.auth!.id,id,'transcribe',{task:'transcribe',audio:req.body.toString('base64'),audioFormat:'encoded'})});}finally{req.body.fill(0);}return;}const abort=new AbortController();res.on('close',()=>abort.abort());res.json({success:true,data:await service.transcribeVoice(req.auth!.id,req.body,abort.signal)});});
  router.post('/buddy/voice/speak',authenticate,requireVerifiedAi,aiWriteLimiter,async(req,res)=>{const input=z.object({text:z.string().min(1).max(12000)}).parse(req.body);res.setHeader('Cache-Control','no-store');if(req.query.operationId){res.status(202).json({success:true,data:await service.submitVoiceOperation(req.auth!.id,z.string().uuid().parse(req.query.operationId),'speak',{task:'speak',text:input.text})});return;}const abort=new AbortController();res.on('close',()=>abort.abort());const result=await service.speakVoice(req.auth!.id,input.text,abort.signal);if(!result.audio)throw new Error('Missing generated audio');res.type('audio/wav').send(Buffer.from(result.audio,'base64'));});
  router.get("/dashboard", authenticate, controller.dashboard);
  router.get("/wellness", authenticate, controller.wellnessStatus);
  router.post("/wellness/phq8", authenticate, aiWriteLimiter, controller.saveAssessment);
  router.post("/wellness/phq8/self-report", authenticate, aiWriteLimiter, controller.saveSelfReport);
  router.post("/wellness/support-prompt", authenticate, aiWriteLimiter, controller.claimSupportPrompt);
  router.get("/buddy/session", authenticate, requireVerifiedAi, controller.buddySession);
  router.get("/buddy/privacy", authenticate, requireVerifiedAi, controller.buddyPrivacy);
  router.get("/buddy/access", authenticate, async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const access = await verificationService.getAiAccessStatus(request.auth!.id);
    const privacy = access.canAccessAi ? await service.buddyPrivacy(request.auth!.id) : null;
    response.json({ success: true, data: { ...access, buddyHistoryEnabled: privacy?.buddyHistoryEnabled ?? true,historyStore:privacy?.historyStore,
      ...(privacy?.responderState ? { responderState: privacy.responderState } : {}) } });
  });
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
  router.get('/local-data',authenticate,async(request,response)=>{if(!service.localBuddy)throw new Error('Local storage is disabled.');response.setHeader('Cache-Control','no-store');response.setHeader('Content-Disposition','attachment; filename="echo-local-data.json"');response.json(await service.exportLocal(request.auth!.id));});
  router.delete('/local-data',authenticate,async(request,response)=>{await service.clearLocal(request.auth!.id);response.json({data:{deleted:true}});});
  router.post('/local-data/analysis/:id/retry',authenticate,requireVerifiedAi,aiWriteLimiter,async(request,response)=>{await service.retryLocal(request.auth!.id,String(request.params.id));response.json({data:{queued:true}});});
  return router;
}
