import * as React from "react";

import { resolveCustomIdsInString } from "@feat/customTeams/adapters/customTeamAdapter";
import type { GameAction } from "@feat/gameplay/context/index";
import { GameProviderWrapper } from "@feat/gameplay/context/index";
import { cancelAnnouncements } from "@feat/gameplay/utils/announce";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { appLog } from "@shared/utils/logger";
import { RxDatabaseProvider } from "rxdb/plugins/react";

import type { BallgameDb } from "@storage/db";
import { getDb, wasDbReset } from "@storage/db";
import type { ExhibitionGameSetup } from "@storage/types";
import type { LeagueGameContext } from "@storage/types";
import type { SaveRecord } from "@storage/types";

import GameInner from "./GameInner";
import { DbResetNotice, LoadingScreen } from "./styles";

type Props = {
  onBackToHome?: () => void;
  /** Called when the in-game New Game button is clicked; navigates to /exhibition/new. */
  onNewGame?: () => void;
  /** Called the first time a real game session starts or a save is loaded. */
  onGameSessionStarted?: () => void;
  /** Setup from /exhibition/new; consumed by GameInner to auto-start a game. */
  pendingGameSetup?: ExhibitionGameSetup | null;
  /** Called after pendingGameSetup is consumed so GamePage can clear it. */
  onConsumeGameSetup?: () => void;
  /** Save loaded from /saves page; consumed by GameInner to restore game state. */
  pendingLoadSave?: SaveRecord | null;
  /** Called after pendingLoadSave is consumed so GamePage can clear it. */
  onConsumePendingLoad?: () => void;
  /** Called when the career stats commit state changes (saving/done). */
  onSavingStateChange?: (saving: boolean) => void;
  /** Called when the game reaches FINAL so AppShell can clear hasActiveSession. */
  onGameOver?: () => void;
  /** League context — present when this game was launched from league mode. */
  leagueGameContext?: LeagueGameContext | null;
  /** Called when the user clicks "← Back to League"; receives the league ID to navigate to. */
  onBackToLeague?: (leagueId: string) => void;
};

const Game: React.FunctionComponent<Props> = ({
  onBackToHome,
  onNewGame,
  onGameSessionStarted,
  pendingGameSetup,
  onConsumeGameSetup,
  pendingLoadSave,
  onConsumePendingLoad,
  onSavingStateChange,
  onGameOver,
  leagueGameContext,
  onBackToLeague,
}) => {
  const actionBufferRef = React.useRef<GameAction[]>([]);
  const [db, setDb] = React.useState<BallgameDb | null>(null);
  const [dbResetNotice, setDbResetNotice] = React.useState(false);

  // Cancel any in-flight TTS when the game page unmounts (e.g. user navigates away).
  React.useEffect(() => {
    return () => {
      cancelAnnouncements();
    };
  }, []);

  // Load custom teams to build the per-call TTS preprocessor that resolves
  // `ct_*` fragments to human-readable names before speech.
  const { teams: customTeams } = useCustomTeams();
  const announcePreprocessor = React.useCallback(
    (msg: string) => resolveCustomIdsInString(msg, customTeams),
    [customTeams],
  );

  React.useEffect(() => {
    getDb()
      .then((resolvedDb) => {
        // Show the reset notice at most once per browser session even if the
        // component unmounts and remounts (e.g. route change).
        if (wasDbReset() && sessionStorage.getItem("db-reset-dismissed") !== "1") {
          setDbResetNotice(true);
        }
        setDb(resolvedDb);
      })
      .catch((err: unknown) => appLog.error("DB init failed:", err));
  }, []);

  const onDispatch = React.useCallback((action: GameAction) => {
    actionBufferRef.current.push(action);
  }, []);

  if (!db) return <LoadingScreen>Loading game…</LoadingScreen>;

  return (
    <RxDatabaseProvider
      // BallgameDb is a typed RxDatabase subtype that is structurally compatible
      // with RxDatabaseProvider's expected database prop at runtime. The cast is
      // necessary because RxDB's React types use opaque generics that don't
      // align with our concrete BallgameDb type without explicit coercion.
      database={db as unknown as Parameters<typeof RxDatabaseProvider>[0]["database"]}
    >
      <GameProviderWrapper onDispatch={onDispatch} announcePreprocessor={announcePreprocessor}>
        {dbResetNotice && (
          <DbResetNotice data-testid="db-reset-notice">
            <span>
              Your local game data (saves, events, teams, and custom teams) was reset due to an app
              update. Sorry for the inconvenience!
            </span>
            <button
              type="button"
              aria-label="Dismiss notice"
              title="Dismiss notice"
              onClick={() => {
                sessionStorage.setItem("db-reset-dismissed", "1");
                setDbResetNotice(false);
              }}
            >
              ×
            </button>
          </DbResetNotice>
        )}
        <GameInner
          actionBufferRef={actionBufferRef}
          onBackToHome={onBackToHome}
          onNewGame={onNewGame}
          onGameSessionStarted={onGameSessionStarted}
          pendingGameSetup={pendingGameSetup}
          onConsumeGameSetup={onConsumeGameSetup}
          pendingLoadSave={pendingLoadSave}
          onConsumePendingLoad={onConsumePendingLoad}
          onSavingStateChange={onSavingStateChange}
          onGameOver={onGameOver}
          leagueGameContext={leagueGameContext}
          onBackToLeague={onBackToLeague}
        />
      </GameProviderWrapper>
    </RxDatabaseProvider>
  );
};

export default Game;
