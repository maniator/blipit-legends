import * as React from "react";

import ManageTeamsScreen from "@feat/customTeams/pages/ManageTeamsScreen";
import AppShell from "@feat/gameplay/components/AppShell";
import HomeScreen from "@feat/gameplay/components/HomeScreen";
import RootLayout from "@feat/gameplay/components/RootLayout";
import { createBrowserRouter, Navigate, redirect, useOutletContext } from "react-router";
import styled from "styled-components";

import type { AppShellOutletContext } from "@storage/types";

const CareerStatsPage = React.lazy(() => import("@feat/careerStats/pages/CareerStatsPage"));
const ContactPage = React.lazy(() => import("@feat/contact/pages/ContactPage"));
const ExhibitionSetupPage = React.lazy(() => import("@feat/exhibition/pages/ExhibitionSetupPage"));
const GamePage = React.lazy(() => import("@feat/gameplay/pages/GamePage"));
const HelpPage = React.lazy(() => import("@feat/help/pages/HelpPage"));
const PlayerCareerPage = React.lazy(() => import("@feat/careerStats/pages/PlayerCareerPage"));
const SavesPage = React.lazy(() => import("@feat/saves/pages/SavesPage"));

const AppFallbackMessage = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.s48} auto;
  font-family: monospace;
`;

function AppLoadingFallback({ label = "Loading app…" }: { label?: string }) {
  return (
    <AppFallbackMessage data-testid="app-loading-fallback" role="status">
      {label}
    </AppFallbackMessage>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<AppLoadingFallback label="Loading page…" />}>
      {children}
    </React.Suspense>
  );
}

/** Route element for `/` — reads navigation callbacks from AppShell outlet context. */
function HomeRoute() {
  const ctx = useOutletContext<AppShellOutletContext>();
  return (
    <HomeScreen
      onNewGame={ctx.onNewGame}
      onLoadSaves={ctx.onLoadSaves}
      onManageTeams={ctx.onManageTeams}
      onResumeCurrent={ctx.hasActiveSession ? ctx.onResumeCurrent : undefined}
      onHelp={ctx.onHelp}
      onContact={ctx.onContact}
      onCareerStats={ctx.hasCareerStats ? ctx.onCareerStats : undefined}
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
    <LazyRoute>
      <GamePage />
    </LazyRoute>
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
    hydrateFallbackElement: <AppLoadingFallback />,
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
              <LazyRoute>
                <SavesPage />
              </LazyRoute>
            ),
          },
          {
            path: "help",
            element: (
              <LazyRoute>
                <HelpPage />
              </LazyRoute>
            ),
          },
          {
            path: "contact",
            element: (
              <LazyRoute>
                <ContactPage />
              </LazyRoute>
            ),
          },
          {
            path: "exhibition/new",
            element: (
              <LazyRoute>
                <ExhibitionSetupPage />
              </LazyRoute>
            ),
          },
          { path: "career-stats", element: <Navigate to="/stats" replace /> },
          {
            path: "stats",
            element: (
              <LazyRoute>
                <CareerStatsPage />
              </LazyRoute>
            ),
          },
          {
            path: "stats/:teamId",
            element: (
              <LazyRoute>
                <CareerStatsPage />
              </LazyRoute>
            ),
          },
          {
            path: "stats/:teamId/players/:playerId",
            element: (
              <LazyRoute>
                <PlayerCareerPage />
              </LazyRoute>
            ),
          },
          {
            path: "stats/players/:playerId",
            element: (
              <LazyRoute>
                <PlayerCareerPage />
              </LazyRoute>
            ),
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
