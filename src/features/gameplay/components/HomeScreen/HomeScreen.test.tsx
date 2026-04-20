import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeScreen from "./index";

describe("HomeScreen", () => {
  const noop = vi.fn();

  it("renders the home screen", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.getByTestId("home-screen")).toBeInTheDocument();
  });

  it("shows the Exhibition Game button", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    const btn = screen.getByTestId("home-new-game-button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Exhibition Game");
  });

  it("shows the Load Saved Game button", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.getByTestId("home-load-saves-button")).toBeInTheDocument();
  });

  it("shows the Manage Teams button", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.getByTestId("home-manage-teams-button")).toBeInTheDocument();
  });

  it("does NOT show Resume button when onResumeCurrent is not provided", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.queryByTestId("home-resume-current-game-button")).not.toBeInTheDocument();
  });

  it("shows Resume button when onResumeCurrent is provided", () => {
    render(
      <HomeScreen
        onNewGame={noop}
        onLoadSaves={noop}
        onManageTeams={noop}
        onResumeCurrent={noop}
      />,
    );
    expect(screen.getByTestId("home-resume-current-game-button")).toBeInTheDocument();
  });

  it("calls onNewGame when Exhibition Game button is clicked", () => {
    const onNewGame = vi.fn();
    render(<HomeScreen onNewGame={onNewGame} onLoadSaves={noop} onManageTeams={noop} />);
    fireEvent.click(screen.getByTestId("home-new-game-button"));
    expect(onNewGame).toHaveBeenCalled();
  });

  it("calls onLoadSaves when Load Saved Game button is clicked", () => {
    const onLoadSaves = vi.fn();
    render(<HomeScreen onNewGame={noop} onLoadSaves={onLoadSaves} onManageTeams={noop} />);
    fireEvent.click(screen.getByTestId("home-load-saves-button"));
    expect(onLoadSaves).toHaveBeenCalled();
  });

  it("calls onManageTeams when Manage Teams button is clicked", () => {
    const onManageTeams = vi.fn();
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={onManageTeams} />);
    fireEvent.click(screen.getByTestId("home-manage-teams-button"));
    expect(onManageTeams).toHaveBeenCalled();
  });

  it("calls onResumeCurrent when Resume button is clicked", () => {
    const onResumeCurrent = vi.fn();
    render(
      <HomeScreen
        onNewGame={noop}
        onLoadSaves={noop}
        onManageTeams={noop}
        onResumeCurrent={onResumeCurrent}
      />,
    );
    fireEvent.click(screen.getByTestId("home-resume-current-game-button"));
    expect(onResumeCurrent).toHaveBeenCalled();
  });

  it("does NOT show Help button when onHelp is not provided", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.queryByTestId("home-help-button")).not.toBeInTheDocument();
  });

  it("shows Help button when onHelp is provided", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onHelp={noop} />);
    expect(screen.getByTestId("home-help-button")).toBeInTheDocument();
  });

  it("calls onHelp when Help button is clicked", () => {
    const onHelp = vi.fn();
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onHelp={onHelp} />);
    fireEvent.click(screen.getByTestId("home-help-button"));
    expect(onHelp).toHaveBeenCalled();
  });

  it("does NOT show Career Stats button when onCareerStats is not provided", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.queryByTestId("home-career-stats-button")).not.toBeInTheDocument();
  });

  it("shows Career Stats button when onCareerStats is provided", () => {
    render(
      <HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onCareerStats={noop} />,
    );
    expect(screen.getByTestId("home-career-stats-button")).toBeInTheDocument();
  });

  it("calls onCareerStats when Career Stats button is clicked", () => {
    const onCareerStats = vi.fn();
    render(
      <HomeScreen
        onNewGame={noop}
        onLoadSaves={noop}
        onManageTeams={noop}
        onCareerStats={onCareerStats}
      />,
    );
    fireEvent.click(screen.getByTestId("home-career-stats-button"));
    expect(onCareerStats).toHaveBeenCalled();
  });

  it("renders Career Stats above Manage Teams when available", () => {
    const { container } = render(
      <HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onCareerStats={noop} />,
    );
    const allButtons = Array.from(container.querySelectorAll("button"));
    const careerIndex = allButtons.findIndex(
      (btn) => btn.dataset.testid === "home-career-stats-button",
    );
    const manageIndex = allButtons.findIndex(
      (btn) => btn.dataset.testid === "home-manage-teams-button",
    );
    expect(careerIndex).toBeGreaterThanOrEqual(0);
    expect(manageIndex).toBeGreaterThanOrEqual(0);
    expect(careerIndex).toBeLessThan(manageIndex);
  });

  it("does NOT show Contact button when onContact is not provided", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.queryByTestId("home-contact-button")).not.toBeInTheDocument();
  });

  it("shows Contact button when onContact is provided", () => {
    render(
      <HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onContact={noop} />,
    );
    expect(screen.getByTestId("home-contact-button")).toBeInTheDocument();
  });

  it("calls onContact when Contact button is clicked", () => {
    const onContact = vi.fn();
    render(
      <HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} onContact={onContact} />,
    );
    fireEvent.click(screen.getByTestId("home-contact-button"));
    expect(onContact).toHaveBeenCalled();
  });

  it("shows creator attribution link", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    const creatorLink = screen.getByRole("link", { name: /naftali.dev/i });
    expect(creatorLink).toBeInTheDocument();
    expect(creatorLink).toHaveAttribute("href", "https://naftali.dev");
  });

  it("always shows the League play coming soon teaser", () => {
    render(<HomeScreen onNewGame={noop} onLoadSaves={noop} onManageTeams={noop} />);
    expect(screen.getByTestId("league-play-teaser")).toBeInTheDocument();
    expect(screen.getByText(/league play coming soon/i)).toBeInTheDocument();
  });
});
