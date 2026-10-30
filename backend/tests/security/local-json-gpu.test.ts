import {it} from 'vitest';
it.skipIf(process.env.ECHO_VERIFY_LOCAL_JSON!=='true')('runs Express, disposable SQL, actual copied models and JSON recovery',async()=>{await import('../../scripts/test-core-http.mts');},1200000);
