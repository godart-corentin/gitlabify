import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { App } from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import { initSentry } from "./shared/lib/sentry";

initSentry();

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>,
  );
}
