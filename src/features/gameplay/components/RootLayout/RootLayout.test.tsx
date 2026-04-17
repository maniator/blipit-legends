import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@feat/gameplay/components/Game/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

vi.mock("@shared/hooks/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: vi.fn(),
}));

vi.mock("@shared/hooks/useSeedDemoTeams", () => ({
  useSeedDemoTeams: vi.fn(),
}));

import { useServiceWorkerUpdate } from "@shared/hooks/useServiceWorkerUpdate";

import RootLayout from "./index";

const mockUseUpdate = vi.mocked(useServiceWorkerUpdate);
const mockDismiss = vi.fn();
const mockReload = vi.fn();

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<div data-testid="child">child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdate.mockReturnValue({
      updateAvailable: false,
      dismiss: mockDismiss,
      reload: mockReload,
    });
  });

  it("renders children via Outlet inside the ErrorBoundary", () => {
    renderLayout();
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not render the update banner when no update is available", () => {
    renderLayout();
    expect(screen.queryByTestId("update-banner")).not.toBeInTheDocument();
  });

  it("renders the update banner when an update is available", () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: true,
      dismiss: mockDismiss,
      reload: mockReload,
    });
    renderLayout();
    expect(screen.getByTestId("update-banner")).toBeInTheDocument();
  });

  it("calls dismiss when the banner dismiss button is clicked", () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: true,
      dismiss: mockDismiss,
      reload: mockReload,
    });
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /dismiss update notice/i }));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("calls reload when the banner reload button is clicked", () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: true,
      dismiss: mockDismiss,
      reload: mockReload,
    });
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /reload app/i }));
    expect(mockReload).toHaveBeenCalledOnce();
  });
});
