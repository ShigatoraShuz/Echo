import {it} from 'vitest';
it.skipIf(process.env.ECHO_BENCHMARK_TALK!=='true')('benchmarks actual local Talk through Express/WebSocket and local JSON',async()=>{await import('../../scripts/benchmark-realtime-talk.mts');},7200000);
