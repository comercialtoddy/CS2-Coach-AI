import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { apiUrl } from "../api/api";
import { Team } from "../api/types";

interface TeamsContextProps {
  teams: Team[];
  selectedTeam: Team | null;
  filteredTeams: Team[];
  isLoading: boolean;
  isEditing: boolean;
  setFilteredTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setSelectedTeam: React.Dispatch<React.SetStateAction<Team | null>>;
  fetchTeams: () => Promise<void>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

const TeamsContext = createContext<TeamsContextProps | undefined>(undefined);

export const TeamsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${apiUrl}/teams`);
      if (response.data) {
        setTeams(response.data);
        setFilteredTeams(response.data);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <TeamsContext.Provider
      value={{
        teams,
        selectedTeam,
        filteredTeams,
        isLoading,
        isEditing,
        setFilteredTeams,
        fetchTeams,
        setIsLoading,
        setIsEditing,
        setSelectedTeam,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export const useTeamsContext = () => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error("useTeamsContext must be used within a TeamsProvider");
  }
  return context;
};
