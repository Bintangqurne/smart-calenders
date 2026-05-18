"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Medal, ShieldCheck, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  getLeaderboard,
  getGlobalLeaderboard,
  listSeasons,
  type LeaderboardEntry,
  type GlobalLeaderboardEntry,
  type SeasonMetadata,
  type SeasonScoreEntry,
} from "@/lib/api";
import { useTeam } from "@/hooks/use-team";
import { TeamPageGuard } from "@/components/team-page-guard";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const podiumColors = [
  "from-yellow-400 to-amber-500",
  "from-gray-300 to-gray-400",
  "from-amber-600 to-amber-700",
];

const podiumLabels = ["Rank 1", "Rank 2", "Rank 3"];
const podiumIcons = [Trophy, Medal, Award] as const;

function PodiumCard({
  user,
  index,
}: {
  user: LeaderboardEntry;
  index: number;
}) {
  const PodiumIcon = podiumIcons[index];
  const borderClass =
    index === 0
      ? "border-yellow-400/50"
      : index === 1
      ? "border-gray-300/50"
      : "border-amber-600/50";

  return (
    <Card className={`relative overflow-hidden border-2 ${borderClass}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${podiumColors[index]}`} />
      <CardContent className="flex flex-col items-center pt-6 pb-4">
        <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
          <PodiumIcon className="size-5" />
        </div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {podiumLabels[index]}
        </p>
        <Avatar className="size-14 mb-3">
          <AvatarFallback className="text-lg bg-primary/10 font-semibold">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm">{user.name}</h3>
        <div className="mt-3 flex items-center gap-1.5">
          <Trophy className="size-4 text-amber-500" />
          <span className="text-lg font-bold">{user.points}</span>
          <span className="text-xs text-muted-foreground">pts</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>{user.completedTasks ?? 0} done</span>
          <span>{user.onTimeCompletedTasks ?? 0} on time</span>
        </div>
      </CardContent>
    </Card>
  );
}

type LbTab = "team" | "global" | "seasons";

export default function LeaderboardPage() {
  const { selectedTeam, selectedTeamId } = useTeam();
  const [leaderboardByTeam, setLeaderboardByTeam] = useState<Record<string, LeaderboardEntry[]>>(
    {}
  );
  const [tab, setTab] = useState<LbTab>("team");
  const [globalEntries, setGlobalEntries] = useState<GlobalLeaderboardEntry[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [seasons, setSeasons] = useState<SeasonMetadata[] | null>(null);
  const [seasonEntries, setSeasonEntries] = useState<Record<string, SeasonScoreEntry[]>>({});
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "global" || globalEntries !== null) return;
    setGlobalLoading(true);
    getGlobalLeaderboard()
      .then((r) => setGlobalEntries(r.entries))
      .catch(() => setGlobalEntries([]))
      .finally(() => setGlobalLoading(false));
  }, [tab, globalEntries]);

  useEffect(() => {
    if (tab !== "seasons" || seasons !== null) return;
    listSeasons()
      .then((r) => setSeasons(r.seasons ?? []))
      .catch(() => setSeasons([]));
  }, [tab, seasons]);

  useEffect(() => {
    if (!activeSeasonId || activeSeasonId in seasonEntries) return;
    listSeasons(activeSeasonId)
      .then((r) =>
        setSeasonEntries((prev) => ({ ...prev, [activeSeasonId]: r.entries ?? [] }))
      )
      .catch(() =>
        setSeasonEntries((prev) => ({ ...prev, [activeSeasonId]: [] }))
      );
  }, [activeSeasonId, seasonEntries]);

  useEffect(() => {
    if (!selectedTeamId) return;
    if (selectedTeamId in leaderboardByTeam) return;

    getLeaderboard(selectedTeamId)
      .then((entries) =>
        setLeaderboardByTeam((prev) => ({
          ...prev,
          [selectedTeamId]: entries,
        }))
      )
      .catch(() =>
        setLeaderboardByTeam((prev) => ({
          ...prev,
          [selectedTeamId]: [],
        }))
      );
  }, [leaderboardByTeam, selectedTeamId]);

  const leaderboard = selectedTeamId ? leaderboardByTeam[selectedTeamId] ?? [] : [];
  const loading = selectedTeamId !== null && !(selectedTeamId in leaderboardByTeam);
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          {tab === "team"
            ? selectedTeam
              ? `Top performers in ${selectedTeam.name}`
              : "Select a team to see the leaderboard"
            : tab === "global"
            ? "Top performers across all teams (opt-in via public profile)"
            : "Past monthly seasons archive"}
        </p>
      </motion.div>

      <motion.div variants={item}>
        <div className="flex flex-wrap gap-1.5">
          {(["team", "global", "seasons"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {t === "team" ? "My team" : t === "global" ? "🌍 Global" : "🏆 Seasons"}
            </button>
          ))}
        </div>
      </motion.div>

      {tab === "team" && (
        <motion.div variants={item}>
          <Card className="border-primary/10 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <Badge variant="secondary" className="gap-1">
                <Trophy className="size-3.5" />
                Scoring
              </Badge>
              <span>New task: +1</span>
              <span>Send to QC: +2</span>
              <span>Done on time: +10</span>
              <span>Done late: +6</span>
              <span>New event: +1</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === "global" && (
        <motion.div variants={item}>
          {globalLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Loading global leaderboard…
              </CardContent>
            </Card>
          ) : !globalEntries || globalEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Trophy className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold">No one has opted in yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Make your profile public in Settings to appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {globalEntries.map((e) => (
                  <Link
                    key={e.userId}
                    href={e.username ? `/u/${e.username}` : "#"}
                    className="flex items-center gap-4 border-b last:border-0 p-4 transition hover:bg-muted/50"
                  >
                    <span className="w-10 text-center text-sm font-semibold text-muted-foreground">
                      {e.badge ?? `#${e.rank}`}
                    </span>
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-xs">
                        {e.displayName
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{e.displayName}</p>
                      {e.username && (
                        <p className="text-[11px] text-muted-foreground">
                          @{e.username}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="size-3.5 text-amber-500" />
                      <span className="text-sm font-semibold">{e.points}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "seasons" && (
        <motion.div variants={item} className="space-y-4">
          {!seasons ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Loading seasons…
              </CardContent>
            </Card>
          ) : seasons.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Award className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold">No closed seasons yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Monthly snapshots will appear here once the first season closes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  {seasons.map((s) => {
                    const expanded = activeSeasonId === s.seasonId;
                    return (
                      <div key={s.seasonId} className="border-b last:border-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSeasonId(expanded ? null : s.seasonId)
                          }
                          className="flex w-full items-center justify-between p-4 text-left transition hover:bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.participantCount} participants
                            </p>
                          </div>
                          <Badge variant={expanded ? "default" : "secondary"}>
                            {expanded ? "Hide" : "View top 100"}
                          </Badge>
                        </button>
                        {expanded && (
                          <div className="space-y-1 border-t bg-muted/20 px-4 py-3">
                            {(seasonEntries[s.seasonId] ?? []).map((e) => (
                              <Link
                                key={e.userId}
                                href={e.username ? `/u/${e.username}` : "#"}
                                className="flex items-center gap-3 rounded px-2 py-1 text-xs transition hover:bg-white dark:hover:bg-slate-800"
                              >
                                <span className="w-8 text-center font-medium text-muted-foreground">
                                  #{e.rank}
                                </span>
                                <span className="flex-1">
                                  {e.displayName}
                                  {e.username && (
                                    <span className="ml-1 text-muted-foreground">
                                      @{e.username}
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Trophy className="size-3 text-amber-500" />
                                  {e.points}
                                </span>
                              </Link>
                            ))}
                            {(seasonEntries[s.seasonId]?.length ?? 0) === 0 && (
                              <p className="py-2 text-center text-xs text-muted-foreground">
                                Loading…
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>
      )}

      {tab === "team" && <TeamPageGuard
        loading={loading}
        loadingLabel="leaderboard"
        emptyIcon={<Trophy className="size-8" />}
        emptyHeading="No team selected"
        emptyDescription="Choose a team from the sidebar to load leaderboard data."
      >
        {leaderboard.length === 0 ? (
          <motion.div variants={item}>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Trophy className="size-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No leaderboard data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete tasks and collaborate to populate this leaderboard.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Podium */}
            <div className="grid gap-4 sm:grid-cols-3">
              {top3.map((user, index) => (
                <motion.div key={user.userId} variants={item}>
                  <PodiumCard user={user} index={index} />
                </motion.div>
              ))}
            </div>

            {/* Rest */}
            {rest.length > 0 && (
              <motion.div variants={item}>
                <Card>
                  <CardContent className="p-0">
                    {rest.map((user, index) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-4 border-b last:border-0 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                          #{index + 4}
                        </span>
                        <Avatar className="size-9">
                          <AvatarFallback className="text-xs bg-primary/10">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{user.completedTasks ?? 0} completed</span>
                            <span>{user.pendingTasks ?? 0} pending</span>
                            <span>{user.overdueTasks ?? 0} overdue</span>
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="size-3" />
                              {user.onTimeCompletedTasks ?? 0} on time
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="size-3.5 text-amber-500" />
                          <span className="text-sm font-semibold">{user.points}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </TeamPageGuard>}
    </motion.div>
  );
}
