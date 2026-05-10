import * as React from "react";

import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { generateLeagueTeams } from "@feat/league/autogen/generateLeagueTeams";
import { createSeason, quickStart } from "@feat/league/storage/leagueStore";
import { generateTeamId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import { useActiveSeason } from "@feat/leagues/hooks/useActiveSeason";
import ModalShell from "@shared/components/ModalShell";
import StatusBanner from "@shared/components/StatusBanner";
import { useNavigate } from "react-router";

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
  onCreateSeason: () => void;
  creating: boolean;
  errors: string[];
}

function Step6({ state, onCreateSeason, creating, errors }: Step6Props): React.ReactElement {
  const teamModeLabel =
    state.teamMode === "allAutogen"
      ? "All autogenerated"
      : state.teamMode === "mixed"
        ? `Mixed (${state.selectedTeamIds.length} handpicked)`
        : `Handpicked (${state.selectedTeamIds.length} teams)`;

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

export default function LeagueSetupWizard(): React.ReactElement {
  const navigate = useNavigate();
  const { activeSeason, loading } = useActiveSeason();

  const [state, dispatch] = React.useReducer(wizardReducer, undefined, () => {
    return loadWizardState() ?? makeInitialState();
  });

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
        let teamIds = state.selectedTeamIds;

        if (state.teamMode === "mixed") {
          const remainingCount = 8 - state.selectedTeamIds.length;
          const autogenSubSeed = fnv1a(`${state.masterSeed}:autogen:mixed`);
          const generated = generateLeagueTeams({
            count: remainingCount,
            theme: state.autogenTheme,
            parity:
              state.autogenParity <= 25
                ? "random"
                : state.autogenParity <= 75
                  ? "balanced"
                  : "mixed",
            masterSeed: state.masterSeed,
            autogenSubSeed,
            rosterMinimums: {
              lineup: 9,
              bench: 3,
              startingPitchers: 5,
              reliefPitchers: 3,
            },
            idFactory: { teamId: () => generateTeamId() },
          });

          for (const gen of generated) {
            await CustomTeamStore.createCustomTeam(
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
          }

          teamIds = [...state.selectedTeamIds, ...generated.map((g) => g.id)];
        }

        season = await createSeason({
          name: "New Season",
          masterSeed: state.masterSeed,
          preset: "mini",
          seasonLength: "sprint",
          leagues: state.leagues.map((l) => ({
            id: l.id,
            name: l.name,
            teamIds,
            dhEnabled: l.dhEnabled,
          })),
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
            <DangerButton type="button" onClick={() => setShowAbandonDialog(false)}>
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
        return <Step2 state={state} dispatch={dispatch} customTeams={[]} />;
      case 3:
        return <Step3 state={state} dispatch={dispatch} />;
      case 5:
        return <Step5 state={state} dispatch={dispatch} />;
      case 6:
        return (
          <Step6
            state={state}
            onCreateSeason={handleCreateSeason}
            creating={creating}
            errors={[...(createError !== null ? [createError] : []), ...step6Errors]}
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
