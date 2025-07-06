import { Routes, Route, Navigate, MemoryRouter } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { MatchesPage } from "./pages/Matches/MatchPage";
import { PlayersPage } from "./pages/Players/PlayersPage";
import { TeamsPage } from "./pages/Teams/TeamsPage";
import { AppProviders } from "./context/AppProviders";
import { Layout } from "./pages/Layout";
import { AgentOverlay } from "./pages/AgentOverlay";

const AuthenticatedRoutes = () => (
  <AppProviders>
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MatchesPage />} />
          <Route path="matches" element={<Navigate to="/" />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
        {/* Agent AI Overlay - Full screen overlay without Layout */}
        <Route path="/agent-overlay" element={<AgentOverlay />} />
      </Routes>
    </MemoryRouter>
  </AppProviders>
);

export const App = () => {
  return <AuthenticatedRoutes />;
};
