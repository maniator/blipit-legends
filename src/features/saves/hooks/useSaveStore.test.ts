import "fake-indexeddb/auto";

import * as React from "react";

import { makeSaveStore } from "@feat/saves/storage/saveStore";
import { act, renderHook, waitFor } from "@testing-library/react";
import { RxDatabaseProvider } from "rxdb/plugins/react";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { useSaveStore } from "./useSaveStore";

describe("useSaveStore", () => {
  let db: BallgameDb;
  let testStore: ReturnType<typeof makeSaveStore>;

  beforeEach(async () => {
    db = await createTestDb(getRxStorageMemory());
    testStore = makeSaveStore(async () => db);
  });

  afterEach(async () => {
    await db.close();
  });

  const makeWrapper = (database: BallgameDb) => {
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        RxDatabaseProvider,
        // BallgameDb is a typed RxDatabase subtype that is structurally compatible
        // with RxDatabaseProvider's expected database prop at runtime. The cast is
        // necessary because RxDB's React types use opaque generics that don't
        // align with our concrete BallgameDb type without explicit coercion.
        {
          database: database as unknown as Parameters<typeof RxDatabaseProvider>[0]["database"],
        } as Parameters<typeof RxDatabaseProvider>[0],
        children,
      );
    Wrapper.displayName = "TestDbWrapper";
    return Wrapper;
  };

  it("returns empty saves on initial load", async () => {
    const { result } = renderHook(() => useSaveStore(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.saves).toBeDefined());
    expect(result.current.saves).toHaveLength(0);
  });

  it("reactively updates saves when a new save is created", async () => {
    const { result } = renderHook(() => useSaveStore(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.saves).toBeDefined());

    await act(async () => {
      await testStore.createSave(
        { homeTeamId: "A", awayTeamId: "B", seed: "abc", setup: {} as never },
        { name: "Test Save" },
      );
    });

    await waitFor(() => expect(result.current.saves).toHaveLength(1));
    expect(result.current.saves[0].name).toBe("Test Save");
  });

  it("reactively removes saves when deleted", async () => {
    const saveId = await testStore.createSave(
      { homeTeamId: "A", awayTeamId: "B", seed: "abc", setup: {} as never },
      { name: "To Delete" },
    );
    const { result } = renderHook(() => useSaveStore(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.saves).toHaveLength(1));

    await act(async () => {
      await testStore.deleteSave(saveId);
    });

    await waitFor(() => expect(result.current.saves).toHaveLength(0));
  });

  it("exposes stable write callbacks", async () => {
    const { result, rerender } = renderHook(() => useSaveStore(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.saves).toBeDefined());
    const first = result.current.createSave;
    rerender();
    expect(result.current.createSave).toBe(first);
  });
});
