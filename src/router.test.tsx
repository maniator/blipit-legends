import * as React from "react";

import { theme } from "@shared/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";

import { router } from "./router";

type TestRoute = {
  children?: TestRoute[];
  element?: React.ReactNode;
  hydrateFallbackElement?: React.ReactNode;
  path?: string;
};

function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function getAppRoutes() {
  const [rootRoute] = router.routes as TestRoute[];
  const appShellRoute = rootRoute.children?.find((route) =>
    route.children?.some((child) => child.path === "saves"),
  );
  return appShellRoute?.children ?? [];
}

/**
 * Smoke test for the app router — verifies the router is created and
 * has the expected top-level route structure.
 *
 * We intentionally keep this test minimal: `createBrowserRouter` is a
 * React Router internal and does not need deep behavioural testing here.
 * Navigation behaviour is covered by the E2E routing spec.
 */
describe("router", () => {
  it("is defined and is an object", () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe("object");
  });

  it("has routes array", () => {
    // The router object exposes its internal route tree via `routes`
    expect(Array.isArray(router.routes)).toBe(true);
    expect(router.routes.length).toBeGreaterThan(0);
  });

  it("provides an app hydrate fallback on the root route", () => {
    const [rootRoute] = router.routes as TestRoute[];

    expect(React.isValidElement(rootRoute.hydrateFallbackElement)).toBe(true);

    renderWithTheme(rootRoute.hydrateFallbackElement);

    expect(screen.getByTestId("app-loading-fallback")).toHaveTextContent("Loading app…");
  });

  it("provides a visible fallback for lazy page routes", () => {
    const savesRoute = getAppRoutes().find((route) => route.path === "saves");

    if (!savesRoute?.element) {
      throw new Error("Expected the saves route to have an element");
    }

    renderWithTheme(savesRoute.element);

    expect(screen.getByTestId("app-loading-fallback")).toHaveTextContent("Loading page…");
  });
});
