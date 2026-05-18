"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Filter,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  ShieldCheck,
  Search,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamPageGuard } from "@/components/team-page-guard";
import { useToast } from "@/components/toast-provider";
import { useTeam } from "@/hooks/use-team";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { SaveAsTemplate } from "@/components/templates/SaveAsTemplate";
import {
  createTask,
  deleteTask,
  getTasks,
  getTeam,
  updateTask,
  type Task,
  type TaskStatus,
  type Team,
  type TeamMember,
} from "@/lib/api";

const COLUMNS: {
  status: TaskStatus;
  label: string;
  icon: typeof Circle;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    status: "TODO",
    label: "To Do",
    icon: Circle,
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-700",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    status: "ON_QC",
    label: "On QC",
    icon: ShieldCheck,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-200 dark:border-sky-800",
  },
  {
    status: "DONE",
    label: "Done",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-800",
  },
];

const SORT_STEP = 1024;

function getInitials(name?: string | null, fallback?: string) {
  const safeName = name?.trim();
  if (safeName) {
    return safeName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  return fallback?.slice(0, 2).toUpperCase() ?? "??";
}

function looksLikeOpaqueUserId(value?: string | null) {
  if (!value) return false;

  return (
    value.startsWith("google_") ||
    value.startsWith("goo_") ||
    value.startsWith("user_") ||
    !value.includes("@")
  );
}

function getEmailLabel(email?: string | null) {
  if (!email) return null;

  const [localPart] = email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getMemberDisplayName(member: Pick<TeamMember, "name" | "email" | "userId">) {
  const trimmedName = member.name?.trim();
  if (trimmedName && trimmedName !== "Unknown User" && !looksLikeOpaqueUserId(trimmedName)) {
    return trimmedName;
  }

  return getEmailLabel(member.email) || "Unknown member";
}

function getMemberSecondaryLabel(member: Pick<TeamMember, "email">) {
  return member.email?.trim() || "Team member";
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function getDeadlineMeta(deadline: string, status: TaskStatus) {
  const days = daysUntil(deadline);

  if (status === "DONE") {
    return {
      label: "Completed",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      days,
    };
  }

  if (days < 0) {
    return {
      label: `${Math.abs(days)}d overdue`,
      className: "border-rose-200 bg-rose-50 text-rose-700",
      days,
    };
  }

  if (days === 0) {
    return {
      label: "Due today",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      days,
    };
  }

  if (days < 3) {
    return {
      label: `${days}d left`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
      days,
    };
  }

  return {
    label: new Date(deadline).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    className: "border-border bg-muted/30 text-muted-foreground",
    days,
  };
}

function getTaskSortValue(task: Task) {
  return task.sortOrder ?? new Date(task.createdAt).getTime();
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const sortDiff = getTaskSortValue(a) - getTaskSortValue(b);
    if (sortDiff !== 0) return sortDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getNextSortOrder(tasks: Task[], destinationIndex: number) {
  const previousTask = tasks[destinationIndex - 1];
  const nextTask = tasks[destinationIndex];

  if (!previousTask && !nextTask) {
    return SORT_STEP;
  }

  if (!previousTask) {
    return getTaskSortValue(nextTask) - SORT_STEP;
  }

  if (!nextTask) {
    return getTaskSortValue(previousTask) + SORT_STEP;
  }

  return (getTaskSortValue(previousTask) + getTaskSortValue(nextTask)) / 2;
}

function normalizeTeamMembers(team: Team | null, fallbackIds: string[]) {
  if (team?.memberDetails?.length) {
    return team.memberDetails.map((member) => ({
      ...member,
      name: getMemberDisplayName(member),
      email: member.email?.trim() || null,
    }));
  }

  return fallbackIds.map((userId) => ({
    userId,
    name: "Unknown member",
    email: null,
  }));
}

function resolveMember(memberId: string | undefined, membersById: Record<string, TeamMember>) {
  if (!memberId) return null;

  return (
    membersById[memberId] ?? {
      userId: memberId,
      name: "Unknown member",
      email: null,
    }
  );
}

function AssigneeBadge({
  member,
}: {
  member: TeamMember | null;
}) {
  if (!member) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
          {getInitials(member.name, member.userId)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{member.name}</p>
        {member.email ? (
          <p className="truncate text-[10px] text-muted-foreground">{member.email}</p>
        ) : null}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  membersById,
  onStatusChange,
  onDragStart,
  onDragEnd,
  onDropAt,
  onEdit,
  onDelete,
  isDragging,
}: {
  task: Task;
  membersById: Record<string, TeamMember>;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  onDropAt: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isDragging: boolean;
}) {
  const deadline = getDeadlineMeta(task.deadline, task.status);
  const assignee = resolveMember(task.assignedTo, membersById);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropAt(task);
      }}
      className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xl dark:shadow-primary/5 ${
        isDragging ? "scale-[0.98] border-primary/50 bg-primary/5 opacity-70 shadow-none" : "shadow-sm"
      }`}
    >
      <div className="absolute top-0 left-0 h-full w-1.5 bg-primary/10 transition-colors group-hover:bg-primary/20" />

      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 group-hover:text-primary/70 transition-colors">
        <GripVertical className="size-3.5" />
        Task detail
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="cursor-pointer rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <Edit2 className="size-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.taskId)}
            className="cursor-pointer rounded-lg p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
          >
            <Trash2 className="size-3.5 text-rose-500" />
          </button>
        </div>
      </div>

      {task.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${deadline.className}`}
        >
          {deadline.label}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 transition-colors group-hover:bg-muted/80">
        <AssigneeBadge member={assignee} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {COLUMNS.filter((column) => column.status !== task.status).map((column) => {
          const Icon = column.icon;
          return (
            <button
              key={column.status}
              type="button"
              title={`Move to ${column.label}`}
              onClick={() => onStatusChange(task.taskId, column.status)}
              className={`cursor-pointer rounded-lg px-2 py-1 text-[10px] font-semibold transition-all hover:scale-105 ${column.bg} ${column.color}`}
            >
              <Icon className="mr-0.5 inline-block size-3 -mt-0.5" />
              {column.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function ListRow({
  task,
  membersById,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Task;
  membersById: Record<string, TeamMember>;
  onStatusChange: (id: string, st: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const deadline = getDeadlineMeta(task.deadline, task.status);
  const assignee = resolveMember(task.assignedTo, membersById);

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group border-b border-border/50 transition-colors hover:bg-muted/30"
    >
      <td className="py-3 pl-4 pr-2">
        <div>
          <p className="text-sm font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap py-3 px-2">
        <select
          value={task.status}
          onChange={(event) => onStatusChange(task.taskId, event.target.value as TaskStatus)}
          className="cursor-pointer rounded-lg border border-transparent bg-transparent py-1 pl-2 pr-6 text-xs font-medium focus:outline-none focus:border-ring"
        >
          {COLUMNS.map((column) => (
            <option key={column.status} value={column.status}>
              {column.label}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap py-3 px-2">
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${deadline.className}`}
        >
          {deadline.label}
        </span>
      </td>
      <td className="py-3 px-2">
        <AssigneeBadge member={assignee} />
      </td>
      <td className="py-3 pl-2 pr-4">
        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="cursor-pointer rounded-lg p-1.5 hover:bg-muted"
          >
            <Edit2 className="size-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.taskId)}
            className="cursor-pointer rounded-lg p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30"
          >
            <Trash2 className="size-3.5 text-rose-500" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function TaskForm({
  teamId,
  members,
  editTask,
  onDone,
}: {
  teamId: string;
  members: TeamMember[];
  editTask: Task | null;
  onDone: () => void;
}) {
  const isEdit = Boolean(editTask);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: editTask?.title ?? "",
    description: editTask?.description ?? "",
    assignedTo: editTask?.assignedTo ?? "",
    deadline: editTask?.deadline ? editTask.deadline.split("T")[0] : "",
    status: (editTask?.status ?? "TODO") as TaskStatus,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title || !form.deadline) return;

    setSaving(true);

    try {
      if (isEdit && editTask) {
        await updateTask(editTask.taskId, {
          title: form.title,
          status: form.status,
          assignedTo: form.assignedTo || undefined,
          deadline: new Date(form.deadline).toISOString(),
        });
        toast.success("Task updated.");
      } else {
        await createTask({
          title: form.title,
          description: form.description,
          assignedTo: form.assignedTo,
          deadline: new Date(form.deadline).toISOString(),
          teamId,
        });
        toast.success("Task created.");
      }

      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {!isEdit && (
        <div className="flex justify-end">
          <TemplatePicker
            type="task"
            teamId={teamId}
            onApply={(t) => {
              const p = t.payload as {
                title?: string;
                description?: string;
                assignedTo?: string;
              };
              setForm((prev) => ({
                ...prev,
                title: p.title ?? prev.title,
                description: p.description ?? prev.description,
                assignedTo: p.assignedTo ?? prev.assignedTo,
              }));
            }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="task-title" className="text-xs font-medium">
          Title *
        </Label>
        <Input
          id="task-title"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Task description…"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc" className="text-xs font-medium">
          Description
        </Label>
        <textarea
          id="task-desc"
          value={form.description}
          rows={2}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Optional context…"
          className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="task-deadline" className="text-xs font-medium">
            Deadline *
          </Label>
          <Input
            id="task-deadline"
            type="date"
            value={form.deadline}
            onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
            required
          />
        </div>

        {isEdit ? (
          <div className="space-y-1.5">
            <Label htmlFor="task-status" className="text-xs font-medium">
              Status
            </Label>
            <select
              id="task-status"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))
              }
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
            >
              {COLUMNS.map((column) => (
                <option key={column.status} value={column.status}>
                  {column.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {members.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Assign to</Label>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, assignedTo: "" }))}
              className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-2">
            {members.map((member) => {
              const selected = form.assignedTo === member.userId;

              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, assignedTo: member.userId }))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                    selected
                      ? "border-primary/40 bg-primary/6"
                      : "border-border/50 hover:border-primary/30 hover:bg-muted/40"
                  }`}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {getInitials(member.name, member.userId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{getMemberDisplayName(member)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {getMemberSecondaryLabel(member)}
                    </p>
                  </div>
                  {selected ? (
                    <Badge variant="secondary" className="ml-auto">
                      Assigned
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {!isEdit && form.title.trim() && (
          <div className="mr-auto">
            <SaveAsTemplate
              type="task"
              teamId={teamId}
              suggestedName={form.title.slice(0, 60)}
              payload={{
                title: form.title,
                description: form.description,
                assignedTo: form.assignedTo,
              }}
            />
          </div>
        )}
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

type ViewMode = "kanban" | "list";

export default function TasksPage() {
  const { selectedTeam, selectedTeamId, teams } = useTeam();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const fallbackMemberIds = useMemo(
    () => teams.find((team) => team.teamId === selectedTeamId)?.members ?? [],
    [selectedTeamId, teams]
  );

  const membersById = useMemo(
    () =>
      Object.fromEntries(teamMembers.map((member) => [member.userId, member])),
    [teamMembers]
  );

  const loadTasks = useCallback(async () => {
    if (!selectedTeamId) return;

    setLoading(true);

    try {
      setTasks(sortTasks(await getTasks(selectedTeamId)));
    } catch (err) {
      setTasks([]);
      toast.error(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId, toast]);

  const loadTeamMembers = useCallback(async () => {
    if (!selectedTeamId) return;

    try {
      const team = await getTeam(selectedTeamId);
      setTeamMembers(normalizeTeamMembers(team, fallbackMemberIds));
    } catch (err) {
      setTeamMembers(normalizeTeamMembers(null, fallbackMemberIds));
      toast.error(err instanceof Error ? err.message : "Failed to load team members.");
    }
  }, [fallbackMemberIds, selectedTeamId, toast]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTasks([]);
      setTeamMembers([]);
      return;
    }

    void Promise.all([loadTasks(), loadTeamMembers()]);
  }, [loadTasks, loadTeamMembers, selectedTeamId]);

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => sortTasks(prev.map((task) => (task.taskId === taskId ? { ...task, status } : task))));

    try {
      await updateTask(taskId, { status });
      toast.success("Task status updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task status.");
      void loadTasks();
    }
  }

  async function moveTask(taskId: string, nextStatus: TaskStatus, destinationIndex: number) {
    const sourceTask = tasks.find((task) => task.taskId === taskId);
    if (!sourceTask) return;

    const destinationTasks = sortTasks(
      tasks
        .filter((task) => task.taskId !== taskId)
        .filter((task) => task.status === nextStatus)
    );
    const nextSortOrder = getNextSortOrder(destinationTasks, destinationIndex);

    const optimisticTask = {
      ...sourceTask,
      status: nextStatus,
      sortOrder: nextSortOrder,
    };

    setTasks((prev) =>
      sortTasks(prev.map((task) => (task.taskId === taskId ? optimisticTask : task)))
    );

    try {
      await updateTask(taskId, {
        status: nextStatus,
        sortOrder: nextSortOrder,
      });
      toast.success("Task moved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder task.");
      void loadTasks();
    } finally {
      setDraggingTask(null);
    }
  }

  async function handleDelete(taskId: string) {
    setDeleting(true);

    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => task.taskId !== taskId));
      toast.success("Task deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = sortTasks(tasks).filter((task) => {
    const matchSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || task.status === filterStatus;

    return matchSearch && matchStatus;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {selectedTeam ? `Manage tasks for ${selectedTeam.name}` : "Select a team to view tasks"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-0.5">
            {(["kanban", "list"] as ViewMode[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setViewMode(view)}
                className={`cursor-pointer rounded-lg p-2 transition-all duration-150 ${
                  viewMode === view
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view === "kanban" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>

          <Dialog
            open={dialogOpen && !editTask}
            onOpenChange={(open) => {
              if (!open) {
                setEditTask(null);
              }
              setDialogOpen(open);
            }}
          >
            <DialogTrigger render={<Button className="gap-2" disabled={!selectedTeamId} />}>
              <Plus className="size-4" />
              New task
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create task</DialogTitle>
              </DialogHeader>
              <TaskForm
                teamId={selectedTeamId!}
                members={teamMembers}
                editTask={null}
                onDone={() => {
                  setDialogOpen(false);
                  void loadTasks();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TeamPageGuard
        loading={loading}
        loadingLabel="tasks"
        emptyHeading="No team selected"
        emptyDescription="Choose a team from the sidebar to load tasks."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              className="h-9 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            {(["ALL", "TODO", "IN_PROGRESS", "ON_QC", "DONE"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  filterStatus === status
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 hover:border-primary/40"
                }`}
              >
                {status === "ALL" ? "All" : status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {COLUMNS.map((column) => {
            const Icon = column.icon;
            const count = tasks.filter((task) => task.status === column.status).length;
            return (
              <div
                key={column.status}
                className={`flex items-center gap-2 rounded-xl border ${column.border} px-3 py-2 text-sm`}
              >
                <Icon className={`size-4 ${column.color}`} />
                <span className="font-semibold">{count}</span>
                <span className="text-xs text-muted-foreground">{column.label}</span>
              </div>
            );
          })}
        </div>

        {viewMode === "kanban" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Tip:</span> drag a task card by its body
              or handle to move it between columns or reorder it inside the same column.
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
            {COLUMNS.map((column) => {
              const Icon = column.icon;
              const columnTasks = sortTasks(filtered.filter((task) => task.status === column.status));

              return (
                <div
                  key={column.status}
                  className="flex flex-col gap-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingTask) {
                      void moveTask(draggingTask.taskId, column.status, columnTasks.length);
                    }
                  }}
                >
                  <div
                    className={`flex items-center gap-3 rounded-2xl border ${column.border} ${column.bg} p-4 shadow-sm`}
                  >
                    <div className={`rounded-lg ${column.color} bg-background/50 p-2`}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{column.label}</h3>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {columnTasks.length} {columnTasks.length === 1 ? "task" : "tasks"}
                      </p>
                    </div>
                  </div>

                  <div 
                    className="flex flex-col gap-0 min-h-[500px] rounded-2xl border border-border/40 pb-20 shadow-inner overflow-hidden relative"
                    style={{
                      backgroundImage: "linear-gradient(to bottom, transparent 39px, hsl(var(--border) / 0.5) 40px)",
                      backgroundSize: "100% 40px",
                      backgroundColor: "hsl(var(--muted) / 0.15)"
                    }}
                  >
                    <AnimatePresence>
                      <div
                        key="drop-top"
                        className={`group relative flex items-center justify-center transition-all ${
                          draggingTask ? "h-16 py-2" : "h-6"
                        }`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingTask) {
                            void moveTask(draggingTask.taskId, column.status, 0);
                          }
                        }}
                      >
                        {draggingTask && (
                          <div className="absolute inset-x-2 inset-y-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                            Drop at top
                          </div>
                        )}
                      </div>
                    {columnTasks.map((task) => (
                      <Fragment key={task.taskId}>
                          <div className="px-3">
                            <KanbanCard
                              task={task}
                              membersById={membersById}
                              onStatusChange={handleStatusChange}
                              onDragStart={(nextTask) => setDraggingTask(nextTask)}
                              onDragEnd={() => setDraggingTask(null)}
                              onDropAt={(targetTask) => {
                                if (!draggingTask) return;
                                const dropIndex = columnTasks.findIndex((entry) => entry.taskId === targetTask.taskId);
                                if (dropIndex >= 0) {
                                  void moveTask(draggingTask.taskId, column.status, dropIndex);
                                }
                              }}
                              onEdit={(nextTask) => {
                                setEditTask(nextTask);
                                setDialogOpen(true);
                              }}
                              onDelete={(taskId) => setDeleteTarget(taskId)}
                              isDragging={draggingTask?.taskId === task.taskId}
                            />
                          </div>
                          <div
                            className={`group relative flex items-center justify-center transition-all ${
                              draggingTask ? "h-16 py-2" : "h-6"
                            }`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!draggingTask) return;
                              const dropIndex = columnTasks.findIndex((entry) => entry.taskId === task.taskId) + 1;
                              void moveTask(draggingTask.taskId, column.status, dropIndex);
                            }}
                          >
                            {draggingTask && (
                              <div className="absolute inset-x-2 inset-y-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                                Drop here
                              </div>
                            )}
                          </div>
                      </Fragment>
                    ))}
                    {columnTasks.length === 0 ? (
                      <motion.div
                        key="empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        className="flex-1 flex flex-col items-center justify-center py-10 grayscale"
                      >
                        <div className="size-12 rounded-2xl bg-muted border border-border flex items-center justify-center mb-3 shadow-sm">
                          <Icon className="size-6 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center">
                          {search || filterStatus !== "ALL" ? "No matches" : `Empty`}
                        </p>
                      </motion.div>
                    ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="py-3 pl-4 pr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Task
                    </th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deadline
                    </th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Assigned
                    </th>
                    <th className="py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((task) => (
                      <ListRow
                        key={task.taskId}
                        task={task}
                        membersById={membersById}
                        onStatusChange={handleStatusChange}
                        onEdit={(nextTask) => {
                          setEditTask(nextTask);
                          setDialogOpen(true);
                        }}
                        onDelete={(taskId) => setDeleteTarget(taskId)}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No tasks match your filters.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </TeamPageGuard>

      <Dialog
        open={dialogOpen && !!editTask}
        onOpenChange={(open) => {
          if (!open) setEditTask(null);
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editTask ? (
            <TaskForm
              teamId={selectedTeamId!}
              members={teamMembers}
              editTask={editTask}
              onDone={() => {
                setDialogOpen(false);
                setEditTask(null);
                void loadTasks();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The task will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => (deleteTarget ? void handleDelete(deleteTarget) : undefined)}
              className="gap-2"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
