import * as React from "react";

import { generateDefaultCustomTeamDraft } from "@feat/customTeams/generation/generateDefaultTeam";

import type { EditorAction, EditorState } from "./editorState";
import {
  FieldGroup,
  FieldHint,
  FieldLabel,
  FormSection,
  GenerateBtn,
  IdentityLockHint,
  InlineFieldError,
  ReadOnlyInput,
  SectionHeading,
  TeamInfoGrid,
  TeamInfoSecondRow,
  TextInput,
} from "./styles";

// Module-level counter seeded from the current timestamp so each page load
// produces different defaults, and successive Generate clicks differ within a session.
let _generateCounter = Date.now() | 0;

type Props = {
  state: EditorState;
  isEditMode: boolean;
  dispatch: React.Dispatch<EditorAction>;
  /**
   * Field-id → inline error message map computed by the parent. Only
   * fields whose user has either blurred or attempted-to-submit will
   * appear in this map. Inline copy is the SHORT per-field complement
   * to the canonical summary copy — never duplicates it verbatim.
   */
  inlineErrors?: Record<string, string>;
  /** Called when an input fires `onBlur`; parent records it so an inline message can render. */
  onFieldBlur?: (fieldId: string) => void;
};

export const TeamInfoSection: React.FunctionComponent<Props> = ({
  state,
  isEditMode,
  dispatch,
  inlineErrors,
  onFieldBlur,
}) => {
  const handleGenerate = () => {
    dispatch({ type: "APPLY_DRAFT", draft: generateDefaultCustomTeamDraft(++_generateCounter) });
  };

  const cityTrimmed = state.city.trim();
  const nameTrimmed = state.name.trim();
  const nameError = inlineErrors?.["ct-name"];
  const abbrevError = inlineErrors?.["ct-abbrev"];

  return (
    <FormSection>
      <SectionHeading>Team Info</SectionHeading>
      <TeamInfoGrid>
        <FieldGroup>
          <FieldLabel htmlFor="ct-name">Team Name *</FieldLabel>
          {isEditMode ? (
            <ReadOnlyInput
              id="ct-name"
              value={state.name}
              readOnly
              aria-readonly="true"
              data-testid="custom-team-name-input"
            />
          ) : (
            <>
              <TextInput
                id="ct-name"
                value={state.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })
                }
                onBlur={() => onFieldBlur?.("ct-name")}
                placeholder="e.g. Eagles"
                aria-invalid={nameError ? "true" : undefined}
                aria-describedby={nameError ? "err-ct-name ct-name-hint" : "ct-name-hint"}
                data-testid="custom-team-name-input"
              />
              {nameError && (
                <InlineFieldError id="err-ct-name" data-testid="err-ct-name">
                  {nameError}
                </InlineFieldError>
              )}
              <FieldHint id="ct-name-hint">
                Short name only — displayed as{" "}
                {cityTrimmed || nameTrimmed ? (
                  <strong>
                    {cityTrimmed ? `${cityTrimmed} ` : ""}
                    {nameTrimmed || "…"}
                  </strong>
                ) : (
                  <strong>City Name</strong>
                )}{" "}
                (e.g. Austin Eagles)
              </FieldHint>
            </>
          )}
        </FieldGroup>
        <TeamInfoSecondRow>
          <FieldGroup>
            <FieldLabel htmlFor="ct-abbrev">Abbrev * (2–3 chars)</FieldLabel>
            {isEditMode ? (
              <ReadOnlyInput
                id="ct-abbrev"
                value={state.abbreviation}
                readOnly
                aria-readonly="true"
                data-testid="custom-team-abbreviation-input"
              />
            ) : (
              <>
                <TextInput
                  id="ct-abbrev"
                  value={state.abbreviation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "abbreviation",
                      value: e.target.value.toUpperCase(),
                    })
                  }
                  onBlur={() => onFieldBlur?.("ct-abbrev")}
                  placeholder="e.g. EAG"
                  maxLength={3}
                  aria-invalid={abbrevError ? "true" : undefined}
                  aria-describedby={abbrevError ? "err-ct-abbrev" : undefined}
                  data-testid="custom-team-abbreviation-input"
                />
                {abbrevError && (
                  <InlineFieldError id="err-ct-abbrev" data-testid="err-ct-abbrev">
                    {abbrevError}
                  </InlineFieldError>
                )}
              </>
            )}
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="ct-city">City</FieldLabel>
            {isEditMode ? (
              <ReadOnlyInput
                id="ct-city"
                value={state.city}
                readOnly
                aria-readonly="true"
                data-testid="custom-team-city-input"
              />
            ) : (
              <TextInput
                id="ct-city"
                value={state.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch({ type: "SET_FIELD", field: "city", value: e.target.value })
                }
                placeholder="e.g. Austin"
                data-testid="custom-team-city-input"
              />
            )}
          </FieldGroup>
        </TeamInfoSecondRow>
      </TeamInfoGrid>
      {isEditMode && (
        <IdentityLockHint>
          🔒 Team identity fields and player names are locked after creation.
        </IdentityLockHint>
      )}
      {!isEditMode && (
        <GenerateBtn
          type="button"
          onClick={handleGenerate}
          data-testid="custom-team-regenerate-defaults-button"
        >
          ✨ Generate Random
        </GenerateBtn>
      )}
    </FormSection>
  );
};
