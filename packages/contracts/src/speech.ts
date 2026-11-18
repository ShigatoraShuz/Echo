import {z} from 'zod';
export const sttProviderSchema=z.enum(['whisper','browser']);
export type SttProvider=z.infer<typeof sttProviderSchema>;
