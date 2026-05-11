import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectPseudoInset } from "@test/testHelpers";

import InstructionsModal from ".";

describe("InstructionsModal", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("renders the help button", () => {
    render(<InstructionsModal />);
    expect(screen.getByRole("button", { name: /how to play/i })).toBeInTheDocument();
  });

  it("calls showModal when help button is clicked", () => {
    render(<InstructionsModal />);
    fireEvent.click(screen.getByRole("button", { name: /how to play/i }));
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("calls close when Got it! button is clicked", () => {
    render(<InstructionsModal />);
    fireEvent.click(screen.getByRole("button", { name: /got it/i, hidden: true }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("renders instructions content", () => {
    render(<InstructionsModal />);
    expect(screen.getByText(/how to play/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /how to play/i })).toBeInTheDocument();
  });

  it("closes on backdrop click (outside dialog bounds)", () => {
    render(<InstructionsModal />);
    const dialog = document.querySelector("dialog")!;
    // Stub the bounding rect so that clientX/Y (0,0) is outside the dialog.
    dialog.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 400,
      top: 100,
      bottom: 400,
      width: 300,
      height: 300,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    fireEvent.click(dialog, { clientX: 0, clientY: 0 });
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("uses pseudo-element hit expansion for help and close icon buttons", () => {
    render(<InstructionsModal />);

    const helpButton = screen.getByTestId("instructions-help-button");
    const closeButton = screen.getByTestId("instructions-close-button");
    expectPseudoInset(helpButton, 5);
    expectPseudoInset(closeButton, 8);
  });
});
