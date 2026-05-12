import * as React from "react";

import type { WizardAction, WizardState } from "../../../wizard/wizardReducer";
import {
  DisabledBadge,
  FieldGroup,
  FieldLabel,
  RadioOption,
  RadioRow,
  SeedInput,
  StepContainer,
  StepTitle,
} from "../styles";

interface Step1Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function Step1({ state, dispatch }: Step1Props): React.ReactElement {
  return (
    <StepContainer>
      <StepTitle>Format &amp; Length</StepTitle>
      <FieldGroup>
        <div>
          <FieldLabel htmlFor="season-name-input">Season name</FieldLabel>
          <SeedInput
            id="season-name-input"
            data-testid="season-name-input"
            value={state.seasonName}
            maxLength={60}
            $fullWidth
            aria-label="Season name"
            onChange={(e) => dispatch({ type: "SET_SEASON_NAME", name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Preset</FieldLabel>
          <RadioRow>
            <RadioOption>
              <input type="radio" checked readOnly />
              Mini (8 teams)
            </RadioOption>
            <RadioOption $disabled>
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
            <RadioOption $disabled>
              <input type="radio" disabled />
              Full <DisabledBadge>Coming soon</DisabledBadge>
            </RadioOption>
          </RadioRow>
        </div>
      </FieldGroup>
    </StepContainer>
  );
}
