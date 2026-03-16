import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@storage/saveIO", () => ({
  formatSaveDate: vi.fn(() => "Jan 1, 2025"),
}));

// jsdom doesn't implement window.confirm; provide a controllable mock.
const confirmMock = vi.fn(() => true);
vi.stubGlobal("confirm", confirmMock);
afterAll(() => vi.unstubAllGlobals());

import type { SaveDoc } from "@storage/types";
import { makeSaveDoc } from "@test/helpers/saves";

import { DELETE_SAVE_CONFIRM_MSG } from "./index";
import SaveSlotList from "./index";

const defaultProps = {
  saves: [makeSaveDoc()],
  onLoad: vi.fn(),
  onExport: vi.fn(),
  onDelete: vi.fn(),
};

describe("SaveSlotList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
  });

  it("renders save slot items", () => {
    render(<SaveSlotList {...defaultProps} />);
    expect(screen.getByText("Test Save")).toBeInTheDocument();
  });

  it("shows a delete button for each save", () => {
    render(<SaveSlotList {...defaultProps} />);
    expect(screen.getByTestId("delete-save-button")).toBeInTheDocument();
  });

  it("calls window.confirm before deleting a save", () => {
    const onDelete = vi.fn();
    render(<SaveSlotList {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("delete-save-button"));
    expect(confirmMock).toHaveBeenCalledWith(DELETE_SAVE_CONFIRM_MSG);
  });

  it("calls onDelete with the save id when confirm returns true", () => {
    const onDelete = vi.fn();
    render(<SaveSlotList {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("delete-save-button"));
    expect(onDelete).toHaveBeenCalledWith("save_1");
  });

  it("does NOT call onDelete when confirm returns false", () => {
    confirmMock.mockReturnValue(false);
    const onDelete = vi.fn();
    render(<SaveSlotList {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("delete-save-button"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
