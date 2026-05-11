import * as React from "react";

import { theme } from "@shared/theme";
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

const savesPageSuspension = vi.hoisted(() => new Promise<never>(() => {}));

vi.mock("@feat/saves/pages/SavesPage", () => ({
  default: function SuspendedSavesPage(): never {
    throw savesPageSuspension;
  },
}));

vi.mock("@shared/hooks/useSeedDemoTeams", () => ({
  useSeedDemoTeams: vi.fn(),
}));

vi.mock("@shared/hooks/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: () => ({
    updateAvailable: false,
    dismiss: vi.fn(),
    reload: vi.fn(),
  }),
}));

const { router } = await import("./router");

function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
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

  it("provides a visible fallback for lazy page routes", async () => {
    const memoryRouter = createMemoryRouter(router.routes, {
      initialEntries: ["/saves"],
    });

    await act(async () => {
      renderWithTheme(<RouterProvider router={memoryRouter} />);
      await Promise.resolve();
    });

    expect(screen.getByTestId("app-loading-fallback")).toHaveTextContent("Loading page…");
  });
});
