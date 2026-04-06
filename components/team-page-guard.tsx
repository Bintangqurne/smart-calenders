"use client";

import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTeam } from "@/hooks/use-team";

interface TeamPageGuardProps {
  /** Content to render when a team is selected (regardless of page-level loading). */
  children: ReactNode;
  /**
   * Message shown while page-level data is loading. Pass `true` while the
   * page's own fetch is in-flight; the guard will render a generic pulse row.
   */
  loading?: boolean;
  /** Label used in the loading pulse, e.g. "tasks" → "Loading tasks…" */
  loadingLabel?: string;
  /** Icon shown in the "no team" empty state (defaults to Users). */
  emptyIcon?: ReactNode;
  /** Heading shown when no team is selected. */
  emptyHeading?: string;
  /** Sub-copy shown when no team is selected. */
  emptyDescription?: string;
}

/**
 * TeamPageGuard
 *
 * Centralises the three-state pattern shared by Tasks, Files and Leaderboard:
 *  1. Teams are still loading         → subtle pulse
 *  2. No team selected                → friendly empty-state card
 *  3. Team selected + page loading    → page-level pulse (optional)
 *  4. Ready                           → render children
 */
export function TeamPageGuard({
  children,
  loading = false,
  loadingLabel = "data",
  emptyIcon,
  emptyHeading = "No team selected",
  emptyDescription = "Choose a team from the sidebar to continue.",
}: TeamPageGuardProps) {
  const { isLoadingTeams, selectedTeamId } = useTeam();

  // 1. Global teams are loading
  if (isLoadingTeams) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground animate-pulse">Loading teams…</p>
      </div>
    );
  }

  // 2. No team selected yet
  if (!selectedTeamId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
            {emptyIcon ?? <Users className="size-8" />}
          </div>
          <h3 className="text-lg font-semibold">{emptyHeading}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  // 3. Page-level data is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground animate-pulse">
          Loading {loadingLabel}…
        </p>
      </div>
    );
  }

  // 4. Ready
  return <>{children}</>;
}
