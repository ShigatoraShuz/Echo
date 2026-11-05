import {it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import request from 'supertest';import express from 'express';
import {createAccessRouter} from '../../src/features/access/access.routes.js';
import {errorMiddleware} from '../../src/shared/middleware/error.middleware.js';
it('presence authenticates, validates input, closes one verified session and rejects reopening it',async()=>{
 const root=mkdtempSync(join(tmpdir(),'echo-session-api-'));vi.stubEnv('ECHO_APP_PRESENCE','true');vi.stubEnv('LOCAL_DATA_DIR',root);
 const verifier={getUser:async(token:string)=>token==='invalid'?null:{id:'account',sessionId:token}};
 const app=express();app.use(express.json());app.use(createAccessRouter({} as any,verifier));app.use(errorMiddleware);
 const tabId='40000000-0000-4000-8000-000000000001';
 const post=(token:string,action:string)=>request(app).post('/session/presence').set('Authorization','Bearer '+token).send({tabId,action});
 try{
  expect((await post('invalid','register')).status).toBe(401);
  expect((await post('session-a','register')).status).toBe(200);
  expect((await post('session-b','register')).status).toBe(200);
  expect((await post('session-a','logout')).body.data.closed).toBe(true);
  expect((await post('session-a','register')).status).toBe(401);
  expect((await post('session-b','heartbeat')).status).toBe(200);
  expect((await post('session-b','unsupported')).status).toBe(400);
 }finally{vi.unstubAllEnvs();rmSync(root,{recursive:true,force:true});}
});
