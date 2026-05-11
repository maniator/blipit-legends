import * as React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { router } from "./router";

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
    const [rootRoute] = router.routes as Array<{
      hydrateFallbackElement?: React.ReactNode;
    }>;

    expect(React.isValidElement(rootRoute.hydrateFallbackElement)).toBe(true);

    render(rootRoute.hydrateFallbackElement);

    expect(screen.getByTestId("app-hydrate-fallback")).toHaveTextContent("Loading app…");
  });
});
