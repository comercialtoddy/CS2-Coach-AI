import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Overview } from './Overview';
import { MapAnalysis } from './MapAnalysis';
import { WeaponAnalysis } from './WeaponAnalysis';
import { MatchHistory } from './MatchHistory';
import { Settings } from './Settings';

/**
 * Performance Dashboard
 * 
 * A comprehensive dashboard for players to review their stats,
 * match history, and agent settings.
 */
export const PerformanceDashboard: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-full gap-4 p-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance Dashboard</h1>
        
        {/* Navigation Tabs */}
        <nav className="flex gap-2">
          <NavTab to="" label="Overview" />
          <NavTab to="maps" label="Map Analysis" />
          <NavTab to="weapons" label="Weapon Analysis" />
          <NavTab to="matches" label="Match History" />
          <NavTab to="settings" label="Settings" />
        </nav>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 bg-background-secondary rounded-lg p-4 overflow-auto">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="maps" element={<MapAnalysis />} />
          <Route path="weapons" element={<WeaponAnalysis />} />
          <Route path="matches" element={<MatchHistory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </div>
    </div>
  );
};

interface NavTabProps {
  to: string;
  label: string;
}

const NavTab: React.FC<NavTabProps> = ({ to, label }) => {
  const path = window.location.hash.split('/').pop();
  const isActive = (to === '' && path === 'performance') || path === to;

  return (
    <a
      href={`#/performance/${to}`}
      className={`px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'hover:bg-background-secondary text-text-secondary'
      }`}
    >
      {label}
    </a>
  );
}; 