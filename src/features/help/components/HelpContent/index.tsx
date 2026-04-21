import * as React from "react";

import { Li, List, SectionBody, SectionDetails, SectionSummary } from "./styles";

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section: React.FunctionComponent<SectionProps> = ({ title, defaultOpen, children }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen ?? false);
  return (
    <SectionDetails open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <SectionSummary>{title}</SectionSummary>
      <SectionBody>{children}</SectionBody>
    </SectionDetails>
  );
};

const HelpContent: React.FunctionComponent = () => (
  <>
    <Section title="Basics" defaultOpen>
      <List>
        <Li>
          Press <strong>Play Ball!</strong> to start.
        </Li>
        <Li>The game runs automatically pitch-by-pitch — no clicking needed.</Li>
        <Li>Outcomes are randomized but seeded — same seed always plays out the same way.</Li>
        <Li>3 strikes = out · 4 balls = walk · 3 outs = half-inning over.</Li>
        <Li>
          Home team wins if ahead after the top of the 9th. Walk-off ends the game immediately.
        </Li>
      </List>
    </Section>

    <Section title="Pre-game customization">
      <List>
        <Li>
          Select your <strong>Home</strong> and <strong>Away</strong> custom teams. Create teams
          first via <strong>Manage Teams</strong> if you haven&apos;t already.
        </Li>
        <Li>
          Under <strong>Manage a team?</strong> pick Home, Away, or None. You can also change this
          after the game starts.
        </Li>
        <Li>
          When managing a team with at least one SP-eligible pitcher, a{" "}
          <strong>Starting Pitcher</strong> dropdown appears during pre-game setup so you can choose
          who starts. If the managed team has no SP-eligible pitchers, you&apos;ll see a validation
          error when starting the game — add a starter in <strong>Manage Teams</strong> first.
        </Li>
        <Li>
          Enter a <strong>Seed</strong> for a repeatable game, or leave blank for random.
        </Li>
      </List>
    </Section>

    <Section title="Custom Teams">
      <List>
        <Li>
          Click <strong>Manage Teams</strong> to create and edit your own teams with custom players
          and positions.
        </Li>
        <Li>
          Use <strong>✨ Generate Random</strong> to create a randomized team as a starting point.
          Edit player positions and batting handedness to customize it. <strong>Note:</strong>{" "}
          player names and core stat values (Contact, Power, Speed, Velocity, Control, Movement) are
          fixed at creation and cannot be changed afterward. Stamina (Durability) is the exception —
          it can be adjusted at any time on the team edit page.
        </Li>
        <Li>
          Each team needs at least one lineup player and one pitcher before it can be used in a
          game.
        </Li>
        <Li>
          Pitchers are marked SP (starter), RP (reliever), or SP/RP (swingman). Only RP-eligible
          pitchers can be used for in-game pitching changes.
        </Li>
      </List>
    </Section>

    <Section title="Player Stats">
      <List>
        <Li>
          <strong>Hitter stats</strong> (total capped at 150):
          <List>
            <Li>
              <strong>Contact</strong> — how often the batter puts the ball in play; higher contact
              reduces pop-outs and strikeouts.
            </Li>
            <Li>
              <strong>Power</strong> — home run potential and extra-base hit probability.
            </Li>
            <Li>
              <strong>Speed</strong> — stolen-base success rate, extra-base advancement, and beating
              double-play balls.
            </Li>
          </List>
        </Li>
        <Li>
          <strong>Pitcher stats</strong> (total capped at 160):
          <List>
            <Li>
              <strong>Velocity</strong> — harder to make solid contact; raises the strike
              probability on called pitches.
            </Li>
            <Li>
              <strong>Control</strong> — strike-to-ball ratio; reduces walks.
            </Li>
            <Li>
              <strong>Movement</strong> — increases pop-out / soft-contact rate; makes the ball
              harder to square up.
            </Li>
          </List>
        </Li>
        <Li>
          <strong>Durability (Stamina)</strong> — shown separately and{" "}
          <em>does not count toward the stat cap</em>. Controls how quickly a player tires within a
          game:
          <List>
            <Li>
              <strong>Batting Stamina</strong> — high-stamina batters stay sharp through their 4th+
              plate appearance of the game; low-stamina batters start to lose contact and power
              earlier.
            </Li>
            <Li>
              <strong>Pitching Stamina</strong> — high-stamina starters can work deep into games
              before their velocity and movement fade; low-stamina pitchers need to be pulled
              earlier.
            </Li>
            <Li>
              Unlike core stats, stamina can be adjusted after creation via the team edit page. It
              resets to the player&apos;s configured value at the start of every game and does{" "}
              <em>not</em> accumulate across games.
            </Li>
          </List>
        </Li>
      </List>
    </Section>

    <Section title="Game Flow">
      <List>
        <Li>The game runs automatically once started — sit back and watch.</Li>
        <Li>
          Choose <strong>Slow / Normal / Fast / Instant</strong> speed to control the pace. Instant
          plays pitches with no delay between them and still pauses for Manager Mode decisions.
        </Li>
        <Li>
          🔊 slider = play-by-play voice volume · 🎵 slider = music + in-game chimes/fanfare volume.
        </Li>
      </List>
    </Section>

    <Section title="Manager Mode">
      <List>
        <Li>
          Enable <strong>Manager Mode</strong>, pick which team to manage, and choose a{" "}
          <strong>Strategy</strong> (Balanced, Aggressive, Patient, Contact, or Power).
        </Li>
        <Li>
          The game keeps running between decisions. At key moments it pauses and asks — steal, bunt,
          intentional walk, pinch-hitter, or defensive shift.
        </Li>
        <Li>
          On a <strong>0-2 count</strong>, the game pauses to ask whether to{" "}
          <strong>Protect</strong> (a contact-first defensive swing that trades power for
          bat-on-ball, reducing strikeout risk) or swing normally. Protecting is generally smart
          when a strikeout would end a rally.
        </Li>
        <Li>
          A chime sounds and a browser notification appears (if allowed) when a decision is ready.
        </Li>
        <Li>You have 10 seconds to decide; the game auto-skips if you don&apos;t.</Li>
        <Li>
          Click <strong>🔄 Substitution</strong> to make in-game roster changes: swap a batter from
          the bench or make a pitching change. Pitching changes show how many batters the current
          pitcher has faced (BF). Once a player is substituted out they cannot re-enter.
        </Li>
        <Li>
          The opposing (unmanaged) team makes its own AI decisions — pitching changes when their
          pitcher is tired, etc.
        </Li>
      </List>
    </Section>

    <Section title="Decision Tuning">
      <List>
        <Li>
          Open the <strong>⚙️ Decision Tuning</strong> panel (visible while Manager Mode is on) to
          adjust how aggressively the game offers tactical decisions and how the unmanaged AI plays.
          Settings persist locally and are saved with each game.
        </Li>
        <Li>
          <strong>Steal attempts</strong> — master switch for stolen bases. When off, neither you
          nor the AI is ever offered or attempts a steal (a team-wide stop sign). When on, the two
          steal threshold sliders below control how aggressively steals are attempted.
        </Li>
        <Li>
          <strong>Steal offer threshold</strong> — sets how confident the steal must look before
          you&apos;re prompted. Higher = you&apos;re only prompted on near-sure things; lower = more
          frequent steal prompts (with more risk).
        </Li>
        <Li>
          <strong>AI steal threshold</strong> — the same idea for the unmanaged AI. It is capped at
          the offer threshold so the AI never attempts steals it wouldn&apos;t even prompt you for.
        </Li>
        <Li>
          <strong>Sacrifice bunt</strong> — when on, the game offers a sac bunt in late close games,
          when you&apos;re tied or trailing, with a runner on and a manageable count. When off, no
          bunt is ever offered or attempted.
        </Li>
        <Li>
          <strong>Intentional walk (IBB)</strong> — when on, an IBB is offered late in close games
          with first base open and two outs.
        </Li>
        <Li>
          <strong>Pinch hitter</strong> — when on, pinch-hit candidates are offered late in the game
          with runners in scoring position.
        </Li>
        <Li>
          <strong>Defensive shift</strong> — defaults to <strong>off</strong> to reflect the 2023
          MLB shift restriction. Turn it on for a pre-2023 / old-school experience.
        </Li>
        <Li>
          <strong>AI pitching aggressiveness</strong> — controls how quickly the unmanaged AI pulls
          a tired pitcher. Old-school = complete-game era; Modern = average MLB usage; Bullpen =
          quick hooks and lots of relievers.
        </Li>
        <Li>
          Click <strong>Reset to defaults</strong> to restore the recommended values at any time.
        </Li>
      </List>
    </Section>

    <Section title="Live batting stats">
      <List>
        <Li>
          The <strong>Batting Stats</strong> panel shows AB, H, BB, K, and RBI for every batter.
        </Li>
        <Li>
          Tap or click a batter&apos;s row to see <strong>Player Details</strong> — expanded stats
          appear below the table.
        </Li>
        <Li>The game keeps running while you browse stats.</Li>
      </List>
    </Section>

    <Section title="Saves">
      <List>
        <Li>
          Click <strong>💾 Saves</strong> to save, load, export, or import a game. Saves are stored
          locally — no account needed.
        </Li>
        <Li>
          <strong>Export save</strong> downloads a JSON file you can back up or share.{" "}
          <strong>Import save</strong> restores it.
        </Li>
      </List>
    </Section>

    <Section title="Hit types">
      <List>
        <Li>
          <strong>Single</strong> — batter to 1st; runner on 3rd scores; others advance one base.
        </Li>
        <Li>
          <strong>Double</strong> — batter to 2nd; runners on 2nd/3rd score; runner on 1st to 3rd.
        </Li>
        <Li>
          <strong>Triple</strong> — batter to 3rd; all runners score.
        </Li>
        <Li>
          <strong>Home run</strong> — everyone scores.
        </Li>
        <Li>
          <strong>Walk</strong> — batter to 1st; force advancement only.
        </Li>
      </List>
    </Section>

    <Section title="Reporting issues">
      <List>
        <Li>
          Spotted a bug or something unexpected? Use the <strong>Contact / Report Bug</strong>{" "}
          button at the bottom of the home screen to open a pre-filled GitHub issue or send a direct
          email.
        </Li>
      </List>
    </Section>
  </>
);

export default HelpContent;
