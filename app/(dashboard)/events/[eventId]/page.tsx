"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { deleteEvent, getEvent, updateEvent, type CalendarEvent } from "@/lib/api";

function toLocalDT(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
  });

  const loadEvent = useCallback(async () => {
    setLoading(true);

    try {
      const nextEvent = await getEvent(eventId);
      setEvent(nextEvent);
      setForm({
        title: nextEvent.title,
        description: nextEvent.description ?? "",
        startTime: toLocalDT(nextEvent.startTime),
        endTime: toLocalDT(nextEvent.endTime),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load event.");
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  async function handleSave(eventSubmit: React.FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();

    setSaving(true);

    try {
      const updated = await updateEvent(eventId, {
        title: form.title,
        description: form.description,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      setEvent(updated);
      toast.success("Event updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;

    const confirmed = window.confirm(`Delete "${event.title}"?`);
    if (!confirmed) return;

    setDeleting(true);

    try {
      await deleteEvent(eventId);
      toast.success("Event deleted.");
      router.push("/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
          <ArrowLeft className="size-4" />
          Back to calendar
        </Button>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Event not found or inaccessible.
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
        <ArrowLeft className="size-4" />
        Back to calendar
      </Button>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Event detail</Badge>
                <Badge variant="outline" className="capitalize">
                  {event.source}
                </Badge>
                <Badge variant="outline">{event.teamId ? "Team event" : "Personal event"}</Badge>
              </div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CalendarDays className="size-5 text-primary" />
                {event.title}
              </CardTitle>
            </div>

            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="gap-2"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete event
            </Button>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="size-4" />
              {new Date(event.startTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div>
              Updated{" "}
              {new Date(event.updatedAt ?? event.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, title: eventInput.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-start">Start</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(eventInput) =>
                    setForm((prev) => ({ ...prev, startTime: eventInput.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-end">End</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(eventInput) =>
                    setForm((prev) => ({ ...prev, endTime: eventInput.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-description">Description</Label>
              <textarea
                id="event-description"
                rows={4}
                value={form.description}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, description: eventInput.target.value }))
                }
                className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
