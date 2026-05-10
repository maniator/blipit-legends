import * as React from "react";

import ManageTeamsScreen from "@feat/customTeams/pages/ManageTeamsScreen";
import AppShell from "@feat/gameplay/components/AppShell";
import HomeScreen from "@feat/gameplay/components/HomeScreen";
import RootLayout from "@feat/gameplay/components/RootLayout";
import { resetStaleInProgressGames } from "@feat/league/sim/resetStaleGames";
import { getTotalGameDays } from "@feat/leagues/utils/seasonPresets";
import { appLog } from "@shared/utils/logger";
import {
  createBrowserRouter,
  Navigate,
  redirect,
  useNavigate,
  useOutletContext,
} from "react-router";

import { getDb } from "@storage/db";
import type { AppShellOutletContext, SeasonRecord } from "@storage/types";

const CareerStatsPage = React.lazy(() => import("@feat/careerStats/pages/CareerStatsPage"));
const ContactPage = React.lazy(() => import("@feat/contact/pages/ContactPage"));
const ExhibitionSetupPage = React.lazy(() => import("@feat/exhibition/pages/ExhibitionSetupPage"));
const GamePage = React.lazy(() => import("@feat/gameplay/pages/GamePage"));
const HelpPage = React.lazy(() => import("@feat/help/pages/HelpPage"));
const LeagueSetupWizard = React.lazy(() => import("@feat/leagues/pages/LeagueSetupWizard"));
const LeaguesHubPage = React.lazy(() => import("@feat/leagues/pages/LeaguesHubPage"));
const PlayerCareerPage = React.lazy(() => import("@feat/careerStats/pages/PlayerCareerPage"));
const SavesPage = React.lazy(() => import("@feat/saves/pages/SavesPage"));
const SeasonHomePage = React.lazy(() => import("@feat/leagues/pages/SeasonHomePage"));
const SeasonSchedulePage = React.lazy(() => import("@feat/leagues/pages/SeasonSchedulePage"));
const SeasonTeamPage = React.lazy(() => import("@feat/leagues/pages/SeasonTeamPage"));

/** Route element for `/` — reads navigation callbacks from AppShell outlet context. */
function HomeRoute() {
  const ctx = useOutletContext<AppShellOutletContext>();
  const navigate = useNavigate();

  const [activeSeasonId, setActiveSeasonId] = React.useState<string | null>(null);
  const [activeSeasonLabel, setActiveSeasonLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    getDb()
      .then(async (db) => {
        const docs = await db.seasons.find({ selector: { status: "active" } }).exec();
        if (docs.length > 0) {
          const s = docs[0].toJSON() as unknown as SeasonRecord;
          setActiveSeasonId(s.id);
          setActiveSeasonLabel(
            `${s.name} · day ${s.currentGameDay} / ${getTotalGameDays(s.preset, s.seasonLength)}`,
          );
        } else {
          setActiveSeasonId(null);
          setActiveSeasonLabel(null);
        }
      })
      .catch(() => {
        setActiveSeasonId(null);
        setActiveSeasonLabel(null);
      });
  }, []);

  return (
    <HomeScreen
      onNewGame={ctx.onNewGame}
      onLoadSaves={ctx.onLoadSaves}
      onManageTeams={ctx.onManageTeams}
      onResumeCurrent={ctx.hasActiveSession ? ctx.onResumeCurrent : undefined}
      onHelp={ctx.onHelp}
      onContact={ctx.onContact}
      onCareerStats={ctx.hasCareerStats ? ctx.onCareerStats : undefined}
      activeSeasonId={activeSeasonId}
      activeSeasonLabel={activeSeasonLabel}
      onContinueSeason={
        activeSeasonId !== null ? () => navigate(`/leagues/${activeSeasonId}`) : undefined
      }
      onStartLeague={() => navigate("/leagues")}
    />
  );
}

/** Route element for `/teams`, `/teams/new`, `/teams/:teamId/edit`. */
function TeamsRoute() {
  const ctx = useOutletContext<AppShellOutletContext>();
  return <ManageTeamsScreen onBack={ctx.onBackToHome} hasActiveGame={ctx.hasActiveSession} />;
}

/**
 * Route element for `/game`.
 * Renders GamePage as a real route element.
 */
function GameRoute() {
  return (
    <React.Suspense fallback={null}>
      <GamePage />
    </React.Suspense>
  );
}

/**
 * Application data router.
 *
 * Route tree:
 *   / (RootLayout – ErrorBoundary wrapper)
 *     AppShell – layout; provides outlet context for child routes
 *       /                         → HomeRoute        → HomeScreen
 *       /game                     → GameRoute        → GamePage → Game
 *       /teams                    → TeamsRoute       → ManageTeamsScreen (list)
 *       /teams/new                → TeamsRoute       → ManageTeamsScreen (create editor)
 *       /teams/:teamId/edit       → TeamsRoute       → ManageTeamsScreen (edit editor)
 *       /stats                    → CareerStatsPage  (redirects to /stats/:firstTeam)
 *       /stats/:teamId            → CareerStatsPage
 *       /stats/:teamId/players/:playerId → PlayerCareerPage
 *       /stats/players/:playerId  → PlayerCareerPage (no team context)
 *       /career-stats             → redirect to /stats
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRoute /> },
          { path: "game", element: <GameRoute /> },
          { path: "teams", element: <TeamsRoute /> },
          { path: "teams/new", element: <TeamsRoute /> },
          {
            path: "teams/:teamId/edit",
            element: <TeamsRoute />,
            loader: async ({ params }) => {
              // Only redirect when the :teamId segment is missing entirely.
              // If the team document doesn't exist in the DB, ManageTeamsScreen
              // renders its own "Team not found" state (loading → not-found → loaded).
              if (!params.teamId) return redirect("/teams");
              return null;
            },
          },
          {
            path: "saves",
            element: (
              <React.Suspense fallback={null}>
                <SavesPage />
              </React.Suspense>
            ),
          },
          {
            path: "help",
            element: (
              <React.Suspense fallback={null}>
                <HelpPage />
              </React.Suspense>
            ),
          },
          {
            path: "contact",
            element: (
              <React.Suspense fallback={null}>
                <ContactPage />
              </React.Suspense>
            ),
          },
          {
            path: "exhibition/new",
            element: (
              <React.Suspense fallback={null}>
                <ExhibitionSetupPage />
              </React.Suspense>
            ),
          },
          { path: "career-stats", element: <Navigate to="/stats" replace /> },
          {
            path: "stats",
            element: (
              <React.Suspense fallback={null}>
                <CareerStatsPage />
              </React.Suspense>
            ),
          },
          {
            path: "stats/:teamId",
            element: (
              <React.Suspense fallback={null}>
                <CareerStatsPage />
              </React.Suspense>
            ),
          },
          {
            path: "stats/:teamId/players/:playerId",
            element: (
              <React.Suspense fallback={null}>
                <PlayerCareerPage />
              </React.Suspense>
            ),
          },
          {
            path: "stats/players/:playerId",
            element: (
              <React.Suspense fallback={null}>
                <PlayerCareerPage />
              </React.Suspense>
            ),
          },
          {
            path: "leagues",
            loader: async () => {
              // Reset any stale in_progress games before the hub renders its
              // "Continue" CTA — ensures the advance button never sees a stuck row.
              // Swallow errors so a DB-init failure doesn't crash the /leagues route.
              try {
                await resetStaleInProgressGames();
              } catch (err) {
                appLog.warn("[leagues loader] resetStaleInProgressGames failed:", err);
              }
              return null;
            },
            element: (
              <React.Suspense fallback={null}>
                <LeaguesHubPage />
              </React.Suspense>
            ),
          },
          {
            path: "leagues/new",
            element: (
              <React.Suspense fallback={null}>
                <LeagueSetupWizard />
              </React.Suspense>
            ),
          },
          {
            path: "leagues/:seasonId",
            element: (
              <React.Suspense fallback={null}>
                <SeasonHomePage />
              </React.Suspense>
            ),
          },
          {
            path: "leagues/:seasonId/schedule",
            element: (
              <React.Suspense fallback={null}>
                <SeasonSchedulePage />
              </React.Suspense>
            ),
          },
          {
            path: "leagues/:seasonId/teams/:seasonTeamId",
            element: (
              <React.Suspense fallback={null}>
                <SeasonTeamPage />
              </React.Suspense>
            ),
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
