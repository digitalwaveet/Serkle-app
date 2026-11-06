import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, transformWithEsbuild } from 'vite';

// A real styled wallet with isolated account/payment data. No live API calls.
export async function startWalletFixtureServer() {
  const fixtureSource=await readFile(new URL('./chapa-return-client.ts',import.meta.url),'utf8');
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-chapa-return-ui',
    resolve:{alias:{'@':fileURLToPath(new URL('../../',import.meta.url))}},
    optimizeDeps:{entries:['src/tests/fixtures/chapa-return-ui.tsx'],include:['react','react-dom/client','react-router-dom','@tanstack/react-query','@radix-ui/react-tabs','@radix-ui/react-popover','@radix-ui/react-alert-dialog','@radix-ui/react-dialog']},
    server:{host:'127.0.0.1',port:8995,hmr:false,watch:null},
    plugins:[{name:'isolated-chapa-return',enforce:'pre',
      resolveId(source){
        const path=source.replace(/\\/g,'/').replace(/\/+/g,'/');
        if(source==='virtual:chapa-return-client' || /(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/.test(path)) return '\0chapa-return-client';
        if(/(?:@|\/src)\/contexts\/UserContext(?:\.tsx)?$/.test(path)) return '\0chapa-return-user';
      },
      async load(id){
        const path=id.replace(/\\/g,'/').replace(/\/+/g,'/');
        if(id==='\0chapa-return-client') return (await transformWithEsbuild(fixtureSource,'chapa-return-client.ts',{loader:'ts',target:'es2020'})).code;
        if(id==='\0chapa-return-user' || path.endsWith('/src/contexts/UserContext.tsx')) return "import {fixture} from 'virtual:chapa-return-client';export const useUser=()=>({user:fixture.user,isLoading:false});";
        if(path.endsWith('/src/integrations/supabase/client.ts')) return "export {supabase} from 'virtual:chapa-return-client';";
      },
      configureServer(instance){instance.middlewares.use((req,res,next)=>{
        if(/^\/(verify|login|wallet-fixture)(\?|$)/.test(req.url || '')) {
          res.setHeader('Content-Type','text/html');
          res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/chapa-return-ui.tsx"></script></body></html>');
        } else next();
      });},
    }],
  });
  await server.listen();return server;
}
