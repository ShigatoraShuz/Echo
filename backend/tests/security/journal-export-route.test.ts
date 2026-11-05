import {it,expect,vi} from 'vitest';
import express from 'express';import request from 'supertest';
import {createJournalsRouter} from '../../src/features/journals/journals.routes.js';
import {errorMiddleware} from '../../src/shared/middleware/error.middleware.js';
import {NotFoundError} from '../../src/shared/errors/app-error.js';
it('exports only an owned saved journal and requires authentication',async()=>{
 const service={get:vi.fn(async(user:string,id:string)=>{if(user!=='owner')throw new NotFoundError('Not found');return {id,title:'Saved journal',body:'Kumusta — saved text',created_at:'2026-11-04'};})};
 const verifier={getUser:async(token:string)=>({id:token,emailVerified:true})};
 const app=express();app.use(createJournalsRouter(service as any,verifier,{} as any));app.use(errorMiddleware);
 const path='/journals/40000000-0000-4000-8000-000000000001/export?format=pdf';
 expect((await request(app).get(path)).status).toBe(401);
 expect((await request(app).get(path).set('Authorization','Bearer other')).status).toBe(404);
 const response=await request(app).get(path).set('Authorization','Bearer owner');
 expect(response.status).toBe(200);expect(response.headers['content-type']).toContain('application/pdf');expect(response.headers['cache-control']).toContain('no-store');expect(response.headers['content-disposition']).toContain('.pdf');
});
