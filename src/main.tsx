import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// In production, disable browser context menu and devtools shortcuts
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  document.addEventListener("keydown", (e) => {
    // Block devtools shortcuts: F12, Ctrl/Cmd+Shift+I, Ctrl/Cmd+Shift+J, Ctrl/Cmd+U
    if (
      e.key === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i")) ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j")) ||
      ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u"))
    ) {
      e.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
