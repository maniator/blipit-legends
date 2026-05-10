import * as React from "react";

import { Attribution, AttributionLink, GhostBtn, HomeContainer, HomeLogo, HomeSubtitle, LeagueTeaserBox, LeagueTeaserSub, LeagueTeaserTitle, MenuDivider, MenuGroup, PrimaryBtn, SecondaryBtn, SecondaryQuietBtn } from "./styles"; // prettier-ignore

type Props = {
  onNewGame: () => void;
  onLoadSaves: () => void;
  onManageTeams: () => void;
  /** When provided, shows a "Resume Current Game" button above the other actions. */
  onResumeCurrent?: () => void;
  /** When provided, shows a "How to Play" button. */
  onHelp?: () => void;
  /** When provided, shows a "Career Stats" button. */
  onCareerStats?: () => void;
  /** When provided, shows a "Contact / Report Bug" button at the bottom of the menu. */
  onContact?: () => void;
  /** Active season ID — when set, shows a Continue banner instead of the teaser. */
  activeSeasonId?: string | null;
  /** Full label e.g. "Spring 2026 · day 3 / 30" */
  activeSeasonLabel?: string | null;
  /** Called when user clicks Continue on the league banner. */
  onContinueSeason?: () => void;
  /** Called when user clicks "Browse Leagues" in the idle league teaser. */
  onStartLeague?: () => void;
};

const HomeScreen: React.FunctionComponent<Props> = ({
  onNewGame,
  onLoadSaves,
  onManageTeams,
  onResumeCurrent,
  onHelp,
  onCareerStats,
  onContact,
  activeSeasonId,
  activeSeasonLabel,
  onContinueSeason,
  onStartLeague,
}) => (
  <HomeContainer data-testid="home-screen">
    <HomeLogo>
      <img src="/images/blipit.svg" alt="BlipIt Baseball Legends" />
    </HomeLogo>
    <HomeSubtitle>Self-playing baseball simulator</HomeSubtitle>
    <MenuGroup>
      {onResumeCurrent && (
        <PrimaryBtn onClick={onResumeCurrent} data-testid="home-resume-current-game-button">
          ▶ Resume Current Game
        </PrimaryBtn>
      )}
      <PrimaryBtn onClick={onNewGame} data-testid="home-new-game-button">
        New Game
      </PrimaryBtn>
      <SecondaryBtn onClick={onLoadSaves} data-testid="home-load-saves-button">
        Load Saved Game
      </SecondaryBtn>
      {onCareerStats && (
        <SecondaryBtn onClick={onCareerStats} data-testid="home-career-stats-button">
          Career Stats
        </SecondaryBtn>
      )}
      <SecondaryBtn onClick={onManageTeams} data-testid="home-manage-teams-button">
        Manage Teams
      </SecondaryBtn>
      {onHelp && (
        <SecondaryQuietBtn onClick={onHelp} data-testid="home-help-button">
          How to Play
        </SecondaryQuietBtn>
      )}
      {onContact && (
        <>
          <MenuDivider />
          <GhostBtn onClick={onContact} data-testid="home-contact-button">
            Contact / Report Bug
          </GhostBtn>
        </>
      )}
    </MenuGroup>
    {activeSeasonId != null && onContinueSeason != null ? (
      <LeagueTeaserBox data-testid="league-play-teaser">
        <LeagueTeaserTitle>
          <span aria-hidden="true">🏆</span> Continue Season
        </LeagueTeaserTitle>
        <LeagueTeaserSub>{activeSeasonLabel}</LeagueTeaserSub>
        <SecondaryBtn
          onClick={onContinueSeason}
          data-testid="home-continue-season-button"
          style={{ marginTop: "8px" }}
        >
          Continue
        </SecondaryBtn>
      </LeagueTeaserBox>
    ) : (
      <LeagueTeaserBox data-testid="league-play-teaser">
        <LeagueTeaserTitle>
          <span aria-hidden="true">🏆</span> League Mode
        </LeagueTeaserTitle>
        {onStartLeague != null ? (
          <>
            <LeagueTeaserSub>
              Create a season, track standings, and crown a champion.
            </LeagueTeaserSub>
            <SecondaryBtn
              onClick={onStartLeague}
              data-testid="home-browse-leagues-button"
              style={{ marginTop: "8px" }}
            >
              Browse Leagues
            </SecondaryBtn>
          </>
        ) : (
          <LeagueTeaserSub>
            Season schedules, standings, and playoffs are on the roadmap.
          </LeagueTeaserSub>
        )}
      </LeagueTeaserBox>
    )}
    <Attribution>
      Created by <AttributionLink href="https://naftali.dev">naftali.dev</AttributionLink>
    </Attribution>
  </HomeContainer>
);

export default HomeScreen;
