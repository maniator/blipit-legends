import { generateSeed } from "@storage/generateId";

export interface WizardLeague {
  id: string;
  name: string;
  dhEnabled: boolean;
}

export interface WizardState {
  _v: 1;
  step: 1 | 2 | 3 | 5 | 6;
  preset: "mini";
  seasonLength: "sprint";
  /** User-chosen name for the season. Defaults to "Season <year>". */
  seasonName: string;
  leagueCount: 1 | 2;
  leagues: WizardLeague[];
  teamMode: "handpick" | "mixed" | "allAutogen";
  selectedTeamIds: string[];
  autogenTheme: "classic" | "scifi" | "whimsical" | "mix";
  autogenParity: number;
  autogenSeed: string;
  masterSeed: string;
  /** The custom team ID the user will manage. Null means observer mode (allAutogen). */
  userCustomTeamId: string | null;
}

export type WizardAction =
  | { type: "SET_LEAGUE_COUNT"; count: 1 | 2 }
  | { type: "SET_TEAM_MODE"; mode: WizardState["teamMode"] }
  | { type: "TOGGLE_TEAM_SELECT"; teamId: string }
  | { type: "SET_AUTOGEN_THEME"; theme: WizardState["autogenTheme"] }
  | { type: "SET_AUTOGEN_PARITY"; parity: number }
  | { type: "REROLL_AUTOGEN_SEED" }
  | { type: "AUTOFILL_TEAM_SLOTS" }
  | { type: "SET_DH"; leagueIndex: number; enabled: boolean }
  | { type: "SET_MASTER_SEED"; seed: string }
  | { type: "REROLL_MASTER_SEED" }
  | { type: "GO_TO_STEP"; step: WizardState["step"] }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_USER_TEAM"; customTeamId: string | null }
  | { type: "SET_SEASON_NAME"; name: string }
  | { type: "RESET" };

const STEP_ORDER: Array<WizardState["step"]> = [1, 2, 3, 5, 6];

const DEFAULT_LEAGUES: WizardLeague[] = [{ id: "league_0", name: "League", dhEnabled: true }];

export function makeInitialState(): WizardState {
  return {
    _v: 1,
    step: 1,
    preset: "mini",
    seasonLength: "sprint",
    seasonName: `Season ${new Date().getFullYear()}`,
    leagueCount: 1,
    leagues: DEFAULT_LEAGUES,
    teamMode: "mixed",
    selectedTeamIds: [],
    autogenTheme: "classic",
    autogenParity: 50,
    autogenSeed: generateSeed(),
    masterSeed: generateSeed(),
    userCustomTeamId: null,
  };
}

function nextStep(current: WizardState["step"]): WizardState["step"] {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < STEP_ORDER.length - 1) return STEP_ORDER[idx + 1];
  return current;
}

function prevStep(current: WizardState["step"]): WizardState["step"] {
  const idx = STEP_ORDER.indexOf(current);
  if (idx > 0) return STEP_ORDER[idx - 1];
  return current;
}

function buildLeagues(count: 1 | 2, existing: WizardLeague[]): WizardLeague[] {
  const leagues: WizardLeague[] = [];
  for (let i = 0; i < count; i++) {
    leagues.push(existing[i] ?? { id: `league_${i}`, name: `League ${i + 1}`, dhEnabled: true });
  }
  return leagues;
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_LEAGUE_COUNT": {
      return {
        ...state,
        leagueCount: action.count,
        leagues: buildLeagues(action.count, state.leagues),
      };
    }
    case "SET_TEAM_MODE": {
      return { ...state, teamMode: action.mode };
    }
    case "TOGGLE_TEAM_SELECT": {
      const { teamId } = action;
      const already = state.selectedTeamIds.includes(teamId);
      return {
        ...state,
        selectedTeamIds: already
          ? state.selectedTeamIds.filter((id) => id !== teamId)
          : [...state.selectedTeamIds, teamId],
      };
    }
    case "SET_AUTOGEN_THEME": {
      return { ...state, autogenTheme: action.theme };
    }
    case "SET_AUTOGEN_PARITY": {
      return { ...state, autogenParity: action.parity };
    }
    case "REROLL_AUTOGEN_SEED": {
      return { ...state, autogenSeed: generateSeed() };
    }
    case "AUTOFILL_TEAM_SLOTS": {
      return state;
    }
    case "SET_DH": {
      const leagues = state.leagues.map((l, i) =>
        i === action.leagueIndex ? { ...l, dhEnabled: action.enabled } : l,
      );
      return { ...state, leagues };
    }
    case "SET_MASTER_SEED": {
      return { ...state, masterSeed: action.seed };
    }
    case "REROLL_MASTER_SEED": {
      return { ...state, masterSeed: generateSeed() };
    }
    case "GO_TO_STEP": {
      return { ...state, step: action.step };
    }
    case "NEXT_STEP": {
      return { ...state, step: nextStep(state.step) };
    }
    case "PREV_STEP": {
      return { ...state, step: prevStep(state.step) };
    }
    case "SET_USER_TEAM": {
      return { ...state, userCustomTeamId: action.customTeamId };
    }
    case "SET_SEASON_NAME": {
      return { ...state, seasonName: action.name };
    }
    case "RESET": {
      return makeInitialState();
    }
    default: {
      return state;
    }
  }
}

const SESSION_KEY = "league_wizard_v1";

export function loadWizardState(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    if ((parsed as { _v?: unknown })._v !== 1) return null;
    const state = parsed as WizardState;
    // Back-fill seasonName if loading an older session that pre-dates this field.
    return state.seasonName
      ? state
      : { ...state, seasonName: `Season ${new Date().getFullYear()}` };
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable (private browsing, quota exceeded)
  }
}

export function clearWizardState(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
