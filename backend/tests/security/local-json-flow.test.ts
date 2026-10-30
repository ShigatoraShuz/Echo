import {it} from 'vitest';
import fixture from '../../../packages/contracts/fixtures/core-v2.json';
import {verifyLocalFlow} from '../../scripts/verify-local-json-flow.mts';
it('connects local storage to journal and Buddy routes with disposable SQL',async()=>{await verifyLocalFlow({ready:async()=>true,classify:async()=>({suicidal_language_flag:false}),analyze:async()=>fixture,chat:async()=>({reply:'Let us choose one small step.',supportRequired:false})});},120000);
