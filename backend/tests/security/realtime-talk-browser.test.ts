import {it} from 'vitest';
it.skipIf(process.env.ECHO_VERIFY_TALK_BROWSER!=='true')('exercises local VAD and streaming with synthetic browser audio only',async()=>{await import('../../scripts/test-talk-browser.mts');},180000);
