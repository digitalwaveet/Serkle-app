import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter,useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import Header from '@/components/Header';
import '@/index.css';

function Fixture(){
  const location=useLocation();
  return <><Header/><main className="max-w-xl mx-auto p-6"><h1 className="text-xl font-semibold">Your Serkle feed</h1><p className="text-muted-foreground mt-2">Isolated profile menu preview with sample account data.</p><button className="mt-6 rounded-xl border p-3">Feed action</button><p data-testid="current-path" className="mt-8">{location.pathname}</p></main></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><ThemeProvider><NavigationProvider><Fixture/></NavigationProvider></ThemeProvider></BrowserRouter>);
