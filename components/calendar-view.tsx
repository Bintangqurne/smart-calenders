"use client";

import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";

interface CalendarProps {
  view: string;
  events: EventInput[];
  onEventClick?: (info: EventClickArg) => void;
  onDateClick?: (info: DateClickArg) => void;
  calendarRef: React.RefObject<FullCalendar | null>;
}

export default function CalendarView({ view, events, onEventClick, onDateClick, calendarRef }: CalendarProps) {
  return (
    <div className="calendar-container h-full">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={view}
        events={events}
        headerToolbar={false}
        height="auto"
        nowIndicator
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        dayMaxEvents={3}
        selectable
        selectMirror
        eventClassNames="rounded-lg border-none px-1.5 py-0.5 text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        slotLabelClassNames="text-[10px] uppercase font-bold text-muted-foreground/50 pr-4"
        dayHeaderClassNames="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 py-3 border-none"
        eventClick={onEventClick}
        dateClick={onDateClick}
      />

      <style jsx global>{`
        .calendar-container .fc {
          --fc-border-color: rgba(0, 0, 0, 0.05);
          --fc-today-bg-color: rgba(99, 102, 241, 0.03);
          --fc-neutral-bg-color: transparent;
          --fc-list-event-hover-bg-color: var(--muted);
          font-family: inherit;
        }
        .dark .calendar-container .fc {
          --fc-border-color: rgba(255, 255, 255, 0.08);
        }
        .calendar-container .fc-theme-standard td, 
        .calendar-container .fc-theme-standard th {
          border-color: var(--fc-border-color);
        }
        .calendar-container .fc .fc-col-header-cell-cushion {
          padding-bottom: 8px !important;
        }
        .calendar-container .fc-timegrid-slot {
          height: 3rem !important;
          cursor: pointer;
        }
        .calendar-container .fc-timegrid-slot:hover {
          background: rgba(99, 102, 241, 0.04);
        }
        .calendar-container .fc-event-main {
          padding: 2px !important;
        }
        .calendar-container .fc-daygrid-event {
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        /* Busy slots - red tint */
        .fc-bg-event {
          opacity: 0.15 !important;
          background: repeating-linear-gradient(
            -45deg,
            #ef4444,
            #ef4444 2px,
            #fca5a5 2px,
            #fca5a5 6px
          ) !important;
          border-left: 3px solid #ef4444 !important;
        }
        /* Free slot hover hint */
        .calendar-container .fc-timegrid-col:not(.fc-day-past) .fc-timegrid-col-frame {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
