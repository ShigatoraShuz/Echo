import { defineConfig } from 'vite';
import react from '../../../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import tailwindcss from '../../../frontend/node_modules/tailwindcss/lib/index.js';
import autoprefixer from '../../../frontend/node_modules/autoprefixer/lib/autoprefixer.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwind from '../../../frontend/tailwind.config.ts';
const root = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(root, '../../../frontend');
const mock = path.join(root, 'fixtures.ts');
export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: [
    ...['@/services/journal/journal-service.factory','@/services/settings/settings.service','@/infrastructure/supabase/browser-client','@/infrastructure/supabase/config','@/infrastructure/api/api-client','@/infrastructure/api/supabase-auth-token-provider','@/config/environment'].map(find=>({find,replacement:mock})),
    {find:'next/link',replacement:path.join(root,'next-shims.tsx')},
    {find:'next/image',replacement:path.join(root,'image-shim.tsx')},
    {find:'next/navigation',replacement:path.join(root,'next-shims.tsx')},
    {find:'@',replacement:path.join(frontend,'src')},
  ]},
  define: {'process.env.NODE_ENV':JSON.stringify('development')},
  css:{postcss:{plugins:[tailwindcss({...tailwind,content:[`${frontend.replaceAll('\\','/')}/src/**/*.{ts,tsx}`,`${root.replaceAll('\\','/')}/**/*.{ts,tsx}`]}),autoprefixer()]}},
  server:{host:'127.0.0.1',port:4310,strictPort:true,fs:{allow:[path.resolve(root,'../../..')]}},
});
