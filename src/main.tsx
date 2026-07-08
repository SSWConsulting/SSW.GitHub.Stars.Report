import React from "react";
import { createRoot } from "react-dom/client";

// Order matters (per SSW skill): font + design-system CSS BEFORE app CSS.
import "@fontsource-variable/inter";
import "@sswconsulting/design-system/styles.css";
import "./app.css";

import Report from "./Report";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Report />
  </React.StrictMode>
);
