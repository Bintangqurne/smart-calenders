"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type FullCalendar from "@fullcalendar/react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, CheckCircle2,
  Plus, Users, LayoutGrid, Grid, Calendar, AlertCircle,
  ExternalLink, Loader2, Presentation, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  createEvent, deleteEvent, deleteMeeting, getEvents, createMeeting, getMeetings, getTeamCalendar, updateEvent, updateMeeting,
  type CalendarEvent, type Meeting,
} from "@/lib/api";
import { useTeam } from "@/hooks/use-team";
import { TeamPageGuard } from "@/components/team-page-guard";
import { useToast } from "@/components/toast-provider";
import { cn } from "@/lib/utils";

const CalendarView = dynamic(() => import("@/components/calendar-view"), { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VIEW_OPTIONS = [
  { value: "dayGridMonth", label: "Month", icon: LayoutGrid },
  { value: "timeGridWeek", label: "Week", icon: Grid },
  { value: "timeGridDay", label: "Day", icon: Calendar },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  google:       "#6366f1", // Indigo – from your Google Calendar
  internal:     "#f59e0b", // Amber – team events
  meeting:      "#10b981", // Emerald – scheduled meetings
  busy:         "#ef4444", // Red – busy/unavailable
};

type CalendarModalItem =
  | (CalendarEvent & { type: "event" })
  | (Meeting & { type: "meeting" });

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toLocalDT(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function isEditableManualEvent(event: CalendarModalItem | null, selectedTeamId: string | null) {
  return Boolean(
    event &&
      event.type === "event" &&
      event.source === "manual" &&
      (event.teamId === selectedTeamId || event.isPersonal)
  );
}

function isEditableMeeting(event: CalendarModalItem | null, currentUserId: string | null) {
  return Boolean(
    event &&
      event.type === "meeting" &&
      currentUserId &&
      event.createdBy === currentUserId
  );
}

function EventDetailsModal({
  event,
  selectedTeamId,
  currentUserId,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarModalItem | null;
  selectedTeamId: string | null;
  currentUserId: string | null;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    agenda?: string;
    meetingLink?: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const editableEvent = isEditableManualEvent(event, selectedTeamId);
  const editableMeeting = isEditableMeeting(event, currentUserId);
  const editable = editableEvent || editableMeeting;
  const [form, setForm] = useState(() => ({
    title: event?.title ?? "",
    description: event?.type === "event" ? event.description ?? "" : event?.description ?? "",
    agenda: event?.type === "meeting" ? event.agenda ?? "" : "",
    meetingLink: event?.type === "meeting" ? event.meetingLink ?? "" : "",
    startTime: event ? toLocalDT(new Date(event.startTime)) : "",
    endTime: event ? toLocalDT(new Date(event.endTime)) : "",
  }));

  React.useEffect(() => {
    setForm({
      title: event?.title ?? "",
      description: event?.type === "event" ? event.description ?? "" : event?.description ?? "",
      agenda: event?.type === "meeting" ? event.agenda ?? "" : "",
      meetingLink: event?.type === "meeting" ? event.meetingLink ?? "" : "",
      startTime: event ? toLocalDT(new Date(event.startTime)) : "",
      endTime: event ? toLocalDT(new Date(event.endTime)) : "",
    });
  }, [event]);

  if (!event) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editable ? "Edit calendar event" : event.title}</DialogTitle>
        </DialogHeader>

        {editable ? (
          <form
            className="space-y-4 pt-2"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              void onSave({
                title: form.title,
                description: form.description,
                startTime: new Date(form.startTime).toISOString(),
                endTime: new Date(form.endTime).toISOString(),
                agenda: editableMeeting ? form.agenda : undefined,
                meetingLink: editableMeeting ? form.meetingLink : undefined,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="team-event-title">Title</Label>
              <Input
                id="team-event-title"
                value={form.title}
                onChange={(changeEvent) =>
                  setForm((prev) => ({ ...prev, title: changeEvent.target.value }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="team-event-start">Start</Label>
                <Input
                  id="team-event-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(changeEvent) =>
                    setForm((prev) => ({ ...prev, startTime: changeEvent.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-event-end">End</Label>
                <Input
                  id="team-event-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(changeEvent) =>
                    setForm((prev) => ({ ...prev, endTime: changeEvent.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team-event-description">Description</Label>
              <textarea
                id="team-event-description"
                value={form.description}
                rows={3}
                onChange={(changeEvent) =>
                  setForm((prev) => ({ ...prev, description: changeEvent.target.value }))
                }
                className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            {editableMeeting ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-link">Meeting link</Label>
                  <Input
                    id="meeting-link"
                    type="url"
                    value={form.meetingLink}
                    onChange={(changeEvent) =>
                      setForm((prev) => ({ ...prev, meetingLink: changeEvent.target.value }))
                    }
                    placeholder="https://meet.google.com/..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-agenda">Agenda</Label>
                  <textarea
                    id="meeting-agenda"
                    value={form.agenda}
                    rows={3}
                    onChange={(changeEvent) =>
                      setForm((prev) => ({ ...prev, agenda: changeEvent.target.value }))
                    }
                    className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    placeholder="Agenda and key discussion points..."
                  />
                </div>
              </>
            ) : null}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                disabled={saving || deleting}
                onClick={() => void onDelete()}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>

              <div className="flex gap-2">
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={saving || deleting} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>
                {new Date(event.startTime).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {event.description ? (
              <div className="rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
                {event.description}
              </div>
            ) : null}
            {"meetingLink" in event && event.meetingLink ? (
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <ExternalLink className="size-4" />
                Join meeting
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">
                {event.type}
              </Badge>
              {"source" in event && event.source ? (
                <Badge variant="secondary" className="capitalize">
                  {event.source}
                </Badge>
              ) : null}
              {"status" in event && event.status ? (
                <Badge className="capitalize">{event.status.toLowerCase()}</Badge>
              ) : null}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventCreateModal({
  open,
  saving,
  selectedTeamName,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  selectedTeamName: string | null;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
  });

  React.useEffect(() => {
    if (!open) return;

    const now = new Date();
    const rounded = new Date(now);
    rounded.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    const end = new Date(rounded.getTime() + 60 * 60 * 1000);

    setForm({
      title: "",
      description: "",
      startTime: toLocalDT(rounded),
      endTime: toLocalDT(end),
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create calendar event</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void onCreate({
              title: form.title,
              description: form.description,
              startTime: new Date(form.startTime).toISOString(),
              endTime: new Date(form.endTime).toISOString(),
            });
          }}
        >
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Event will be created for {selectedTeamName ? <span className="font-semibold text-foreground">{selectedTeamName}</span> : "the active team"}.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-event-title">Title</Label>
            <Input
              id="create-event-title"
              value={form.title}
              onChange={(changeEvent) =>
                setForm((prev) => ({ ...prev, title: changeEvent.target.value }))
              }
              placeholder="Team sync, launch review, design crit…"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-event-start">Start</Label>
              <Input
                id="create-event-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(changeEvent) =>
                  setForm((prev) => ({ ...prev, startTime: changeEvent.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-event-end">End</Label>
              <Input
                id="create-event-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(changeEvent) =>
                  setForm((prev) => ({ ...prev, endTime: changeEvent.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-event-description">Description</Label>
            <textarea
              id="create-event-description"
              value={form.description}
              rows={3}
              onChange={(changeEvent) =>
                setForm((prev) => ({ ...prev, description: changeEvent.target.value }))
              }
              placeholder="Agenda, context, or notes…"
              className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {saving ? "Creating..." : "Create event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function EventsPage() {
  const { selectedTeam, selectedTeamId } = useTeam();
  const toast = useToast();
  const calendarRef = useRef<FullCalendar | null>(null);

  const [view, setView] = useState("timeGridWeek");
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Quick-meet modal state
  const [quickMeet, setQuickMeet] = useState<{ start: string; end: string } | null>(null);

  // Event detail state
  const [selectedEvent, setSelectedEvent] = useState<CalendarModalItem | null>(null);
  const [eventCreateOpen, setEventCreateOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Availability stats
  const [availabilityStatus, setAvailabilityStatus] = useState<"connected" | "partial" | "none">("none");
  const [memberCount, setMemberCount] = useState(0);
  const [busyCount, setBusyCount] = useState(0);

  // ── Data Fetching (availability always ON) ──────────────────

  const loadData = useCallback(async () => {
    if (!selectedTeamId) return;
    setLoading(true);

    const [evtsResult, mtgsResult, availResult] = await Promise.allSettled([
      getEvents(),
      getMeetings(selectedTeamId),
      getTeamCalendar({ 
        teamId: selectedTeamId, 
        date: new Date().toISOString().split('T')[0] 
      }),
    ]);

    const normalized: EventInput[] = [];

    // 1. Calendar Events (personal + google synced)
    if (evtsResult.status === "fulfilled") {
      evtsResult.value.forEach((e: CalendarEvent) => {
        normalized.push({
          id: `evt-${e.eventId}`,
          title: e.title,
          start: e.startTime,
          end: e.endTime,
          extendedProps: { ...e, type: "event" },
          backgroundColor: e.source === "google" ? EVENT_TYPE_COLORS.google : EVENT_TYPE_COLORS.internal,
          borderColor: "transparent",
          textColor: "#ffffff",
        });
      });
    }

    // 2. Meetings
    if (mtgsResult.status === "fulfilled") {
      mtgsResult.value.forEach((m: Meeting) => {
        normalized.push({
          id: `mtg-${m.meetingId}`,
          title: `📅 ${m.title}`,
          start: m.startTime,
          end: m.endTime,
          extendedProps: { ...m, type: "meeting" },
          backgroundColor: EVENT_TYPE_COLORS.meeting,
          borderColor: "transparent",
          textColor: "#ffffff",
        });
      });
    }

    // 3. Availability — ALWAYS loaded (not a toggle)
    if (availResult.status === "fulfilled" && availResult.value) {
      const data = availResult.value;
      setMemberCount(data.memberSchedules.length);
      let totalBusy = 0;
      let hasGoogle = false;

      data.memberSchedules.forEach((member) => {
        if (member.source === "google") hasGoogle = true;
        member.busySlots.forEach((slot, i) => {
          totalBusy++;
          normalized.push({
            id: `busy-${member.userId}-${i}`,
            title: `🔴 ${member.name}`,
            start: slot.start,
            end: slot.end,
            display: "background",
            backgroundColor: EVENT_TYPE_COLORS.busy,
          });
        });
      });

      setBusyCount(totalBusy);
      setAvailabilityStatus(hasGoogle ? "connected" : "partial");
    } else {
      setAvailabilityStatus("none");
      setMemberCount(0);
      setBusyCount(0);
    }

    setEvents(normalized);
    setLoading(false);
  }, [selectedTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentUserId(readCookie("user_id"));
  }, []);

  // Update calendar title whenever the calendar navigates
  useEffect(() => {
    const interval = setInterval(() => {
      const api = calendarRef.current?.getApi();
      if (api) {
        const title = api.view?.title || "";
        setCalendarTitle(title);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ── Quick Meet (click empty slot → offer to create meeting) ───

  const handleDateClick = (info: DateClickArg) => {
    // Only for time-grid views (week/day), not month
    if (!info.dateStr.includes("T")) return;
    const start = new Date(info.dateStr);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
    setQuickMeet({
      start: toLocalDT(start),
      end: toLocalDT(end),
    });
  };

  const handleQuickMeetCreate = async (formData: FormData) => {
    if (!selectedTeamId || !quickMeet) return;
    setCreating(true);
    try {
      await createMeeting({
        title: formData.get("title") as string,
        description: formData.get("description") as string || undefined,
        startTime: new Date(quickMeet.start).toISOString(),
        endTime: new Date(quickMeet.end).toISOString(),
        teamId: selectedTeamId,
      });
      setQuickMeet(null);
      await loadData();
      toast.success("Meeting created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  };

  // ── Animation ──────────────────────────────────────────────

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  // ── Availability Status Indicator ─────────────────────────

  const StatusIndicator = () => {
    if (availabilityStatus === "connected") {
      return (
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="size-3.5" />
          Google Calendar Synced
        </div>
      );
    }
    if (availabilityStatus === "partial") {
      return (
        <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600">
          <AlertCircle className="size-3.5" />
          Partial Availability
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarDays className="size-3.5" />
        Connect Google Calendar for availability
      </div>
    );
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="h-full space-y-5">

      {/* ── Header ── */}
      <motion.div variants={item} className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {selectedTeam
              ? <>View availability and schedule meetings for <span className="font-semibold text-foreground">{selectedTeam.name}</span></>
              : "Select a team to view the calendar"
            }
          </p>
          <StatusIndicator />
        </div>

        <div className="flex items-center gap-2">
          <Button className="gap-2 h-9" onClick={() => setEventCreateOpen(true)}>
            <Plus className="size-4" />
            New Event
          </Button>

          {/* Stats pills */}
          {memberCount > 0 && (
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                <span className="font-bold text-foreground">{memberCount}</span> members
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-red-500" />
                <span className="font-bold text-foreground">{busyCount}</span> busy blocks
              </div>
            </div>
          )}

          {/* Navigate to full scheduler */}
          <Button
            variant="outline"
            className="gap-2 h-9"
            onClick={() => {
              window.location.href = "/meetings";
            }}
          >
            <Presentation className="size-4" />
            Schedule Meeting
          </Button>
        </div>
      </motion.div>

      <TeamPageGuard
        loading={loading}
        loadingLabel="calendar"
        emptyHeading="No team selected"
        emptyDescription="Choose a team from the sidebar to load the calendar."
      >
        {/* ── Calendar Control Bar ── */}
        <motion.div variants={item} className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-2 lg:justify-self-start">
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => calendarRef.current?.getApi().prev()}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" className="h-8 px-3 text-[11px] font-bold uppercase tracking-wider" onClick={() => calendarRef.current?.getApi().today()}>
                Jump To Today
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => calendarRef.current?.getApi().next()}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="text-center lg:justify-self-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current range
            </p>
            <h2 className="mt-1 min-w-40 text-base font-bold font-heading text-foreground">
              {calendarTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-sm lg:justify-self-end">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => { setView(opt.value); calendarRef.current?.getApi().changeView(opt.value); }}
                  className={cn(
                    "h-8 gap-1.5 text-xs font-semibold px-3 transition-all",
                    view === opt.value ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted"
                  )}
                >
                  <Icon className="size-3.5" />{opt.label}
                </Button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Legend ── */}
        <motion.div variants={item} className="flex flex-wrap items-center gap-5 px-1">
          {[
            { label: "Google Calendar", color: EVENT_TYPE_COLORS.google },
            { label: "Team Events", color: EVENT_TYPE_COLORS.internal },
            { label: "Meetings", color: EVENT_TYPE_COLORS.meeting },
            { label: "Busy / Unavailable", color: EVENT_TYPE_COLORS.busy, striped: true },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              {l.striped ? (
                <div className="size-3 rounded border border-red-300" style={{
                  background: "repeating-linear-gradient(-45deg, #ef4444, #ef4444 1px, #fca5a5 1px, #fca5a5 3px)"
                }} />
              ) : (
                <div className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{l.label}</span>
            </div>
          ))}
          <div className="ml-auto text-[10px] text-muted-foreground">
            <Zap className="inline size-3 mr-1" />Click an empty time slot to quickly create a meeting
          </div>
        </motion.div>

        {/* ── Calendar ── */}
        <motion.div variants={item} className="saas-card p-4 min-h-[600px] bg-card overflow-hidden">
          <CalendarView
            view={view}
            events={events}
            calendarRef={calendarRef}
            onEventClick={(info: EventClickArg) => {
              const props = info.event.extendedProps as CalendarModalItem;
              if (props?.type) setSelectedEvent(props);
            }}
            onDateClick={handleDateClick}
          />
        </motion.div>
      </TeamPageGuard>

      {/* ── Event Detail Modal ── */}
      <EventCreateModal
        open={eventCreateOpen}
        saving={creatingEvent}
        selectedTeamName={selectedTeam?.name ?? null}
        onClose={() => setEventCreateOpen(false)}
        onCreate={async (payload) => {
          if (!selectedTeamId) {
            toast.error("Select a team before creating an event.");
            return;
          }

          setCreatingEvent(true);
          try {
            await createEvent({
              ...payload,
              teamId: selectedTeamId,
            });
            toast.success("Calendar event created.");
            setEventCreateOpen(false);
            await loadData();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create event.");
          } finally {
            setCreatingEvent(false);
          }
        }}
      />

      {selectedEvent ? (
        <EventDetailsModal
          key={`${selectedEvent.type}-${"eventId" in selectedEvent ? selectedEvent.eventId : selectedEvent.meetingId}`}
          event={selectedEvent}
          selectedTeamId={selectedTeamId}
          currentUserId={currentUserId}
          saving={savingEvent}
          deleting={deletingEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={async (payload) => {
            setSavingEvent(true);
            try {
              if (selectedEvent.type === "event") {
                await updateEvent(selectedEvent.eventId, payload);
                toast.success("Calendar event updated.");
              } else {
                await updateMeeting(selectedEvent.meetingId, {
                  title: payload.title,
                  description: payload.description,
                  agenda: payload.agenda,
                  meetingLink: payload.meetingLink,
                  startTime: payload.startTime,
                  endTime: payload.endTime,
                });
                toast.success("Meeting updated.");
              }
              setSelectedEvent(null);
              await loadData();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to update item.");
            } finally {
              setSavingEvent(false);
            }
          }}
          onDelete={async () => {
            setDeletingEvent(true);
            try {
              if (selectedEvent.type === "event") {
                await deleteEvent(selectedEvent.eventId);
                toast.success("Calendar event deleted.");
              } else {
                await deleteMeeting(selectedEvent.meetingId);
                toast.success("Meeting deleted.");
              }
              setSelectedEvent(null);
              await loadData();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to delete item.");
            } finally {
              setDeletingEvent(false);
            }
          }}
        />
      ) : null}

      {/* ── Quick Meet Modal (click empty slot) ── */}
      <Dialog open={!!quickMeet} onOpenChange={(open) => !open && setQuickMeet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Quick Meeting
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This time slot appears to be free. Create a meeting here?
          </p>
          <form action={handleQuickMeetCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input name="title" placeholder="Meeting title..." required autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={quickMeet?.start || ""}
                  onChange={(e) => setQuickMeet(prev => prev ? { ...prev, start: e.target.value } : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={quickMeet?.end || ""}
                  onChange={(e) => setQuickMeet(prev => prev ? { ...prev, end: e.target.value } : null)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input name="description" placeholder="Brief agenda or notes..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {creating ? "Creating..." : "Create Meeting"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
