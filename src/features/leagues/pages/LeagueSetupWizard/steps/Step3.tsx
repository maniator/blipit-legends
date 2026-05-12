import * as React from "react";

import type { WizardAction, WizardState } from "../../../wizard/wizardReducer";
import {
  FieldGroup,
  FieldLabel,
  RadioOption,
  RadioRow,
  SecondaryButton,
  StepContainer,
  StepTitle,
} from "../styles";

export interface Step3Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step3({ state, dispatch }: Step3Props): React.ReactElement {
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
