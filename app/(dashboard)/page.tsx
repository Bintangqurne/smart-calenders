"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CalendarDays, CheckCircle2, ClipboardList,
  Clock, ExternalLink, ListTodo, Loader2, Presentation, Timer,
  Trophy, TrendingUp, Users, Zap,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getEvents, getLeaderboard, getMeetings, getTasks,
  type CalendarEvent, type LeaderboardEntry, type Meeting, type Task,
} from "@/lib/api";
import { useTeam } from "@/hooks/use-team";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  const hrs = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (mins < 0) return "Overdue";
  if (mins < 60) return `in ${mins}m`;
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${days}d`;
}

function isUrgent(task: Task): boolean {
  if (task.status === "DONE") return false;
  return (new Date(task.deadline).getTime() - Date.now()) / 86400000 < 3;
}

const STATUS_STYLE: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  ON_QC: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color, bg, loading, href }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; loading: boolean; href?: string;
}) {
  const inner = (
    <Card className="group cursor-pointer border-border/60 transition-all hover:border-primary/20 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : value}
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`${bg} rounded-2xl p-3`}><Icon className={`size-5 ${color}`} /></div>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View all <ArrowRight className="size-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const r = 22; const circ = 2 * Math.PI * r;
  return (
    <svg width="60" height="60" className="-rotate-90">
      <circle cx="30" cy="30" r={r} stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/50" />
      <circle cx="30" cy="30" r={r} stroke="currentColor" strokeWidth="6" fill="none"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round" className="text-emerald-500 transition-all duration-700" />
    </svg>
  );
}

function TaskStatusBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length || 1;
  const segs = [
    { label: "To do", count: tasks.filter((t) => t.status === "TODO").length, color: "bg-slate-400" },
    { label: "In progress", count: tasks.filter((t) => t.status === "IN_PROGRESS").length, color: "bg-amber-400" },
    { label: "On QC", count: tasks.filter((t) => t.status === "ON_QC").length, color: "bg-sky-400" },
    { label: "Done", count: tasks.filter((t) => t.status === "DONE").length, color: "bg-emerald-500" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5">
        {segs.map((s) => <div key={s.label} className={`${s.color} transition-all duration-700`} style={{ width: `${(s.count / total) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-sm ${s.color}`} />
            <span className="text-xs text-muted-foreground">{s.label} <span className="font-semibold text-foreground">{s.count}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const start = new Date(meeting.startTime);
  const isToday = new Date().toDateString() === start.toDateString();
  const content = (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
          <Presentation className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{meeting.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {" • "}{start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {meeting.attendeeUserIds.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="size-3" />{meeting.attendeeUserIds.length} attendee{meeting.attendeeUserIds.length !== 1 ? "s" : ""}
            </p>
          )}
          {meeting.meetingLink ? (
            <div className="mt-1 space-y-1">
              <p className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline">
                <ExternalLink className="size-3" />
                Open meeting
              </p>
              <p className="truncate text-[10px] text-muted-foreground/70 max-w-[180px]">
                {meeting.meetingLink.replace(/^https?:\/\//, "")}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${isToday ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
        {isToday ? "Today" : formatRelativeTime(meeting.startTime)}
      </span>
    </div>
  );

  return meeting.meetingLink ? (
    <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
}

function UrgentTaskRow({ task, nowMs }: { task: Task; nowMs: number }) {
  const overdue = new Date(task.deadline).getTime() < nowMs;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${overdue ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"}`}>
          {overdue ? <Timer className="size-4" /> : <Clock className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{task.title}</p>
          <p className={`mt-0.5 text-xs font-medium ${overdue ? "text-rose-500" : "text-amber-600"}`}>
            {overdue ? "Overdue" : `Due ${formatRelativeTime(task.deadline)}`}
          </p>
        </div>
      </div>
      <Badge className={`shrink-0 text-[10px] ${STATUS_STYLE[task.status]}`}>{task.status.replace("_", " ")}</Badge>
    </div>
  );
}

function LeaderRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  const isTop3 = rank <= 3;
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isTop3 ? "bg-primary/5 border border-primary/15" : "hover:bg-muted/40"}`}>
      <span className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">{rank <= 3 ? medals[rank - 1] : rank}</span>
      <Avatar className="size-7"><AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{getInitials(entry.name)}</AvatarFallback></Avatar>
      <p className="flex-1 truncate text-sm font-medium">{entry.name}</p>
      <div className="flex items-center gap-1 text-sm font-bold"><Trophy className="size-3.5 text-amber-500" />{entry.points}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { selectedTeam, selectedTeamId, isLoadingTeams } = useTeam();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentKey = selectedTeamId ?? "__no-team__";

    Promise.allSettled([
      getEvents(),
      selectedTeamId ? getTasks(selectedTeamId) : Promise.resolve([]),
      selectedTeamId ? getMeetings(selectedTeamId, "SCHEDULED") : Promise.resolve([]),
      selectedTeamId ? getLeaderboard(selectedTeamId) : Promise.resolve([]),
    ]).then(([evts, tsk, mtg, lb]) => {
      if (evts.status === "fulfilled") setEvents(evts.value);
      if (tsk.status === "fulfilled") setTasks(tsk.value as Task[]);
      if (mtg.status === "fulfilled") setMeetings(mtg.value as Meeting[]);
      if (lb.status === "fulfilled") setLeaderboard(lb.value as LeaderboardEntry[]);
      setLoadedKey(currentKey);
    });
  }, [selectedTeamId]);

  const upcomingMeetings = useMemo(() =>
    [...meetings]
      .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
      .slice(0, 4),
    [meetings]);

  const upcomingEvents = useMemo(() =>
    events.filter((e) => new Date(e.startTime) >= new Date())
      .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)).slice(0, 3),
    [events]);

  const urgentTasks = useMemo(() =>
    tasks.filter(isUrgent).sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)).slice(0, 5),
    [tasks]);

  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const activeTasks = tasks.filter((t) => t.status !== "DONE").length;
  const completionPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
  const todayMeetings = meetings.filter((m) => new Date(m.startTime).toDateString() === new Date().toDateString());
  const loading = loadedKey !== (selectedTeamId ?? "__no-team__");
  const isReady = !loading && !isLoadingTeams;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* ── Welcome strip ── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background to-primary/5 p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">
              {selectedTeam ? (<><span className="text-muted-foreground font-normal">Team workspace · </span><span className="text-primary">{selectedTeam.name}</span></>) : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoadingTeams ? "Loading…" : selectedTeam
                ? `${selectedTeam.members.length} members · ${todayMeetings.length} meeting${todayMeetings.length !== 1 ? "s" : ""} today`
                : "Select a team to load your workspace."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/meetings" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
              <Presentation className="size-3.5" />Schedule
            </Link>
            <Link href="/tasks" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              <ListTodo className="size-3.5" />Tasks
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Calendar items" value={events.length} icon={CalendarDays} color="text-blue-500" bg="bg-blue-500/10" loading={loading} href="/events" />
        <StatCard title="Active tasks" value={activeTasks} sub={selectedTeam ? `for ${selectedTeam.name}` : "select a team"} icon={ClipboardList} color="text-amber-500" bg="bg-amber-500/10" loading={loading} href="/tasks" />
        <StatCard title="Completed" value={doneTasks} sub={`${completionPct}% completion`} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" loading={loading} />
        <StatCard title="Meetings today" value={todayMeetings.length} sub={meetings.length > 0 ? `${meetings.length} scheduled total` : undefined} icon={Presentation} color="text-violet-500" bg="bg-violet-500/10" loading={loading} href="/meetings" />
      </motion.div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_340px]">

        {/* LEFT: Meetings + Progress */}
        <motion.div variants={item} className="space-y-5">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Presentation className="size-4 text-blue-500" />Upcoming meetings
                </CardTitle>
                <Link href="/meetings" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-muted">
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingTeams && <p className="py-6 text-center text-sm text-muted-foreground animate-pulse">Loading teams…</p>}
              {!isLoadingTeams && !selectedTeamId && <p className="py-6 text-center text-sm text-muted-foreground">Select a team to view meetings.</p>}
              {loading && selectedTeamId && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>}
              {isReady && selectedTeamId && upcomingMeetings.length === 0 && (
                <div className="flex flex-col items-center py-8">
                  <Presentation className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                  <Link href="/meetings" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Schedule one <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
              {isReady && upcomingMeetings.map((m) => <MeetingRow key={m.meetingId} meeting={m} />)}
            </CardContent>
          </Card>

          {selectedTeamId && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="size-4 text-emerald-500" />Task progress
                  </CardTitle>
                  <div className="relative">
                    <ProgressRing done={doneTasks} total={tasks.length} />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{completionPct}%</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <div className="h-8 rounded-full bg-muted/40 animate-pulse" /> : <TaskStatusBar tasks={tasks} />}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* CENTER: Urgent tasks */}
        <motion.div variants={item}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="size-4 text-rose-500" />Urgent tasks
                  {isReady && urgentTasks.length > 0 && <Badge className="bg-rose-100 text-rose-700 text-[10px]">{urgentTasks.length}</Badge>}
                </CardTitle>
                <Link href="/tasks" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-muted">
                  All tasks <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingTeams && <p className="py-6 text-center text-sm text-muted-foreground animate-pulse">Loading…</p>}
              {!isLoadingTeams && !selectedTeamId && <p className="py-6 text-center text-sm text-muted-foreground">Select a team to view tasks.</p>}
              {loading && selectedTeamId && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>}
              {isReady && selectedTeamId && urgentTasks.length === 0 && (
                <div className="flex flex-col items-center py-10">
                  <CheckCircle2 className="size-8 text-emerald-400/60 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">All clear!</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">No tasks due in the next 3 days.</p>
                </div>
              )}
              <AnimatePresence>
                {isReady && urgentTasks.map((task) => (
                  <motion.div key={task.taskId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    <UrgentTaskRow task={task} nowMs={nowMs} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {isReady && selectedTeamId && urgentTasks.length === 0 && tasks.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent tasks</p>
                  {tasks.slice(0, 4).map((task) => (
                    <div key={task.taskId} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                      <p className="truncate text-sm">{task.title}</p>
                      <Badge className={`shrink-0 text-[10px] ${STATUS_STYLE[task.status]}`}>{task.status.replace("_", " ")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* RIGHT: Leaderboard + Calendar */}
        <motion.div variants={item} className="space-y-5">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="size-4 text-amber-500" />Leaderboard
                </CardTitle>
                <Link href="/leaderboard" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-muted">
                  Full board <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(isLoadingTeams || (loading && selectedTeamId)) && <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}</div>}
              {!isLoadingTeams && !selectedTeamId && <p className="py-4 text-center text-sm text-muted-foreground">Select a team.</p>}
              {isReady && selectedTeamId && leaderboard.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No ranked activity yet. Finish tasks or add calendar activity to start the board.</p>}
              {isReady && leaderboard.slice(0, 5).map((entry, i) => <LeaderRow key={entry.userId} entry={entry} rank={i + 1} />)}
            </CardContent>
          </Card>

          {upcomingEvents.length > 0 && isReady && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-blue-500" />Upcoming calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.map((event) => (
                  <div key={event.eventId} className="rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(event.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" · "}{new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
