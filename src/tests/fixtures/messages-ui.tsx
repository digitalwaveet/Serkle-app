import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { Toaster } from "sonner";
import Messages from "@/pages/Messages";
import StorageFixture from "./messages-storage";
import MediaFixture from "./messages-media";
import "@/index.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
function App() {
  const location = useLocation();
  return (
    <>
      <Routes>
        <Route path="/messages/storage" element={<StorageFixture />} />
        <Route path="/messages/media" element={<MediaFixture />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:conversationId" element={<Messages />} />
        <Route path="*" element={<main>Destination</main>} />
      </Routes>
      <span hidden data-testid="current-path">
        {location.pathname + location.search}
      </span>
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <ThemeProvider>
      <BrowserRouter>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>,
);
