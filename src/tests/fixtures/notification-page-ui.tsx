import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import Notifications from "@/pages/Notifications";
import { Toaster } from "sonner";
import "@/index.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function Fixture() {
  const location = useLocation();
  return (
    <>
      {location.pathname === "/notification-page-fixture" ||
      location.pathname === "/notifications" ? (
        <Notifications />
      ) : (
        <main className="p-6">
          <h1>Destination</h1>
        </main>
      )}
      <p data-testid="notification-page-path" hidden>
        {location.pathname}
      </p>
      <p data-testid="notification-page-route-state" hidden>
        {JSON.stringify(location.state)}
      </p>
      <Toaster />
    </>
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
