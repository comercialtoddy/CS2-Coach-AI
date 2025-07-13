import { useMatchesContext } from "../context";
import { apiUrl } from "../api/api";
import { Match } from "../api/types";
import axios from "axios";

export const useMatches = () => {
  const {
    matches,
    currentMatch,
    filteredMatches,
    isLoading,
    setFilteredMatches,
    setCurrentMatch,
    fetchMatches,
    loadMatch,
    setIsLoading,
  } = useMatchesContext();

  const searchMatches = (searchValue: string) => {
    const filtered = matches.filter(
      (match) =>
        match.left.id &&
        match.left.id.toLowerCase().includes(searchValue.toLowerCase()),
    );
    if (searchValue === "") {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(filtered);
    }
  };

  const createMatch = async (match: Match) => {
    setIsLoading(true);
    await axios.post(`${apiUrl}/matches`, match);
    fetchMatches();
    setIsLoading(false);
  };

  const updateMatch = async (match: Match) => {
    setIsLoading(true);
    await axios.put(`${apiUrl}/matches/${match.id}`, match);
    fetchMatches();
    setIsLoading(false);
  };

  const deleteMatch = async (id: string) => {
    setIsLoading(true);
    await axios.delete(`${apiUrl}/matches/${id}`);
    fetchMatches();
    setIsLoading(false);
  };

  return {
    matches,
    currentMatch,
    filteredMatches,
    isLoading,
    setFilteredMatches,
    setCurrentMatch,
    fetchMatches,
    loadMatch,
    createMatch,
    updateMatch,
    deleteMatch,
    searchMatches,
  };
};
