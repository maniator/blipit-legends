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
  /** When provided, shows a "League Mode" button. */
  onLeague?: () => void;
};

const HomeScreen: React.FunctionComponent<Props> = ({
  onNewGame,
  onLoadSaves,
  onManageTeams,
  onResumeCurrent,
  onHelp,
  onCareerStats,
  onContact,
  onLeague,
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
        Exhibition Game
      </PrimaryBtn>
      <SecondaryBtn onClick={onLoadSaves} data-testid="home-load-saves-button">
        Load Saved Game
      </SecondaryBtn>
      {onCareerStats && (
        <SecondaryBtn onClick={onCareerStats} data-testid="home-career-stats-button">
          Career Stats
        </SecondaryBtn>
      )}
      {onLeague && (
        <SecondaryBtn onClick={onLeague} data-testid="home-league-button">
          🏆 League Mode
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
    {!onLeague && (
      <LeagueTeaserBox data-testid="league-play-teaser">
        <LeagueTeaserTitle>
          <span aria-hidden="true">🏆</span> League play coming soon
        </LeagueTeaserTitle>
        <LeagueTeaserSub>
          Season schedules, standings, and playoffs are on the roadmap.
        </LeagueTeaserSub>
      </LeagueTeaserBox>
    )}
    <Attribution>
      Created by <AttributionLink href="https://naftali.dev">naftali.dev</AttributionLink>
    </Attribution>
  </HomeContainer>
);

export default HomeScreen;
