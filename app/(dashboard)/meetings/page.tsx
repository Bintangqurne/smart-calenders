"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Presentation,
  Sparkles,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { JitsiEmbed } from "@/components/video/JitsiEmbed";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { SaveAsTemplate } from "@/components/templates/SaveAsTemplate";
import { GuestInviteModal } from "@/components/guest/GuestInviteModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/toast-provider";
import { useTeam } from "@/hooks/use-team";
import {
  createMeeting,
  getMeetings,
  getTasks,
  getTeam,
  getTeamCalendar,
  updateMeeting,
  type Meeting,
  type Task,
  type TeamAvailabilityMember,
  type TeamCalendarResponse,
  type TeamMember,
} from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const WORK_HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08–18

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function toLocalDT(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeRange(start: string, end: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Returns fraction [0,1) of how far through the work-day a timestamp is. */
function hourFraction(iso: string): number {
  const d = new Date(iso);
  const totalMins = (d.getHours() - 8) * 60 + d.getMinutes();
  return Math.max(0, Math.min(1, totalMins / (WORK_HOURS.length * 60)));
}

function busySegmentsForMember(
  member: TeamAvailabilityMember
): Array<{ leftPct: number; widthPct: number; label: string }> {
  return member.busySlots.map((slot) => {
    const left = hourFraction(slot.start);
    const right = hourFraction(slot.end);
    return {
      leftPct: left * 100,
      widthPct: Math.max(right - left, 0.02) * 100,
      label: formatTimeRange(slot.start, slot.end),
    };
  });
}

function getMeetingStatusColor(status: string) {
  if (status === "SCHEDULED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function looksLikeOpaqueUserId(value?: string | null) {
  if (!value) return false;
  return /^(google|goo|user|usr|auth0|github|gitlab|discord|slack)[_:-]/i.test(value) || /^[a-z]{2,8}_[a-z0-9]{6,}$/i.test(value);
}

function getEmailLabel(email?: string | null) {
  if (!email) return null;

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getMemberDisplayName(member: Pick<TeamMember, "name" | "email">) {
  const trimmedName = member.name?.trim();
  if (trimmedName && trimmedName !== "Unknown User" && !looksLikeOpaqueUserId(trimmedName)) {
    return trimmedName;
  }

  return getEmailLabel(member.email) || "Team member";
}

function getMemberSecondaryText(member: Pick<TeamMember, "email">) {
  return member.email?.trim() || "Profile email not available yet";
}

function getAvailabilitySourceLabel(source: TeamAvailabilityMember["source"]) {
  return source === "google" ? "Google Calendar connected" : "Internal events only";
}

function getAvailabilitySourceTone(source: TeamAvailabilityMember["source"]) {
  return source === "google"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Visual slot button rendered inside the recommended-slots list */
function SlotButton({
  slot,
  isActive,
  onSelect,
}: {
  slot: { start: string; end: string };
  isActive: boolean;
  onSelect: (slot: { start: string; end: string }) => void;
}) {
  return (
    <motion.button
      type="button"
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(slot)}
      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all duration-150 ${
        isActive
          ? "border-primary bg-primary/8 shadow-sm ring-1 ring-primary/20"
          : "border-border/60 hover:border-primary/40 hover:bg-primary/4 hover:shadow-sm"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Suggested
      </p>
      <p className="mt-1.5 text-base font-bold tabular-nums">
        {formatTimeRange(slot.start, slot.end)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {new Date(slot.start).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      {isActive && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
          <Check className="size-3" />
          Selected
        </div>
      )}
    </motion.button>
  );
}

/** Individual member row in the time-grid */
function GridMemberRow({
  member,
  selectedSlot,
}: {
  member: TeamAvailabilityMember;
  selectedSlot: { start: string; end: string } | null;
}) {
  const busySegs = busySegmentsForMember(member);
  const slotLeft = selectedSlot ? hourFraction(selectedSlot.start) * 100 : null;
  const slotWidth = selectedSlot
    ? (hourFraction(selectedSlot.end) - hourFraction(selectedSlot.start)) * 100
    : null;

  return (
    <div className="group flex items-center gap-3">
      {/* Member label */}
      <div className="w-36 shrink-0">
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{member.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {getAvailabilitySourceLabel(member.source)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid track */}
      <div className="relative h-9 flex-1 overflow-hidden rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
        {/* Busy segments */}
        {busySegs.map((seg, i) => (
          <div
            key={i}
            title={`Busy: ${seg.label}`}
            className="absolute inset-y-0 rounded-lg bg-rose-200/80 dark:bg-rose-900/50 transition-opacity group-hover:bg-rose-300/80"
            style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
          />
        ))}

        {/* Selected slot highlight */}
        {slotLeft !== null && slotWidth !== null && (
          <div
            className="absolute inset-y-0 rounded-lg border-2 border-primary bg-primary/15 transition-all duration-200"
            style={{ left: `${slotLeft}%`, width: `${slotWidth}%` }}
          />
        )}

        {/* Hour grid lines */}
        {WORK_HOURS.map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-px bg-border/40"
            style={{ left: `${(i / WORK_HOURS.length) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Full availability heat strip — shows how many members are free at each hour */
function TeamHeatRow({
  memberSchedules,
  selectedSlot,
}: {
  memberSchedules: TeamAvailabilityMember[];
  selectedSlot: { start: string; end: string } | null;
}) {
  const teamSize = memberSchedules.length;
  const slotLeft = selectedSlot ? hourFraction(selectedSlot.start) * 100 : null;
  const slotWidth = selectedSlot
    ? (hourFraction(selectedSlot.end) - hourFraction(selectedSlot.start)) * 100
    : null;

  return (
    <div className="relative h-4 overflow-hidden rounded-xl">
      {WORK_HOURS.map((hour, i) => {
        const busyCount = memberSchedules.filter((m) =>
          m.busySlots.some((s) => {
            const sh = new Date(s.start).getHours();
            const eh = new Date(s.end).getHours();
            return hour >= sh && hour < eh;
          })
        ).length;
        const freeFraction = 1 - busyCount / Math.max(teamSize, 1);
        const opacity = Math.round(freeFraction * 100);
        return (
          <div
            key={hour}
            title={`${hour}:00 — ${busyCount}/${teamSize} busy`}
            className="absolute inset-y-0 bg-emerald-400 transition-opacity"
            style={{
              left: `${(i / WORK_HOURS.length) * 100}%`,
              width: `${(1 / WORK_HOURS.length) * 100}%`,
              opacity: `${opacity}%`,
            }}
          />
        );
      })}
      {/* base bg */}
      <div className="absolute inset-0 -z-10 rounded-xl bg-rose-100 dark:bg-rose-950/30" />
      {/* selected slot */}
      {slotLeft !== null && slotWidth !== null && (
        <div
          className="absolute inset-y-0 rounded-xl border-2 border-primary/80 bg-primary/20"
          style={{ left: `${slotLeft}%`, width: `${slotWidth}%` }}
        />
      )}
    </div>
  );
}

/** Meeting card in the upcoming list */
function MeetingCard({
  meeting,
  canManage,
  onEdit,
  onCancel,
  onJoinSmartMeet,
  onInviteGuest,
}: {
  meeting: Meeting;
  canManage: boolean;
  onEdit: (meeting: Meeting) => void;
  onCancel: (meeting: Meeting) => void;
  onJoinSmartMeet: (meeting: Meeting) => void;
  onInviteGuest: (meeting: Meeting) => void;
}) {
  const statusColor = getMeetingStatusColor(meeting.status);
  const [expanded, setExpanded] = useState(false);
  const hasMeetingLink = Boolean(meeting.meetingLink);

  return (
    <motion.div
      layout
      className="cursor-pointer rounded-2xl border border-border/60 p-4 transition-shadow hover:shadow-sm"
      onClick={() => {
        if (hasMeetingLink) {
          window.open(meeting.meetingLink, "_blank", "noopener,noreferrer");
          return;
        }
        setExpanded((v) => !v);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-sm">{meeting.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            <span>{formatTimeRange(meeting.startTime, meeting.endTime)}</span>
          </div>
          {meeting.attendeeUserIds.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{meeting.attendeeUserIds.length} attendee{meeting.attendeeUserIds.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          {hasMeetingLink ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <ExternalLink className="size-3" />
                Open meeting
              </div>
              <p className="truncate text-[10px] text-muted-foreground/70 max-w-[220px]">
                {meeting.meetingLink.replace(/^https?:\/\//, "")}
              </p>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>
            {meeting.status}
          </span>
          {canManage && hasMeetingLink ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              Manage
            </Button>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
              {meeting.description && (
                <p className="text-xs text-muted-foreground leading-5">{meeting.description}</p>
              )}
              {meeting.agenda && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Agenda</p>
                  <p className="whitespace-pre-wrap text-xs text-foreground/80 leading-5">{meeting.agenda}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1.5 bg-emerald-600 px-2.5 text-[11px] text-white hover:bg-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoinSmartMeet(meeting);
                  }}
                >
                  <Video className="size-3" />
                  Join Smart Meet
                </Button>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInviteGuest(meeting);
                    }}
                  >
                    <UserPlus className="size-3" />
                    Invite guest
                  </Button>
                )}
                {meeting.meetingLink && (
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    External link
                  </a>
                )}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(meeting);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancel(meeting);
                    }}
                  >
                    Cancel meeting
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditMeetingDialog({
  meeting,
  teamMembers,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  meeting: Meeting | null;
  teamMembers: TeamMember[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    title: string;
    description: string;
    agenda: string;
    meetingLink: string;
    startTime: string;
    endTime: string;
    attendeeUserIds: string[];
  }) => void;
}) {
  const [form, setForm] = useState(() => ({
    title: meeting?.title ?? "",
    description: meeting?.description ?? "",
    agenda: meeting?.agenda ?? "",
    meetingLink: meeting?.meetingLink ?? "",
    startTime: meeting ? toLocalDT(new Date(meeting.startTime)) : "",
    endTime: meeting ? toLocalDT(new Date(meeting.endTime)) : "",
    attendeeUserIds: meeting?.attendeeUserIds ?? [],
  }));

  function toggleAttendee(userId: string) {
    setForm((prev) => ({
      ...prev,
      attendeeUserIds: prev.attendeeUserIds.includes(userId)
        ? prev.attendeeUserIds.filter((id) => id !== userId)
        : [...prev.attendeeUserIds, userId],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit meeting</DialogTitle>
        </DialogHeader>

        {meeting ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSave(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-meeting-title">Title</Label>
              <Input
                id="edit-meeting-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-meeting-start">Start</Label>
                <Input
                  id="edit-meeting-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-meeting-end">End</Label>
                <Input
                  id="edit-meeting-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-meeting-link">Meeting link</Label>
              <Input
                id="edit-meeting-link"
                type="url"
                value={form.meetingLink}
                onChange={(event) => setForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
                placeholder="https://meet.google.com/…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-meeting-description">Description</Label>
              <textarea
                id="edit-meeting-description"
                rows={2}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-meeting-agenda">Agenda</Label>
              <textarea
                id="edit-meeting-agenda"
                rows={3}
                value={form.agenda}
                onChange={(event) => setForm((prev) => ({ ...prev, agenda: event.target.value }))}
                className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Attendees</Label>
                <span className="text-[10px] text-muted-foreground">
                  {form.attendeeUserIds.length}/{teamMembers.length}
                </span>
              </div>
              <div className="grid gap-2">
                {teamMembers.map((member) => {
                  const selected = form.attendeeUserIds.includes(member.userId);

                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => toggleAttendee(member.userId)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                        selected
                          ? "border-primary/40 bg-primary/6"
                          : "border-border/50 hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {getMemberSecondaryText(member)}
                        </p>
                      </div>
                      {selected ? <Badge variant="secondary" className="ml-auto">Included</Badge> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="outline" type="button" />}>
                Close
              </DialogClose>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save meeting
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type Tab = "scheduler" | "upcoming";

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { selectedTeam, selectedTeamId, isLoadingTeams } = useTeam();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("scheduler");
  const [selectedDate, setSelectedDate] = useState(todayDateInput());
  const [duration, setDuration] = useState(60);
  const [calendarData, setCalendarData] = useState<TeamCalendarResponse | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [joinMeetTarget, setJoinMeetTarget] = useState<Meeting | null>(null);
  const [guestInviteTarget, setGuestInviteTarget] = useState<Meeting | null>(null);
  const [meetUser, setMeetUser] = useState<{ name?: string; email?: string }>({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    agenda: "",
    meetingLink: "",
    startTime: "",
    endTime: "",
  });
  const gridRef = useRef<HTMLDivElement>(null);

  const loadTeamMembers = useCallback(async () => {
    if (!selectedTeamId) return;

    try {
      const team = await getTeam(selectedTeamId);
      setTeamMembers(
        team.memberDetails?.length
          ? team.memberDetails.map((member) => ({
              ...member,
              name: getMemberDisplayName(member),
              email: member.email?.trim() || null,
            }))
          : team.members.map((userId) => ({ userId, name: "Team member", email: null }))
      );
    } catch (err) {
      console.error("Failed to fetch team members", err);
      setTeamMembers([]);
    }
  }, [selectedTeamId]);

  // ── Data loading ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!selectedTeamId) return;

    setLoading(true);
    setError(null);

    const [calendarResult, meetingsResult, tasksResult] = await Promise.allSettled([
      getTeamCalendar({ teamId: selectedTeamId, date: selectedDate, duration }),
      getMeetings(selectedTeamId, "SCHEDULED"),
      getTasks(selectedTeamId),
    ]);

    // Handle calendar (may fail if Google is not connected)
    if (calendarResult.status === "fulfilled") {
      setCalendarData(calendarResult.value);
      setSelectedAttendees((prev) => {
        const ids = calendarResult.value.memberSchedules.map((m) => m.userId);
        const valid = prev.filter((id) => ids.includes(id));
        return valid.length > 0 ? valid : ids;
      });
    } else {
      console.error("Failed to fetch team calendar", calendarResult.reason);
      setCalendarData(null);
      // Only show error if ALL requests failed
    }

    // Handle meetings
    if (meetingsResult.status === "fulfilled") {
      setMeetings(meetingsResult.value);
    } else {
      console.error("Failed to fetch meetings", meetingsResult.reason);
      setMeetings([]);
    }

    // Handle tasks
    if (tasksResult.status === "fulfilled") {
      setTasks(tasksResult.value);
    } else {
      console.error("Failed to fetch tasks", tasksResult.reason);
      setTasks([]);
    }

    // Show error only if calendar failed (availability depends on it)
    if (calendarResult.status === "rejected") {
      const msg = calendarResult.reason?.message || "";
      if (msg.includes("Google") || msg.includes("401")) {
        setError("Google Calendar not connected — availability data is unavailable. Meetings and tasks are still loaded.");
      } else {
        setError("Failed to load team availability, but meetings and tasks are available.");
      }
    }

    setLoading(false);
  }, [selectedTeamId, selectedDate, duration]);

  useEffect(() => {
    setCurrentUserId(readCookie("user_id"));
    setMeetUser({
      name: readCookie("user_name") ?? readCookie("user_email") ?? undefined,
      email: readCookie("user_email") ?? undefined,
    });
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setCalendarData(null);
      setMeetings([]);
      setTasks([]);
      setTeamMembers([]);
      return;
    }
    void Promise.all([loadData(), loadTeamMembers()]);
  }, [loadData, loadTeamMembers, selectedTeamId]);

  // ── Handlers ──────────────────────────────────────────────────

  function handleSlotSelect(slot: { start: string; end: string }) {
    setSelectedSlot(slot);
    setForm((f) => ({
      ...f,
      startTime: toLocalDT(new Date(slot.start)),
      endTime: toLocalDT(new Date(slot.end)),
    }));
    // Scroll form into view on mobile
    setTimeout(() => {
      document
        .getElementById("create-meeting-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function toggleAttendee(userId: string) {
    setSelectedAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function toggleLinkedTask(taskId: string) {
    setLinkedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  async function handleCreateMeeting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTeamId) return;

    setCreating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createMeeting({
        title: form.title,
        description: form.description,
        agenda: form.agenda,
        meetingLink: form.meetingLink,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        teamId: selectedTeamId,
        attendeeUserIds: selectedAttendees,
      });

      setForm({ title: "", description: "", agenda: "", meetingLink: "", startTime: "", endTime: "" });
      setLinkedTaskIds([]);
      setSuccessMsg("Meeting created and added to the team calendar.");
      toast.success("Meeting created.");
      setTab("upcoming");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting.");
      toast.error(err instanceof Error ? err.message : "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveMeeting(payload: {
    title: string;
    description: string;
    agenda: string;
    meetingLink: string;
    startTime: string;
    endTime: string;
    attendeeUserIds: string[];
  }) {
    if (!editingMeeting) return;

    setSavingMeeting(true);

    try {
      await updateMeeting(editingMeeting.meetingId, {
        title: payload.title,
        description: payload.description,
        agenda: payload.agenda,
        meetingLink: payload.meetingLink,
        startTime: new Date(payload.startTime).toISOString(),
        endTime: new Date(payload.endTime).toISOString(),
        attendeeUserIds: payload.attendeeUserIds,
      });
      setEditingMeeting(null);
      toast.success("Meeting updated.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update meeting.");
    } finally {
      setSavingMeeting(false);
    }
  }

  async function handleCancelMeeting(meeting: Meeting) {
    const confirmed = window.confirm(`Cancel "${meeting.title}"?`);
    if (!confirmed) return;

    try {
      await updateMeeting(meeting.meetingId, { status: "CANCELLED" });
      toast.success("Meeting cancelled.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel meeting.");
    }
  }

  // ── Derived ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const busyBlocks = calendarData?.memberSchedules.reduce(
      (n, m) => n + m.busySlots.length, 0
    ) ?? 0;
    return [
      { label: "Team members", value: calendarData?.memberSchedules.length ?? 0, icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
      { label: "Busy blocks", value: busyBlocks, icon: Clock3, color: "text-rose-500", bg: "bg-rose-500/10" },
      { label: "Best slots", value: calendarData?.recommendedSlots.length ?? 0, icon: Sparkles, color: "text-amber-500", bg: "bg-amber-500/10" },
      { label: "Scheduled", value: meetings.length, icon: Presentation, color: "text-blue-500", bg: "bg-blue-500/10" },
    ];
  }, [calendarData, meetings.length]);

  // ── No team guard ─────────────────────────────────────────────

  if (isLoadingTeams) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading team workspace…
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 rounded-full bg-primary/10 p-5 text-primary">
            <Presentation className="size-8" />
          </div>
          <h2 className="text-lg font-semibold">No team selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a team from the sidebar to open the meetings scheduler.
          </p>
        </CardContent>
      </Card>
    );
  }

  const memberSchedules = calendarData?.memberSchedules ?? [];
  const googleConnectedCount = memberSchedules.filter((member) => member.source === "google").length;
  const internalOnlyCount = memberSchedules.length - googleConnectedCount;
  const hasFullGoogleCoverage = memberSchedules.length > 0 && internalOnlyCount === 0;
  const hasPartialCoverage = googleConnectedCount > 0 && internalOnlyCount > 0;
  const slotLabel = hasFullGoogleCoverage ? "Best available slots" : "Estimated available slots";
  const slotDescription = hasFullGoogleCoverage
    ? "Optimal windows where all selected members appear free from connected calendars."
    : "Availability is estimated because some team members still rely on internal events only.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.06),transparent_55%)] pointer-events-none" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
              Availability Scheduler
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">
              Schedule for&nbsp;
              <span className="text-primary">{selectedTeam.name}</span>
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              See team availability, pick a recommended slot, then publish a meeting with agenda — all in one flow.
            </p>
          </div>

          {/* Date + duration controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date-picker" className="text-xs font-medium">Date</Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Input
                  id="date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-36 bg-background/80 text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration-picker" className="text-xs font-medium">Duration (min)</Label>
              <div className="flex items-center gap-1.5">
                {[30, 60, 90].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                      duration === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 self-end"
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Card
        className={
          hasFullGoogleCoverage
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/80"
        }
      >
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={
                hasFullGoogleCoverage
                  ? "rounded-full bg-emerald-100 p-2 text-emerald-700"
                  : "rounded-full bg-amber-100 p-2 text-amber-700"
              }
            >
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Google coverage {googleConnectedCount}/{memberSchedules.length || 0} members
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {hasFullGoogleCoverage
                  ? "All visible members are connected to Google Calendar, so slot recommendations are based on real Free/Busy data."
                  : hasPartialCoverage
                    ? `${internalOnlyCount} member${internalOnlyCount !== 1 ? "s are" : " is"} still using internal events only. Slot suggestions are estimates and may miss conflicts outside the app.`
                    : "No connected Google calendars detected for this team on this screen yet. Availability is based only on internal app events."}
              </p>
            </div>
          </div>

          {!hasFullGoogleCoverage ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/settings" />}>
              Connect Google Calendar
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border/60 transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : stat.value}
                  </p>
                </div>
                <div className={`rounded-2xl p-3 ${stat.bg}`}>
                  <Icon className={`size-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Alerts ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-3 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" />
              {successMsg}
            </div>
            <button type="button" onClick={() => setSuccessMsg(null)} className="ml-3 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/40 p-1 w-fit">
        {(["scheduler", "upcoming"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "scheduler" ? "Scheduler" : `Upcoming (${meetings.length})`}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SCHEDULER TAB                                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {tab === "scheduler" && (
          <motion.div
            key="scheduler"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid gap-6 xl:grid-cols-[1fr_380px]"
          >
            {/* LEFT: Availability panel */}
            <div className="space-y-5">

              {/* ── Time-grid header ── */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Team availability grid</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateLabel(selectedDate)} · {WORK_HOURS[0]}:00 – {WORK_HOURS[WORK_HOURS.length - 1] + 1}:00
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="size-3 rounded-sm bg-emerald-200" />
                        Free
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-3 rounded-sm bg-rose-200" />
                        Busy
                      </div>
                      {selectedSlot && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-3 rounded-sm border-2 border-primary bg-primary/20" />
                          Selected
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pb-5">
                  {/* Hour labels */}
                  <div ref={gridRef} className="pl-[152px]">
                    <div className="flex">
                      {WORK_HOURS.map((h) => (
                        <div
                          key={h}
                          className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
                        >
                          {String(h).padStart(2, "0")}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team heat strip */}
                  <div className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Team summary
                      </p>
                    </div>
                    <div className="flex-1">
                      {loading ? (
                        <div className="h-4 rounded-xl bg-muted/60 animate-pulse" />
                      ) : (
                        <TeamHeatRow memberSchedules={memberSchedules} selectedSlot={selectedSlot} />
                      )}
                    </div>
                  </div>

                  {/* Member rows */}
                  <div className="space-y-3">
                    {loading
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-36 shrink-0 rounded-xl bg-muted/40 h-9 animate-pulse" />
                            <div className="flex-1 rounded-xl bg-muted/40 h-9 animate-pulse" />
                          </div>
                        ))
                      : memberSchedules.map((member) => (
                          <GridMemberRow
                            key={member.userId}
                            member={member}
                            selectedSlot={selectedSlot}
                          />
                        ))}
                  </div>

                  {!loading && memberSchedules.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No member schedules found for this date.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ── Recommended slots ── */}
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{slotLabel}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {slotDescription}
                      </p>
                    </div>
                    <Sparkles className="size-4 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : calendarData?.recommendedSlots.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {calendarData.recommendedSlots.map((slot) => (
                        <SlotButton
                          key={`${slot.start}-${slot.end}`}
                          slot={slot}
                          isActive={selectedSlot?.start === slot.start && selectedSlot?.end === slot.end}
                          onSelect={handleSlotSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No {hasFullGoogleCoverage ? "recommended" : "estimated"} slots — try a different date or shorten the duration.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: Create meeting form */}
            <div id="create-meeting-form">
              <Card className="sticky top-6 border-border/60">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Create meeting</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedSlot
                      ? `Using slot: ${formatTimeRange(selectedSlot.start, selectedSlot.end)}`
                      : "Pick a slot above or set times manually."}
                  </p>
                  {selectedSlot && (
                    <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                      <Check className="size-3" />
                      {formatTimeRange(selectedSlot.start, selectedSlot.end)}
                      <button
                        type="button"
                        className="ml-auto cursor-pointer opacity-70 hover:opacity-100"
                        onClick={() => {
                          setSelectedSlot(null);
                          setForm((f) => ({ ...f, startTime: "", endTime: "" }));
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleCreateMeeting} className="space-y-4">
                    <div className="flex justify-end">
                      <TemplatePicker
                        type="meeting"
                        teamId={selectedTeamId ?? undefined}
                        currentUserId={currentUserId}
                        onApply={(t) => {
                          const p = t.payload as {
                            title?: string;
                            description?: string;
                            agenda?: string;
                            meetingLink?: string;
                          };
                          setForm((f) => ({
                            ...f,
                            title: p.title ?? f.title,
                            description: p.description ?? f.description,
                            agenda: p.agenda ?? f.agenda,
                            meetingLink: p.meetingLink ?? f.meetingLink,
                          }));
                        }}
                      />
                    </div>
                    {/* Title */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mtg-title" className="text-xs font-medium">Title *</Label>
                      <Input
                        id="mtg-title"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Sprint planning, design review…"
                        required
                      />
                    </div>

                    {/* Times */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mtg-start" className="text-xs font-medium">Start *</Label>
                        <Input
                          id="mtg-start"
                          type="datetime-local"
                          value={form.startTime}
                          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mtg-end" className="text-xs font-medium">End *</Label>
                        <Input
                          id="mtg-end"
                          type="datetime-local"
                          value={form.endTime}
                          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    {/* Meeting link */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mtg-link" className="text-xs font-medium">Meeting link</Label>
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          id="mtg-link"
                          type="url"
                          value={form.meetingLink}
                          onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))}
                          placeholder="https://meet.google.com/…"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mtg-desc" className="text-xs font-medium">Description</Label>
                      <textarea
                        id="mtg-desc"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Context, prep work, decisions needed…"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                    </div>

                    {/* Agenda */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mtg-agenda" className="text-xs font-medium">Agenda</Label>
                      <textarea
                        id="mtg-agenda"
                        value={form.agenda}
                        onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
                        placeholder={"1. Status update\n2. Blockers\n3. Decisions"}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                    </div>

                    {/* Attendees */}
                    {memberSchedules.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">Attendees</Label>
                          <span className="text-[10px] text-muted-foreground">
                            {selectedAttendees.length}/{memberSchedules.length}
                          </span>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                          Google-connected members contribute real Free/Busy data. Internal-only members are estimated from app events and scheduled meetings.
                        </div>
                        <div className="space-y-1.5">
                          {memberSchedules.map((member) => {
                            const selected = selectedAttendees.includes(member.userId);
                            return (
                              <button
                                key={member.userId}
                                type="button"
                                onClick={() => toggleAttendee(member.userId)}
                                className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
                                  selected
                                    ? "border-primary/40 bg-primary/6"
                                    : "border-border/50 hover:border-primary/30 hover:bg-muted/40"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar className="size-6 shrink-0">
                                      <AvatarFallback className="bg-primary/10 text-[9px] text-primary font-bold">
                                        {getInitials(member.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-medium">{member.name}</p>
                                      {member.email && (
                                        <p className="truncate text-[10px] text-muted-foreground">{member.email}</p>
                                      )}
                                      <div className="mt-1">
                                        <span
                                          className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${getAvailabilitySourceTone(member.source)}`}
                                        >
                                          {member.source === "google" ? "Accurate from Google" : "Estimated from internal events"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {selected && <Check className="size-3.5 shrink-0 text-primary" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Link tasks */}
                    {tasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="size-3.5 text-muted-foreground" />
                          <Label className="text-xs font-medium">Link tasks</Label>
                          {linkedTaskIds.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {linkedTaskIds.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {tasks.map((task) => {
                            const linked = linkedTaskIds.includes(task.taskId);
                            return (
                              <button
                                key={task.taskId}
                                type="button"
                                onClick={() => toggleLinkedTask(task.taskId)}
                                className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
                                  linked
                                    ? "border-primary/40 bg-primary/6"
                                    : "border-border/50 hover:border-primary/30 hover:bg-muted/40"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium">{task.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {task.status.replace("_", " ")}
                                    </p>
                                  </div>
                                  {linked && <Check className="size-3.5 shrink-0 text-primary" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {form.title.trim() && (
                      <div className="flex justify-start">
                        <SaveAsTemplate
                          type="meeting"
                          teamId={selectedTeamId ?? undefined}
                          suggestedName={form.title.slice(0, 60)}
                          payload={{
                            title: form.title,
                            description: form.description,
                            agenda: form.agenda,
                            meetingLink: form.meetingLink,
                          }}
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={creating || loading}
                    >
                      {creating ? (
                        <><Loader2 className="size-4 animate-spin" /> Creating…</>
                      ) : (
                        <><Plus className="size-4" /> Create meeting</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* UPCOMING TAB                                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {tab === "upcoming" && (
          <motion.div
            key="upcoming"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid gap-6 xl:grid-cols-2"
          >
            {/* Scheduled meetings */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Scheduled meetings</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Upcoming sessions for {selectedTeam.name}
                    </p>
                  </div>
                  <Presentation className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
                  ))
                ) : meetings.length > 0 ? (
                  meetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.meetingId}
                      meeting={meeting}
                      canManage={currentUserId === meeting.createdBy}
                      onEdit={setEditingMeeting}
                      onCancel={(nextMeeting) => void handleCancelMeeting(nextMeeting)}
                      onJoinSmartMeet={(m) => setJoinMeetTarget(m)}
                      onInviteGuest={(m) => setGuestInviteTarget(m)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-14">
                    <Presentation className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No meetings scheduled yet.</p>
                    <button
                      type="button"
                      onClick={() => setTab("scheduler")}
                      className="mt-2 text-xs text-primary hover:underline cursor-pointer"
                    >
                      Open scheduler →
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's team events */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Team events on {new Date(selectedDate + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Synced calendar events affecting availability.
                    </p>
                  </div>
                  <CalendarClock className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
                  ))
                ) : (calendarData?.teamEvents ?? []).length > 0 ? (
                  (calendarData?.teamEvents ?? []).map((event) => (
                    <div key={event.eventId} className="rounded-2xl border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{event.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatTimeRange(event.startTime, event.endTime)}
                          </p>
                          {event.description && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{event.source}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No team events for this date.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <EditMeetingDialog
        key={editingMeeting?.meetingId ?? "meeting-editor"}
        meeting={editingMeeting}
        teamMembers={teamMembers}
        open={Boolean(editingMeeting)}
        saving={savingMeeting}
        onOpenChange={(open) => {
          if (!open) setEditingMeeting(null);
        }}
        onSave={(payload) => void handleSaveMeeting(payload)}
      />

      {joinMeetTarget && (
        <JitsiEmbed
          meetingId={joinMeetTarget.meetingId}
          meetingTitle={joinMeetTarget.title}
          displayName={meetUser.name}
          email={meetUser.email}
          onClose={() => setJoinMeetTarget(null)}
        />
      )}

      {guestInviteTarget && (
        <GuestInviteModal
          scope="meeting"
          scopeId={guestInviteTarget.meetingId}
          label={guestInviteTarget.title}
          onClose={() => setGuestInviteTarget(null)}
        />
      )}
    </motion.div>
  );
}
