import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer,transformWithEsbuild } from 'vite';

export async function startProfileMenuServer(){
  const source=await readFile(new URL('./profile-menu-client.ts',import.meta.url),'utf8');
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-profile-menu',
    resolve:{alias:{'@':fileURLToPath(new URL('../../',import.meta.url))}},
    optimizeDeps:{entries:['src/tests/fixtures/profile-menu-ui.tsx'],include:['react','react-dom/client','react-router-dom','@radix-ui/react-dropdown-menu','@radix-ui/react-avatar']},
    server:{host:'127.0.0.1',port:8998,hmr:false,watch:null},
    plugins:[{name:'isolated-profile-menu',enforce:'pre',
      resolveId(raw){
        const path=raw.replace(/\\/g,'/');
        if(raw==='virtual:profile-menu-client' || /\/integrations\/supabase\/client(?:\.ts)?$/.test(path))return '\0profile-menu-client';
        const modal=/(?:^|\/)(ProfileModal|SettingsModal|SearchModal|WalletModal|NotificationPanel)(?:\.tsx)?$/.exec(path);
        if(modal)return '\0menu-modal:'+modal[1];
        if(/\/contexts\/UserContext(?:\.tsx)?$/.test(path))return '\0menu-user';
        if(/\/hooks\/useCoinWallet(?:\.ts)?$/.test(path))return '\0menu-wallet';
        if(/\/hooks\/(useNotifications|useUnreadCount|useConversations)(?:\.ts)?$/.test(path))return '\0menu-counts';
        if(/\/utils\/cacheManager(?:\.ts)?$/.test(path))return '\0menu-cache';
      },
      async load(id){
        if(id==='\0profile-menu-client')return (await transformWithEsbuild(source,'profile-menu-client.ts',{loader:'ts',target:'es2020'})).code;
        if(id==='\0menu-user')return "import {fixture} from 'virtual:profile-menu-client';export const useUser=()=>({user:fixture.user,isLoading:false});";
        if(id==='\0menu-wallet')return "import {fixture} from 'virtual:profile-menu-client';export const useCoinWallet=()=>({balance:fixture.balance,isWalletLoading:localStorage.getItem('menu-state')==='loading',isWalletError:localStorage.getItem('menu-state')==='error'});";
        if(id==='\0menu-counts')return 'export const useNotifications=()=>({unreadCount:3});export const useUnreadCount=()=>({totalUnreadCount:7});export const useConversations=()=>({});';
        if(id==='\0menu-cache')return "import {fixture} from 'virtual:profile-menu-client';export const cacheManager={forceRefresh:()=>{fixture.refreshes++;}};";
        if(id.startsWith('\0menu-modal:'))return `import React from 'react';export default function Stub({isOpen,open,onClose}){return (isOpen || open) ? React.createElement('section',{role:'dialog','aria-label':'${id.split(':')[1]}'},React.createElement('h2',null,'${id.split(':')[1]}'),React.createElement('button',{onClick:onClose},'Close dialog')) : null;}`;
      },
      configureServer(instance){instance.middlewares.use((req,res,next)=>{
        if(req.url==='/profile-menu-fixture'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/profile-menu-ui.tsx"></script></body></html>');}
        else next();
      });},
    }],
  });await server.listen();return server;
}
