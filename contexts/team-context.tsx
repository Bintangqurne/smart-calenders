"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getTeam, getTeams, type Team } from "@/lib/api";

const TEAM_STORAGE_KEY = "smart-scheduler:selected-team-id";

type TeamContextValue = {
  teams: Team[];
  selectedTeam: Team | null;
  selectedTeamId: string | null;
  isLoadingTeams: boolean;
  teamError: string | null;
  selectTeam: (teamId: string) => void;
  reloadTeams: () => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);

function getStoredTeamId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TEAM_STORAGE_KEY);
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    setIsLoadingTeams(true);
    setTeamError(null);

    try {
      const nextTeams = await getTeams();
      setTeams(nextTeams);

      const storedTeamId = getStoredTeamId();
      const fallbackTeamId = nextTeams[0]?.teamId ?? null;
      const nextSelectedTeamId =
        storedTeamId && nextTeams.some((team) => team.teamId === storedTeamId)
          ? storedTeamId
          : fallbackTeamId;

      setSelectedTeamId(nextSelectedTeamId);
    } catch (error) {
      console.error("Failed to load teams:", error);
      setTeams([]);
      setSelectedTeamId(null);
      setTeamError("Failed to load teams");
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedTeamId) {
      window.localStorage.setItem(TEAM_STORAGE_KEY, selectedTeamId);
      return;
    }

    window.localStorage.removeItem(TEAM_STORAGE_KEY);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    void getTeam(selectedTeamId).then((enriched) => {
      setTeams((prev) =>
        prev.map((t) => (t.teamId === enriched.teamId ? { ...t, ...enriched } : t))
      );
    }).catch(() => {});
  }, [selectedTeamId]);

  const selectTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  const selectedTeam = teams.find((team) => team.teamId === selectedTeamId) ?? null;

  return (
    <TeamContext.Provider
      value={{
        teams,
        selectedTeam,
        selectedTeamId,
        isLoadingTeams,
        teamError,
        selectTeam,
        reloadTeams: loadTeams,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);

  if (!context) {
    throw new Error("useTeam must be used within a TeamProvider.");
  }

  return context;
}
