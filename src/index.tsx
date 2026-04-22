import "@fontsource-variable/inter";
import "./index.scss";

import * as React from "react";
import { createRoot } from "react-dom/client";

import { UIPauseProvider } from "@shared/contexts/UIPauseContext";
import { theme } from "@shared/theme";
import { initSeed } from "@shared/utils/rng";
import { Analytics } from "@vercel/analytics/react";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "styled-components";

import { router } from "./router";

initSeed();

createRoot(document.getElementById("game")!).render(
  <ThemeProvider theme={theme}>
    <UIPauseProvider>
      <RouterProvider router={router} />
      {__IS_VERCEL_BUILD__ && <Analytics />}
    </UIPauseProvider>
  </ThemeProvider>,
);
