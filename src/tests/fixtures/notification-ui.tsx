import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import Header from "@/components/Header";
import "@/index.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function Fixture() {
  const location = useLocation();
  return (
    <div className="max-w-[480px] mx-auto">
      <Header />
      <main className="p-6">
        <h1 className="text-xl font-semibold">Your Serkle feed</h1>
        <p className="text-muted-foreground mt-2">
          Notifications preview using sample community activity.
        </p>
        <button className="mt-6 p-3 border rounded-xl">Feed action</button>
        <p data-testid="notification-path">{location.pathname}</p>
        <p data-testid="notification-route-state">
          {JSON.stringify(location.state)}
        </p>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavigationProvider>
          <Fixture />
        </NavigationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
