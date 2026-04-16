import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PlayerStatFields from "./PlayerStatFields";
import { HITTER_STAT_CAP, PITCHER_STAT_CAP } from "./statBudget";

const makeHitter = (contact = 30, power = 30, speed = 30) => ({
  id: "p1",
  name: "Test Hitter",
  role: "batter" as const,
  position: "LF",
  handedness: "R" as const,
  contact,
  power,
  speed,
});

const makePitcher = (velocity = 40, control = 40, movement = 40) => ({
  id: "p2",
  name: "Test Pitcher",
  role: "pitcher" as const,
  position: "SP",
  handedness: "R" as const,
  velocity,
  control,
  movement,
});

describe("PlayerStatFields", () => {
  it("renders hitter sliders for contact, power, speed", () => {
    render(<PlayerStatFields player={makeHitter()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/contact/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/power/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/speed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/velocity/i)).not.toBeInTheDocument();
  });

  it("renders pitcher sliders for velocity, control, movement", () => {
    render(<PlayerStatFields player={makePitcher()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/velocity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/control/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/movement/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/contact/i)).not.toBeInTheDocument();
  });

  it("shows hitter total and cap in counter when under cap", () => {
    render(<PlayerStatFields player={makeHitter(30, 30, 30)} onChange={vi.fn()} />);
    expect(screen.getByText(`Total: 90 / ${HITTER_STAT_CAP}`)).toBeInTheDocument();
  });

  it("shows hitter over-cap warning when over cap", () => {
    render(<PlayerStatFields player={makeHitter(60, 60, 60)} onChange={vi.fn()} />);
    // 180 total, 30 over HITTER_STAT_CAP (150)
    expect(screen.getByText(`⚠ 180 / ${HITTER_STAT_CAP} — 30 over cap`)).toBeInTheDocument();
  });

  it("shows pitcher total and cap in counter when under cap", () => {
    render(<PlayerStatFields player={makePitcher(40, 40, 40)} onChange={vi.fn()} />);
    expect(screen.getByText(`Total: 120 / ${PITCHER_STAT_CAP}`)).toBeInTheDocument();
  });

  it("shows pitcher over-cap warning when over cap", () => {
    render(<PlayerStatFields player={makePitcher(60, 60, 60)} onChange={vi.fn()} />);
    // 180 total, 20 over PITCHER_STAT_CAP (160)
    expect(screen.getByText(`⚠ 180 / ${PITCHER_STAT_CAP} — 20 over cap`)).toBeInTheDocument();
  });

  it("calls onChange with updated stat key when slider changes", () => {
    const onChange = vi.fn();
    render(<PlayerStatFields player={makeHitter(30, 30, 30)} onChange={onChange} />);
    const contactSlider = screen.getByLabelText(/contact/i);
    fireEvent.change(contactSlider, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({ contact: 50 });
  });

  it("shows 0 remaining when hitter is exactly at cap", () => {
    render(<PlayerStatFields player={makeHitter(50, 50, 50)} onChange={vi.fn()} />);
    expect(screen.getByText(`Total: 150 / ${HITTER_STAT_CAP}`)).toBeInTheDocument();
  });

  it("shows 0 remaining when pitcher is exactly at cap", () => {
    render(<PlayerStatFields player={makePitcher(53, 53, 54)} onChange={vi.fn()} />);
    expect(screen.getByText(`Total: 160 / ${PITCHER_STAT_CAP}`)).toBeInTheDocument();
  });

  describe("isExistingPlayer=true (stats locked after creation)", () => {
    it("renders sliders as disabled", () => {
      render(
        <PlayerStatFields
          player={makeHitter(40, 40, 40)}
          isExistingPlayer={true}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByLabelText(/contact/i)).toBeDisabled();
      expect(screen.getByLabelText(/power/i)).toBeDisabled();
      expect(screen.getByLabelText(/speed/i)).toBeDisabled();
    });

    it("shows locked hint", () => {
      render(
        <PlayerStatFields
          player={makeHitter(40, 40, 40)}
          isExistingPlayer={true}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText(/stats are locked after creation/i)).toBeInTheDocument();
    });

    it("does not show over-cap warning even when over cap", () => {
      render(
        <PlayerStatFields
          player={makeHitter(60, 60, 60)}
          isExistingPlayer={true}
          onChange={vi.fn()}
        />,
      );
      expect(screen.queryByText(/over cap/i)).not.toBeInTheDocument();
    });

    it("does not call onChange when slider is changed (disabled)", () => {
      const onChange = vi.fn();
      render(
        <PlayerStatFields
          player={makeHitter(30, 30, 30)}
          isExistingPlayer={true}
          onChange={onChange}
        />,
      );
      const contactSlider = screen.getByLabelText(/contact/i);
      fireEvent.change(contactSlider, { target: { value: "99" } });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
