"use client";

/**
 * Thin FullCalendar wrapper. Kept in its own module so it can be lazy-loaded
 * (next/dynamic, ssr:false) from OrdersCalendar — this keeps the FullCalendar
 * bundle out of the initial admin payload and avoids SSR/`window` issues.
 *
 * The visible chrome (title, nav, view switch, states) lives in OrdersCalendar
 * so it can use the project's own design system. Here we only render the grid
 * with `headerToolbar={false}` and forward the calendar API up via `onReady`.
 */

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import arLocale from "@fullcalendar/core/locales/ar";
import frLocale from "@fullcalendar/core/locales/fr";

// Map app locales → FullCalendar locale objects. Darija ('dr') has no upstream
// FullCalendar locale, so it reuses the Arabic one for weekday/RTL rendering;
// all user-facing chrome strings come from our own dictionary regardless.
const FC_LOCALES = { ar: arLocale, dr: arLocale, fr: frLocale };

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];

// Fewer events per day cell on small screens to avoid overcrowding.
function useDayMaxEvents() {
  const [max, setMax] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? 2 : 3,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setMax(mq.matches ? 2 : 3);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return max;
}

export default function CalendarView({
  events = [],
  initialView = "dayGridMonth",
  locale = "en",
  dir = "ltr",
  height = "auto",
  onReady,
  onDatesSet,
  onEventClick,
  onDateClick,
  eventContent,
  dayCellContent,
  allDaySlot = false,
  moreLinkContent,
}) {
  const ref = useRef(null);
  const dayMaxEvents = useDayMaxEvents();

  useEffect(() => {
    if (ref.current && typeof onReady === "function") {
      onReady(ref.current.getApi());
    }
  }, [onReady]);

  return (
    <FullCalendar
      ref={ref}
      plugins={PLUGINS}
      initialView={initialView}
      locale={FC_LOCALES[locale] ?? undefined}
      direction={dir === "rtl" ? "rtl" : "ltr"}
      headerToolbar={false}
      height={height}
      events={events}
      datesSet={onDatesSet}
      eventClick={onEventClick}
      dateClick={onDateClick}
      eventContent={eventContent}
      dayCellContent={dayCellContent}
      moreLinkContent={moreLinkContent}
      dayMaxEvents={dayMaxEvents}
      eventInteractive
      nowIndicator
      expandRows
      fixedWeekCount={false}
      firstDay={locale === "en" || locale === "fr" ? 1 : 6}
      allDaySlot={allDaySlot}
      slotMinTime="00:00:00"
      slotMaxTime="24:00:00"
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
      displayEventEnd={false}
    />
  );
}
