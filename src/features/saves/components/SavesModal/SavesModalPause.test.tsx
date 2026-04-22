import * as React from "react";

import { GameContext } from "@feat/gameplay/context/index";
import { UIPauseContext, UIPauseProvider } from "@shared/contexts/UIPauseContext";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

import SavesModal from ".";

// jsdom does not implement <dialog> showModal/close — the simple stub is
// enough for our purposes (toggling the `open` attribute).
HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
  this: HTMLDialogElement,
) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

vi.mock("@feat/saves/hooks/useSaveStore", () => ({
  useSaveStore: () => ({
    saves: [],
    createSave: vi.fn(),
    updateProgress: vi.fn(),
    deleteSave: vi.fn(),
    exportRxdbSave: vi.fn(),
    importRxdbSave: vi.fn(),
  }),
}));

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: () => ({ teams: [] }),
}));

const confirmMock = vi.fn(() => true);
vi.stubGlobal("confirm", confirmMock);
afterAll(() => vi.unstubAllGlobals());

const noop = vi.fn();

interface Probe {
  isPaused: boolean;
}

const ProbeIsPaused: React.FC<{ probe: Probe }> = ({ probe }) => {
  const ctx = React.useContext(UIPauseContext);
  React.useEffect(() => {
    probe.isPaused = ctx.isPaused;
  });
  return null;
};

const renderWithPauseProbe = (probe: Probe) =>
  render(
    <UIPauseProvider>
      <ProbeIsPaused probe={probe} />
      <GameContext.Provider value={makeContextValue()}>
        <SavesModal
          strategy="balanced"
          managedTeam={0}
          managerMode={false}
          currentSaveId={null}
          onSaveIdChange={noop}
        />
      </GameContext.Provider>
    </UIPauseProvider>,
  );

describe("SavesModal — UI pause coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
  });

  it("pushes a UI pause when opened and pops it when closed", async () => {
    const probe: Probe = { isPaused: false };
    renderWithPauseProbe(probe);
    expect(probe.isPaused).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open saves panel/i }));
    });
    expect(probe.isPaused).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByTestId("saves-modal-close-button"));
    });
    expect(probe.isPaused).toBe(false);
  });

  it("releases the pause when the modal is unmounted while open (no leak)", async () => {
    const probe: Probe = { isPaused: false };
    const { unmount } = renderWithPauseProbe(probe);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open saves panel/i }));
    });
    expect(probe.isPaused).toBe(true);

    // Unmount without explicitly closing — the useUIPauseScope cleanup must
    // still pop the counter so the next session starts unpaused.
    unmount();

    // Re-mount fresh and verify count is back at zero.
    const probe2: Probe = { isPaused: true };
    renderWithPauseProbe(probe2);
    expect(probe2.isPaused).toBe(false);
  });
});
