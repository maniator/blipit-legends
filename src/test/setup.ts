import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

import * as React from "react";

import { theme } from "@shared/theme";
import { ThemeProvider } from "styled-components";

// Wrap every @testing-library/react render with ThemeProvider so that
// styled-components interpolations that reference `theme.*` resolve correctly.
vi.mock("@testing-library/react", async (importActual) => {
  const actual = await importActual<typeof import("@testing-library/react")>();

  const ThemeWrapper: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) =>
    React.createElement(ThemeProvider, { theme }, children);

  return {
    ...actual,
    render: (
      ui: React.ReactNode,
      options?: Parameters<typeof actual.render>[1],
    ): ReturnType<typeof actual.render> => {
      const OriginalWrapper = options?.wrapper;
      const CombinedWrapper: React.FunctionComponent<{ children: React.ReactNode }> = ({
        children,
      }) =>
        React.createElement(
          ThemeWrapper,
          null,
          OriginalWrapper ? React.createElement(OriginalWrapper, null, children) : children,
        );
      return actual.render(ui, { ...options, wrapper: CombinedWrapper });
    },
  };
});

// ---------------------------------------------------------------------------
// Mock window.speechSynthesis so announce.ts can be imported without errors.
// announce.ts accesses window.speechSynthesis at module-load time, so this
// mock must be in place before any test file imports the module.
// ---------------------------------------------------------------------------
const mockUtterance = {
  voice: null as SpeechSynthesisVoice | null,
  rate: 1,
  pitch: 1,
  volume: 1,
  text: "",
};

(global as typeof globalThis & { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = vi
  .fn()
  .mockImplementation((text: string) => ({ ...mockUtterance, text }));

const mockSynth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  speaking: false,
  pending: false,
};

Object.defineProperty(window, "speechSynthesis", {
  value: mockSynth,
  writable: true,
});

// ---------------------------------------------------------------------------
// Mock AudioContext so playDecisionChime / playVictoryFanfare don't throw.
// ---------------------------------------------------------------------------
const mockOscillator = {
  connect: vi.fn(),
  type: "sine" as OscillatorType,
  frequency: { value: 0 },
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGainNode = {
  connect: vi.fn(),
  gain: {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  },
};

const mockAudioCtx = {
  createOscillator: vi.fn().mockReturnValue(mockOscillator),
  createGain: vi.fn().mockReturnValue(mockGainNode),
  destination: {},
  currentTime: 0,
  state: "running" as AudioContextState,
  close: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
};

(global as typeof globalThis & { AudioContext: unknown }).AudioContext = vi
  .fn()
  .mockImplementation(() => mockAudioCtx);

// Mock Notification API
(global as typeof globalThis & { Notification: unknown }).Notification = vi
  .fn()
  .mockImplementation(() => ({
    close: vi.fn(),
  })) as unknown as typeof Notification;
(Notification as unknown as { permission: NotificationPermission }).permission = "granted";
