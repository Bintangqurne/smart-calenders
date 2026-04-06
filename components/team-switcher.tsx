"use client";

import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTeam } from "@/hooks/use-team";

export function TeamSwitcher() {
  const {
    teams,
    selectedTeam,
    selectedTeamId,
    isLoadingTeams,
    teamError,
    selectTeam,
  } = useTeam();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="team-switcher-trigger"
        render={
          <Button
            variant="outline"
            className="h-auto w-full items-center justify-between rounded-xl border-sidebar-border bg-sidebar-accent/30 px-3 py-3 text-left shadow-sm hover:bg-sidebar-accent/60"
          />
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            {isLoadingTeams ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Active Team
            </p>
            <p className="truncate text-sm font-semibold">
              {selectedTeam?.name ?? (isLoadingTeams ? "Loading teams..." : "Select a team")}
            </p>
          </div>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-72 rounded-xl p-2" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch team workspace</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {teamError && (
          <div className="px-2 py-2 text-sm text-destructive">{teamError}</div>
        )}

        {!teamError && teams.length === 0 && !isLoadingTeams && (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            No teams available yet.
          </div>
        )}

        {teams.map((team) => {
          const isActive = team.teamId === selectedTeamId;

          return (
            <DropdownMenuItem
              key={team.teamId}
              className="cursor-pointer items-start justify-between rounded-lg px-2 py-2"
              onClick={() => selectTeam(team.teamId)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{team.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {team.members.length} member{team.members.length === 1 ? "" : "s"}
                </p>
              </div>
              {isActive ? <Check className="mt-0.5 size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
