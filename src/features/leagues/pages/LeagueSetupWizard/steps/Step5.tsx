import * as React from "react";

import type { WizardState } from "../../../wizard/wizardReducer";
import { wizardReducer } from "../../../wizard/wizardReducer";
import {
  ErrorList,
  ErrorText,
  FieldGroup,
  FieldLabel,
  HintText,
  SecondaryButton,
  SeedInput,
  SeedRow,
  StepContainer,
  StepTitle,
} from "../styles";

export interface Step5Props {
  state: WizardState;
  dispatch: React.Dispatch<Parameters<typeof wizardReducer>[1]>;
  errors: string[];
}

export function Step5({ state, dispatch, errors }: Step5Props): React.ReactElement {
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
          <HintText>Same seed → identical season schedule and outcomes.</HintText>
        </div>
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
