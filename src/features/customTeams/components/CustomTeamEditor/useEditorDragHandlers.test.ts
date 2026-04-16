import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorAction, EditorPlayer } from "./editorState";
import { useEditorDragHandlers } from "./useEditorDragHandlers";

// Mock dnd-kit so JSDOM pointer-event limitations don't block rendering.
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    PointerSensor: class {
      static activators = [];
    },
    useSensor: vi.fn((_cls, _opts) => ({})),
    useSensors: vi.fn((...args: unknown[]) => args),
  };
});
vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return { ...actual, sortableKeyboardCoordinates: vi.fn() };
});

const makePlayer = (id: string): EditorPlayer => ({
  id,
  name: `Player ${id}`,
  role: "batter",
  position: "CF",
  handedness: "R",
  contact: 60,
  power: 60,
  speed: 60,
});

describe("useEditorDragHandlers — handleLineupBenchDragEnd", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  const render = (lineup: EditorPlayer[], bench: EditorPlayer[] = []) =>
    renderHook(() =>
      useEditorDragHandlers({
        lineup,
        bench,
        pitchers: [],
        dispatch: dispatch as React.Dispatch<EditorAction>,
      }),
    );

  it("returns early when over is null", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handleLineupBenchDragEnd({ active: { id: "p1" }, over: null } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns early when active.id === over.id", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "p1" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns early when dragged item is not in lineup or bench", () => {
    const { result } = render([makePlayer("p1")]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p_unknown" },
        over: { id: "p1" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns early when over target is not in lineup, bench, or a sentinel", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "completely_unknown" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches REORDER for same-section lineup drag", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const { result } = render([p1, p2]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "p2" },
      } as never);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "REORDER",
      section: "lineup",
      orderedIds: ["p2", "p1"],
    });
  });

  it("dispatches REORDER when dropped on sentinel (move to end)", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const { result } = render([p1, p2]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "lineup-droppable" },
      } as never);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "REORDER",
      section: "lineup",
      orderedIds: ["p2", "p1"],
    });
  });

  it("does not dispatch REORDER when sentinel drop but player already at end", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const { result } = render([p1, p2]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p2" },
        over: { id: "lineup-droppable" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches TRANSFER_PLAYER for cross-section lineup→bench drag", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const { result } = render([p1], [p2]);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "p2" },
      } as never);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "TRANSFER_PLAYER",
      fromSection: "lineup",
      toSection: "bench",
      playerId: "p1",
      toIndex: 0,
    });
  });

  it("dispatches TRANSFER_PLAYER with append toIndex when over is the bench sentinel", () => {
    const p1 = makePlayer("p1");
    const { result } = render([p1], []);
    act(() => {
      result.current.handleLineupBenchDragEnd({
        active: { id: "p1" },
        over: { id: "bench-droppable" },
      } as never);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "TRANSFER_PLAYER",
      fromSection: "lineup",
      toSection: "bench",
      playerId: "p1",
      toIndex: 0, // empty bench → append at index 0
    });
  });
});

describe("useEditorDragHandlers — handlePitchersDragEnd", () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  const render = (pitchers: EditorPlayer[]) =>
    renderHook(() =>
      useEditorDragHandlers({
        lineup: [],
        bench: [],
        pitchers,
        dispatch: dispatch as React.Dispatch<EditorAction>,
      }),
    );

  it("returns early when over is null", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handlePitchersDragEnd({ active: { id: "p1" }, over: null } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns early when active.id === over.id", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handlePitchersDragEnd({
        active: { id: "p1" },
        over: { id: "p1" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns early when active or over id is not found in pitchers", () => {
    const { result } = render([makePlayer("p1"), makePlayer("p2")]);
    act(() => {
      result.current.handlePitchersDragEnd({
        active: { id: "p_unknown" },
        over: { id: "p1" },
      } as never);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches REORDER for pitchers drag", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const { result } = render([p1, p2]);
    act(() => {
      result.current.handlePitchersDragEnd({
        active: { id: "p1" },
        over: { id: "p2" },
      } as never);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "REORDER",
      section: "pitchers",
      orderedIds: ["p2", "p1"],
    });
  });
});
