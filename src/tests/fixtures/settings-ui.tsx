import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SettingsModal from "@/components/SettingsModal";
import "@/index.css";
function Fixture() {
  const [open, setOpen] = useState(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Open settings
      </button>
      <p data-testid="settings-path">{location.pathname}</p>
      <SettingsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        returnFocusRef={trigger}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <Fixture />
    </ThemeProvider>
  </BrowserRouter>,
);
