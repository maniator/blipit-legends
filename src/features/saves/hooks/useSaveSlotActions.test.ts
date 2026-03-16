import { describe, expect, it, vi } from "vitest";

import { makeSaveDoc } from "@test/helpers/saves";

import { useSaveSlotActions } from "./useSaveSlotActions";

describe("useSaveSlotActions", () => {
  it("handleDelete: calls deleteSave with the id", async () => {
    const deleteSave = vi.fn().mockResolvedValue(undefined);
    const { handleDelete } = useSaveSlotActions({ deleteSave, exportSave: vi.fn() });
    handleDelete("save-1");
    expect(deleteSave).toHaveBeenCalledWith("save-1");
  });

  it("handleDelete: calls onDeleted after successful delete", async () => {
    const deleteSave = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const { handleDelete } = useSaveSlotActions({ deleteSave, exportSave: vi.fn(), onDeleted });
    handleDelete("save-1");
    await Promise.resolve();
    expect(onDeleted).toHaveBeenCalledWith("save-1");
  });

  it("handleDelete: calls onError when deleteSave rejects", async () => {
    const err = new Error("db error");
    const deleteSave = vi.fn().mockRejectedValue(err);
    const onError = vi.fn();
    const { handleDelete } = useSaveSlotActions({ deleteSave, exportSave: vi.fn(), onError });
    handleDelete("save-1");
    await Promise.resolve();
    await Promise.resolve(); // settle rejection
    expect(onError).toHaveBeenCalledWith("Failed to delete save", err);
  });

  it("handleDelete: uses appLog.error when onError is not provided", async () => {
    const { appLog } = await import("@shared/utils/logger");
    const spy = vi.spyOn(appLog, "error").mockImplementation(() => {});
    const err = new Error("oops");
    const deleteSave = vi.fn().mockRejectedValue(err);
    const { handleDelete } = useSaveSlotActions({ deleteSave, exportSave: vi.fn() });
    handleDelete("save-1");
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("handleExport: calls exportSave with slot id", async () => {
    const exportSave = vi.fn().mockResolvedValue('{"version":1}');
    const { handleExport } = useSaveSlotActions({ deleteSave: vi.fn(), exportSave });
    handleExport(makeSaveDoc({ id: "save-1", name: "My Save" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(exportSave).toHaveBeenCalledWith("save-1");
  });

  it("handleExport: calls onError when exportSave rejects", async () => {
    const err = new Error("export failed");
    const exportSave = vi.fn().mockRejectedValue(err);
    const onError = vi.fn();
    const { handleExport } = useSaveSlotActions({ deleteSave: vi.fn(), exportSave, onError });
    handleExport(makeSaveDoc({ id: "save-1" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith("Failed to export save", err);
  });

  it("handleDelete: does not call onDeleted when deleteSave rejects", async () => {
    const deleteSave = vi.fn().mockRejectedValue(new Error("fail"));
    const onDeleted = vi.fn();
    const onError = vi.fn();
    const { handleDelete } = useSaveSlotActions({
      deleteSave,
      exportSave: vi.fn(),
      onDeleted,
      onError,
    });
    handleDelete("save-1");
    await Promise.resolve();
    await Promise.resolve();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
