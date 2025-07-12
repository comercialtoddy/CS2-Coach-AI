import { Routes, Route, Navigate, HashRouter } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { MatchesPage } from "./pages/Matches/MatchPage";
import { MatchDetailsPage } from "./pages/Matches/MatchDetailsPage";
import { PlayersPage } from "./pages/Players/PlayersPage";
import { PlayerProfilePage } from "./pages/Players/PlayerProfilePage";
import { TeamsPage } from "./pages/Teams/TeamsPage";
import { AppProviders } from "./context/AppProviders";
import { Layout } from "./pages/Layout";
import { AgentOverlay } from "./pages/AgentOverlay";
import { PerformanceDashboard } from "./pages/Performance";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Agent AI Overlay - Full screen overlay without Layout */}
      <Route path="/agent-overlay" element={<AgentOverlay />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<MatchesPage />} />
        <Route path="matches" element={<Navigate to="/" />} />
        <Route path="matches/:id" element={<MatchDetailsPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:id" element={<PlayerProfilePage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="performance/*" element={<PerformanceDashboard />} />
      </Route>
    </Routes>
  );
};

const AuthenticatedRoutes = () => (
  <AppProviders>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </AppProviders>
);

export const App = () => {
  return <AuthenticatedRoutes />;
};
