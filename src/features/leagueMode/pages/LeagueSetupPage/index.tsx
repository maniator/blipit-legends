import * as React from "react";

import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { leagueSeasonStore } from "@feat/leagueMode/storage/leagueSeasonStore";
import { leagueStore } from "@feat/leagueMode/storage/leagueStore";
import { scheduledGameStore } from "@feat/leagueMode/storage/scheduledGameStore";
import { generateSchedule } from "@feat/leagueMode/utils/scheduleGeneration";
import { useNavigate } from "react-router";

import { generateSeed } from "@storage/generateId";
import type { TeamWithRoster } from "@storage/types";

import {
  BackBtn,
  EmptyTeamsMessage,
  ErrorMessage,
  FieldGroup,
  FieldHint,
  FieldLabel,
  Input,
  MultiSelect,
  PageContainer,
  PageHeader,
  PageTitle,
  SubmitButton,
  ValidationError,
} from "./styles";

const MIN_TEAMS = 2;
const MAX_TEAMS = 16;
const DEFAULT_GAMES_PER_TEAM = 30;
const MIN_GAMES_PER_TEAM = 6;
const MAX_GAMES_PER_TEAM = 162;

const LeagueSetupPage: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const [name, setName] = React.useState("");
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [gamesPerTeam, setGamesPerTeam] = React.useState(DEFAULT_GAMES_PER_TEAM);

  const [availableTeams, setAvailableTeams] = React.useState<TeamWithRoster[]>([]);
  const [loadingTeams, setLoadingTeams] = React.useState(true);

  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingTeams(true);
    CustomTeamStore.listCustomTeams({ withRoster: false })
      .then((teams) => {
        if (!cancelled) {
          setAvailableTeams(teams);
          setLoadingTeams(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingTeams(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTeamSelectChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    setSelectedTeamIds(options.map((opt) => opt.value));
  }, []);

  const handleGamesPerTeamChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGamesPerTeam(Number(e.target.value));
  }, []);

  const validate = React.useCallback((): string | null => {
    if (!name.trim()) return "League name is required.";
    if (selectedTeamIds.length < MIN_TEAMS)
      return `Select at least ${MIN_TEAMS} teams to form a league.`;
    if (selectedTeamIds.length > MAX_TEAMS) return `You can select at most ${MAX_TEAMS} teams.`;
    if (
      !Number.isInteger(gamesPerTeam) ||
      gamesPerTeam < MIN_GAMES_PER_TEAM ||
      gamesPerTeam > MAX_GAMES_PER_TEAM
    )
      return `Games per team must be between ${MIN_GAMES_PER_TEAM} and ${MAX_GAMES_PER_TEAM}.`;
    return null;
  }, [name, selectedTeamIds, gamesPerTeam]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const err = validate();
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      setIsSubmitting(true);

      try {
        // 1. Create league
        const league = await leagueStore.createLeague({
          name: name.trim(),
          teamIds: selectedTeamIds,
          divisionCount: 1,
          status: "active",
        });

        // 2. Compute totalGameDays analytically (avoids generating schedule twice).
        //    Mirrors the round-robin math in scheduleGeneration.ts:
        //      paddedN     = even team count (pad with bye if needed)
        //      roundsPerPass = paddedN - 1
        //      seriesLength  = 3 (default, matches generateSchedule default)
        //      totalPasses   = ceil(gamesPerTeam / gamesPerPassPerTeam)
        //      totalGameDays = totalPasses * roundsPerPass * seriesLength
        const seriesLength = 3;
        const paddedN =
          selectedTeamIds.length % 2 === 0 ? selectedTeamIds.length : selectedTeamIds.length + 1;
        const roundsPerPass = paddedN - 1;
        const hasOddTeams = selectedTeamIds.length % 2 !== 0;
        const nonByeRoundsPerPass = hasOddTeams ? roundsPerPass - 1 : roundsPerPass;
        const gamesPerPassPerTeam = nonByeRoundsPerPass * seriesLength;
        const totalPasses = Math.ceil(gamesPerTeam / gamesPerPassPerTeam);
        const totalGameDays = totalPasses * roundsPerPass * seriesLength;

        // 3. Create league season (auto-generates its own ID)
        const season = await leagueSeasonStore.createLeagueSeason({
          leagueId: league.id,
          seasonNumber: 1,
          status: "pending",
          currentGameDay: 1,
          totalGameDays,
          defaultGamesPerTeam: gamesPerTeam,
          seed: generateSeed(),
        });

        // 4. Generate schedule with the actual season ID
        const games = generateSchedule({
          leagueSeasonId: season.id,
          teamIds: selectedTeamIds,
          gamesPerTeam,
        });

        // 5. Bulk-insert scheduled games
        await scheduledGameStore.bulkCreateScheduledGames(games);

        // 6. Link season to league
        await leagueStore.updateLeague(league.id, {
          activeLeagueSeasonId: season.id,
        });

        // 7. Navigate to the league detail page
        navigate(`/league/${league.id}`);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, name, selectedTeamIds, gamesPerTeam, navigate],
  );

  return (
    <PageContainer data-testid="league-setup-page">
      <PageHeader>
        <BackBtn
          type="button"
          onClick={() => navigate("/")}
          data-testid="league-setup-back-button"
          aria-label="Back to Home"
        >
          ← Back to Home
        </BackBtn>
      </PageHeader>

      <PageTitle>🏆 New League</PageTitle>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <FieldLabel htmlFor="league-name">League Name</FieldLabel>
          <Input
            id="league-name"
            type="text"
            data-testid="league-name-input"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="e.g. Summer Classic League"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel htmlFor="league-teams">Teams</FieldLabel>
          {loadingTeams ? (
            <EmptyTeamsMessage>Loading teams…</EmptyTeamsMessage>
          ) : availableTeams.length === 0 ? (
            <EmptyTeamsMessage>
              No custom teams found. Create teams in Manage Teams first.
            </EmptyTeamsMessage>
          ) : (
            <MultiSelect
              id="league-teams"
              multiple
              data-testid="league-teams-select"
              value={selectedTeamIds}
              onChange={handleTeamSelectChange}
              size={Math.min(availableTeams.length, 8)}
            >
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </MultiSelect>
          )}
          <FieldHint>
            Hold Ctrl / Cmd to select multiple teams ({MIN_TEAMS}–{MAX_TEAMS} teams required).
          </FieldHint>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel htmlFor="league-games-per-team">Games per Team</FieldLabel>
          <Input
            id="league-games-per-team"
            type="number"
            data-testid="league-games-per-team-input"
            value={gamesPerTeam}
            onChange={handleGamesPerTeamChange}
            min={MIN_GAMES_PER_TEAM}
            max={MAX_GAMES_PER_TEAM}
          />
          <FieldHint>
            Number of non-bye games each team plays ({MIN_GAMES_PER_TEAM}–{MAX_GAMES_PER_TEAM}).
          </FieldHint>
        </FieldGroup>

        {validationError && (
          <ValidationError role="alert" data-testid="league-setup-validation-error">
            ⚠ {validationError}
          </ValidationError>
        )}

        {submitError && (
          <ErrorMessage role="alert" data-testid="league-setup-submit-error">
            {submitError}
          </ErrorMessage>
        )}

        <SubmitButton
          type="submit"
          disabled={isSubmitting || loadingTeams}
          data-testid="start-league-button"
        >
          {isSubmitting ? "Creating…" : "Start League"}
        </SubmitButton>
      </form>
    </PageContainer>
  );
};

export default LeagueSetupPage;
