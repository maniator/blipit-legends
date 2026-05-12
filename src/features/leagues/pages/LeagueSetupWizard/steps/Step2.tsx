import * as React from "react";

import type { WizardState } from "../../../wizard/wizardReducer";
import { wizardReducer } from "../../../wizard/wizardReducer";
import {
  CheckboxRow,
  ErrorList,
  ErrorText,
  FieldGroup,
  FieldHint,
  FieldLabel,
  RadioOption,
  RadioRow,
  RangeInput,
  SecondaryButton,
  SeedInput,
  SeedRow,
  StepContainer,
  StepTitle,
} from "../styles";

export interface Step2Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
  customTeams: Array<{ id: string; name: string }>;
  errors: string[];
}

export function Step2({ state, dispatch, customTeams, errors }: Step2Props): React.ReactElement {
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
                : "Select teams to include (rest auto-generated)"}
            </FieldLabel>
            {state.teamMode === "mixed" && (
              <FieldHint>
                Handpick at least 1 team and at most 7 teams, then choose your managed team on
                review.
              </FieldHint>
            )}
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
      {errors.length > 0 && (
        <ErrorList role="status" aria-live="polite">
          {errors.map((err) => (
            <ErrorText key={err}>⚠ {err}</ErrorText>
          ))}
        </ErrorList>
      )}
    </StepContainer>
  );
}
