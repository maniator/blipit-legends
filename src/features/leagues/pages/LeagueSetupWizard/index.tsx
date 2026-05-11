import * as React from "react";

import { makeCustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { generateLeagueTeams } from "@feat/league/autogen/generateLeagueTeams";
import { createSeason, quickStart } from "@feat/league/storage/leagueStore";
import { useActiveSeason } from "@feat/leagues/hooks/useActiveSeason";
import ModalShell from "@shared/components/ModalShell";
import StatusBanner from "@shared/components/StatusBanner";
import { appLog } from "@shared/utils/logger";
import { useNavigate, useSearchParams } from "react-router";
import { RxDatabaseProvider, useLiveRxQuery } from "rxdb/plugins/react";

import { type BallgameDb, getDb } from "@storage/db";
import { generateTeamId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import type { TeamRecord } from "@storage/types";

import { validateAllSteps } from "../../wizard/validateWizardState";
import type { WizardState } from "../../wizard/wizardReducer";
import {
  clearWizardState,
  loadWizardState,
  makeInitialState,
  saveWizardState,
  wizardReducer,
} from "../../wizard/wizardReducer";
import {
  AbandonDialog,
  AbandonDialogActions,
  ActionButton,
  CheckboxRow,
  DangerButton,
  DisabledBadge,
  FieldGroup,
  FieldLabel,
  FooterActions,
  RadioOption,
  RadioRow,
  RangeInput,
  SecondaryButton,
  SeedInput,
  SeedRow,
  StepContainer,
  StepTitle,
  SummaryKey,
  SummaryTable,
  SummaryValue,
} from "./styles";

// ---------------------------------------------------------------------------
// Step renderers
// ---------------------------------------------------------------------------

function Step1(): React.ReactElement {
  return (
    <StepContainer>
      <StepTitle>Format &amp; Length</StepTitle>
      <FieldGroup>
        <div>
          <FieldLabel>Preset</FieldLabel>
          <RadioRow>
            <RadioOption>
              <input type="radio" checked readOnly />
              Mini (8 teams)
            </RadioOption>
            <RadioOption style={{ opacity: 0.5 }}>
              <input type="radio" disabled />
              Standard <DisabledBadge>Coming soon</DisabledBadge>
            </RadioOption>
          </RadioRow>
        </div>
        <div>
          <FieldLabel>Season length</FieldLabel>
          <RadioRow>
            <RadioOption>
              <input type="radio" checked readOnly />
              Sprint (14 games/team)
            </RadioOption>
            <RadioOption style={{ opacity: 0.5 }}>
              <input type="radio" disabled />
              Full <DisabledBadge>Coming soon</DisabledBadge>
            </RadioOption>
          </RadioRow>
        </div>
      </FieldGroup>
    </StepContainer>
  );
}

interface Step2Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
  customTeams: Array<{ id: string; name: string }>;
}

function Step2({ state, dispatch, customTeams }: Step2Props): React.ReactElement {
  return (
    <StepContainer>
      <StepTitle>Team Setup</StepTitle>
      <FieldGroup>
        <div>
          <FieldLabel>Team mode</FieldLabel>
          <RadioRow>
            {(["allAutogen", "mixed", "handpick"] as const).map((mode) => (
              <RadioOption key={mode}>
                <input
                  type="radio"
                  name="teamMode"
                  checked={state.teamMode === mode}
                  onChange={() => dispatch({ type: "SET_TEAM_MODE", mode })}
                />
                {mode === "allAutogen" ? "All autogen" : mode === "mixed" ? "Mixed" : "Handpick"}
              </RadioOption>
            ))}
          </RadioRow>
        </div>

        {state.teamMode !== "allAutogen" && (
          <div>
            <FieldLabel>
              {state.teamMode === "handpick"
                ? "Select exactly 8 teams"
                : "Select teams to include (rest autogenned)"}
            </FieldLabel>
            {customTeams.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
                No custom teams found. Switch to All autogen.
              </p>
            ) : (
              customTeams.map((team) => (
                <CheckboxRow key={team.id}>
                  <input
                    type="checkbox"
                    checked={state.selectedTeamIds.includes(team.id)}
                    onChange={() => dispatch({ type: "TOGGLE_TEAM_SELECT", teamId: team.id })}
                  />
                  {team.name}
                </CheckboxRow>
              ))
            )}
          </div>
        )}

        {state.teamMode !== "handpick" && (
          <div>
            <FieldLabel>Autogen theme</FieldLabel>
            <RadioRow>
              {(["classic", "scifi", "whimsical", "mix"] as const).map((theme) => (
                <RadioOption key={theme}>
                  <input
                    type="radio"
                    name="autogenTheme"
                    checked={state.autogenTheme === theme}
                    onChange={() => dispatch({ type: "SET_AUTOGEN_THEME", theme })}
                  />
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </RadioOption>
              ))}
            </RadioRow>
            <div style={{ marginTop: "12px" }}>
              <FieldLabel>Team parity ({state.autogenParity})</FieldLabel>
              <SeedRow>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Lopsided</span>
                <RangeInput
                  type="range"
                  min={0}
                  max={100}
                  value={state.autogenParity}
                  onChange={(e) =>
                    dispatch({ type: "SET_AUTOGEN_PARITY", parity: Number(e.target.value) })
                  }
                />
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Balanced</span>
              </SeedRow>
            </div>
            <div style={{ marginTop: "12px" }}>
              <FieldLabel>Autogen seed</FieldLabel>
              <SeedRow>
                <SeedInput value={state.autogenSeed} readOnly aria-label="Autogen seed" />
                <SecondaryButton
                  type="button"
                  onClick={() => dispatch({ type: "REROLL_AUTOGEN_SEED" })}
                >
                  Re-roll
                </SecondaryButton>
              </SeedRow>
            </div>
          </div>
        )}
      </FieldGroup>
    </StepContainer>
  );
}

interface Step3Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
}

function Step3({ state, dispatch }: Step3Props): React.ReactElement {
  const applyDhPreset = (preset: "universal" | "classic" | "pitchers") => {
    state.leagues.forEach((_, i) => {
      const enabled = preset === "universal" ? true : preset === "pitchers" ? false : i === 0;
      dispatch({ type: "SET_DH", leagueIndex: i, enabled });
    });
  };

  return (
    <StepContainer>
      <StepTitle>Designated Hitter</StepTitle>
      <FieldGroup>
        <div>
          <FieldLabel>Quick presets</FieldLabel>
          <RadioRow>
            <SecondaryButton type="button" onClick={() => applyDhPreset("universal")}>
              Universal DH
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => applyDhPreset("classic")}>
              Classic AL/NL
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => applyDhPreset("pitchers")}>
              Pitchers Hit
            </SecondaryButton>
          </RadioRow>
        </div>
        {state.leagues.map((league, i) => (
          <div key={league.id}>
            <FieldLabel>{league.name} — DH rule</FieldLabel>
            <RadioRow>
              <RadioOption>
                <input
                  type="radio"
                  name={`dh_${i}`}
                  checked={league.dhEnabled}
                  onChange={() => dispatch({ type: "SET_DH", leagueIndex: i, enabled: true })}
                />
                On
              </RadioOption>
              <RadioOption>
                <input
                  type="radio"
                  name={`dh_${i}`}
                  checked={!league.dhEnabled}
                  onChange={() => dispatch({ type: "SET_DH", leagueIndex: i, enabled: false })}
                />
                Off (pitchers hit)
              </RadioOption>
            </RadioRow>
          </div>
        ))}
      </FieldGroup>
    </StepContainer>
  );
}

interface Step5Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
}

function Step5({ state, dispatch }: Step5Props): React.ReactElement {
  return (
    <StepContainer>
      <StepTitle>Season Seed</StepTitle>
      <FieldGroup>
        <div>
          <FieldLabel>Master seed</FieldLabel>
          <SeedRow>
            <SeedInput
              value={state.masterSeed}
              onChange={(e) => dispatch({ type: "SET_MASTER_SEED", seed: e.target.value })}
              aria-label="Master seed"
              data-testid="master-seed-input"
            />
            <SecondaryButton type="button" onClick={() => dispatch({ type: "REROLL_MASTER_SEED" })}>
              Re-roll
            </SecondaryButton>
          </SeedRow>
          <p style={{ margin: "8px 0 0", fontSize: "11px", opacity: 0.7 }}>
            Same seed → identical season schedule and outcomes.
          </p>
        </div>
      </FieldGroup>
    </StepContainer>
  );
}

interface Step6Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
  onCreateSeason: () => void;
  creating: boolean;
  errors: string[];
  customTeams: Array<{ id: string; name: string }>;
}

function Step6({
  state,
  dispatch,
  onCreateSeason,
  creating,
  errors,
  customTeams,
}: Step6Props): React.ReactElement {
  const teamModeLabel =
    state.teamMode === "allAutogen"
      ? "All autogenerated"
      : state.teamMode === "mixed"
        ? `Mixed (${state.selectedTeamIds.length} handpicked)`
        : `Handpicked (${state.selectedTeamIds.length} teams)`;

  // Build team name lookup for the "which team will you manage?" selector.
  const teamNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of customTeams) {
      map[t.id] = t.name;
    }
    return map;
  }, [customTeams]);

  return (
    <StepContainer>
      <StepTitle>Review &amp; Create</StepTitle>
      <SummaryTable>
        <SummaryKey>Preset</SummaryKey>
        <SummaryValue>Mini · Sprint</SummaryValue>
        <SummaryKey>Leagues</SummaryKey>
        <SummaryValue>{state.leagueCount}</SummaryValue>
        <SummaryKey>Teams</SummaryKey>
        <SummaryValue>{teamModeLabel}</SummaryValue>
        {state.teamMode !== "handpick" && (
          <>
            <SummaryKey>Theme</SummaryKey>
            <SummaryValue>
              {state.autogenTheme.charAt(0).toUpperCase() + state.autogenTheme.slice(1)}
            </SummaryValue>
          </>
        )}
        {state.leagues.map((league) => (
          <React.Fragment key={league.id}>
            <SummaryKey>{league.name} DH</SummaryKey>
            <SummaryValue>{league.dhEnabled ? "On" : "Off"}</SummaryValue>
          </React.Fragment>
        ))}
        <SummaryKey>Master seed</SummaryKey>
        <SummaryValue>{state.masterSeed || <em>empty</em>}</SummaryValue>
      </SummaryTable>

      <FieldGroup>
        <div>
          <FieldLabel>Which team will you manage?</FieldLabel>
          {state.teamMode === "allAutogen" ? (
            <RadioRow>
              <RadioOption>
                <input type="radio" checked readOnly />
                I&apos;ll pick after the season starts (observer mode)
              </RadioOption>
            </RadioRow>
          ) : (
            <select
              value={state.userCustomTeamId ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_USER_TEAM",
                  customTeamId: e.target.value || null,
                })
              }
              aria-label="Select your team"
            >
              <option value="">— Select a team —</option>
              {state.selectedTeamIds.map((id) => (
                <option key={id} value={id}>
                  {teamNameById[id] ?? id}
                </option>
              ))}
            </select>
          )}
        </div>
      </FieldGroup>

      {errors.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          {errors.map((err) => (
            <p key={err} style={{ color: "#ff8080", fontSize: "12px", margin: "4px 0" }}>
              ⚠ {err}
            </p>
          ))}
        </div>
      )}
      <div style={{ marginTop: "20px" }}>
        <ActionButton
          type="button"
          onClick={onCreateSeason}
          disabled={creating || errors.length > 0}
          data-testid="create-season-button"
        >
          {creating ? "Creating…" : "Create Season"}
        </ActionButton>
      </div>
    </StepContainer>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<number, string> = {
  1: "Format",
  2: "Teams",
  3: "Rules",
  5: "Seed",
  6: "Review",
};

function LeagueSetupWizardInner(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSeason, loading } = useActiveSeason();
  const modeParam = searchParams.get("mode");
  const requestedTeamMode: WizardState["teamMode"] | null =
    modeParam === "allAutogen" ? "allAutogen" : null;

  const customTeamsQuery = React.useMemo(() => ({ selector: {} }), []);
  const { results: customTeamResults } = useLiveRxQuery<TeamRecord>({
    collection: "teams",
    query: customTeamsQuery,
  });
  const customTeams = React.useMemo(
    () =>
      customTeamResults
        .map((d) => d.toJSON() as unknown as TeamRecord)
        .filter((team) => team.metadata?.archived !== true)
        .map((team) => ({ id: team.id, name: team.name })),
    [customTeamResults],
  );

  const [state, dispatch] = React.useReducer(wizardReducer, undefined, () => {
    const base = loadWizardState() ?? makeInitialState();
    if (requestedTeamMode !== "allAutogen") return base;
    const initialState: WizardState = {
      ...base,
      teamMode: "allAutogen",
      userCustomTeamId: null,
    };
    return initialState;
  });

  React.useEffect(() => {
    if (requestedTeamMode !== "allAutogen" || state.teamMode === "allAutogen") return;
    dispatch({ type: "SET_TEAM_MODE", mode: "allAutogen" });
    dispatch({ type: "SET_USER_TEAM", customTeamId: null });
  }, [requestedTeamMode, state.teamMode]);

  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [showAbandonDialog, setShowAbandonDialog] = React.useState(false);
  const abandonDialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    saveWizardState(state);
  }, [state]);

  React.useEffect(() => {
    const dialog = abandonDialogRef.current;
    if (!dialog) return;
    if (showAbandonDialog) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [showAbandonDialog]);

  const handleClose = React.useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleCreateSeason = React.useCallback(async () => {
    setCreateError(null);
    setCreating(true);
    try {
      let season;
      if (state.teamMode === "allAutogen") {
        season = await quickStart({
          masterSeed: state.masterSeed,
          autogenSeed: state.autogenSeed,
          dhEnabled: state.leagues[0]?.dhEnabled ?? true,
          autogenOptions: {
            count: 8,
            theme: state.autogenTheme,
            parity:
              state.autogenParity <= 25
                ? "random"
                : state.autogenParity <= 75
                  ? "balanced"
                  : "mixed",
          },
        });
      } else {
        // Mixed or handpick: selectedTeamIds are the user's custom teams.
        // For mixed mode, fill remaining slots (up to 8) with autogenerated teams.
        const db = await getDb();
        const ctStore = makeCustomTeamStore(() => Promise.resolve(db));
        const allTeamIds = [...state.selectedTeamIds];

        if (state.teamMode === "mixed") {
          const slotsNeeded = 8 - allTeamIds.length;
          if (slotsNeeded > 0) {
            const autogenSubSeed = state.autogenSeed ?? fnv1a(`${state.masterSeed}:autogen:mixed`);
            const generated = generateLeagueTeams({
              count: slotsNeeded,
              theme: state.autogenTheme,
              parity:
                state.autogenParity <= 25
                  ? "random"
                  : state.autogenParity <= 75
                    ? "balanced"
                    : "mixed",
              masterSeed: state.masterSeed,
              autogenSubSeed,
              rosterMinimums: { lineup: 9, bench: 3, startingPitchers: 5, reliefPitchers: 3 },
              idFactory: { teamId: () => generateTeamId() },
            });
            for (const gen of generated) {
              await ctStore.createCustomTeam(
                {
                  name: gen.name,
                  abbreviation: gen.abbreviation,
                  nickname: gen.nickname,
                  city: gen.city,
                  slug: gen.slug,
                  roster: {
                    lineup: gen.roster.lineup,
                    bench: gen.roster.bench,
                    pitchers: gen.roster.pitchers,
                  },
                  metadata: gen.metadata,
                  autogen: gen.autogen,
                  statsProfile: gen.statsProfile,
                },
                { id: gen.id },
              );
              allTeamIds.push(gen.id);
            }
          }
        }

        season = await createSeason({
          name: "New Season",
          masterSeed: state.masterSeed,
          preset: "mini",
          seasonLength: "sprint",
          leagues: state.leagues.map((l) => ({
            id: l.id,
            name: l.name,
            teamIds: allTeamIds,
            dhEnabled: l.dhEnabled,
          })),
          userCustomTeamId: state.userCustomTeamId,
        });
      }
      clearWizardState();
      navigate(`/leagues/${season.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create season.");
      setCreating(false);
    }
  }, [state, navigate]);

  const step6Errors = React.useMemo(
    () => (state.step === 6 ? validateAllSteps(state) : []),
    [state],
  );

  const isFirstStep = state.step === 1;
  const isLastStep = state.step === 6;

  const footer = (
    <FooterActions>
      <SecondaryButton
        type="button"
        onClick={() => dispatch({ type: "PREV_STEP" })}
        disabled={isFirstStep || creating}
      >
        ← Back
      </SecondaryButton>
      {!isLastStep && (
        <ActionButton
          type="button"
          onClick={() => dispatch({ type: "NEXT_STEP" })}
          disabled={creating}
        >
          Next →
        </ActionButton>
      )}
    </FooterActions>
  );

  const stepLabel = STEP_LABELS[state.step] ?? `Step ${state.step}`;
  const title = `New Season — ${stepLabel}`;

  if (!loading && activeSeason !== null) {
    const continueAction = (
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <ActionButton type="button" onClick={() => navigate(`/leagues/${activeSeason.id}`)}>
          Continue current season
        </ActionButton>
        <DangerButton type="button" onClick={() => setShowAbandonDialog(true)}>
          Abandon season
        </DangerButton>
      </div>
    );

    return (
      <>
        <div data-testid="league-setup-wizard" style={{ padding: "24px" }}>
          <StatusBanner variant="warn" title="Active season in progress" action={continueAction}>
            You already have an active season. Finish or abandon it before creating a new one.
          </StatusBanner>
        </div>

        <AbandonDialog
          ref={abandonDialogRef}
          role="alertdialog"
          aria-labelledby="abandon-title"
          aria-describedby="abandon-desc"
        >
          <h2 id="abandon-title" style={{ margin: "0 0 12px" }}>
            Abandon &apos;{activeSeason.name}&apos;?
          </h2>
          <p id="abandon-desc" style={{ margin: 0 }}>
            In-flight games are kept for reference but the season won&apos;t continue. This cannot
            be undone.
          </p>
          <AbandonDialogActions>
            <SecondaryButton type="button" onClick={() => setShowAbandonDialog(false)}>
              Cancel
            </SecondaryButton>
            <DangerButton
              type="button"
              onClick={async () => {
                if (!activeSeason) return;
                const db = await getDb();
                const seasonDoc = await db.seasons.findOne(activeSeason.id).exec();
                if (seasonDoc) {
                  await seasonDoc.patch({ status: "abandoned", completedAt: Date.now() });
                }
                setShowAbandonDialog(false);
              }}
            >
              Abandon
            </DangerButton>
          </AbandonDialogActions>
        </AbandonDialog>
      </>
    );
  }

  const stepContent = (() => {
    switch (state.step) {
      case 1:
        return <Step1 />;
      case 2:
        return <Step2 state={state} dispatch={dispatch} customTeams={customTeams} />;
      case 3:
        return <Step3 state={state} dispatch={dispatch} />;
      case 5:
        return <Step5 state={state} dispatch={dispatch} />;
      case 6:
        return (
          <Step6
            state={state}
            dispatch={dispatch}
            onCreateSeason={handleCreateSeason}
            creating={creating}
            errors={[...(createError !== null ? [createError] : []), ...step6Errors]}
            customTeams={customTeams}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div data-testid="league-setup-wizard">
      <ModalShell title={title} onClose={handleClose} open footer={footer}>
        {stepContent}
      </ModalShell>
    </div>
  );
}

export default function LeagueSetupWizard(): React.ReactElement {
  const [db, setDb] = React.useState<BallgameDb | null>(null);

  React.useEffect(() => {
    getDb()
      .then(setDb)
      .catch((err: unknown) => appLog.error("[LeagueSetupWizard] DB init failed:", err));
  }, []);

  if (!db) {
    return (
      <div data-testid="league-setup-wizard" style={{ padding: "24px" }}>
        Loading…
      </div>
    );
  }

  return (
    <RxDatabaseProvider
      database={db as unknown as Parameters<typeof RxDatabaseProvider>[0]["database"]}
    >
      <LeagueSetupWizardInner />
    </RxDatabaseProvider>
  );
}
