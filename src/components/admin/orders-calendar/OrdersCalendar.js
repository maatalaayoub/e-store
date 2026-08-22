"use client";

/**
 * Reusable Orders Calendar foundation (Phase 2).
 *
 * Presentational + stateful shell around the lazy-loaded FullCalendar grid.
 * Owns the toolbar (Today / prev / next / title / view switch) and the
 * loading / empty / error states, all rendered with the project's own design
 * system. Data is passed in via `events`; parents wire the real order data and
 * date-range fetching in later phases.
 *
 * Props:
 *  - events         FullCalendar event objects (default []).
 *  - loading        Show the loading overlay.
 *  - error          Truthy → show the error state instead of the grid.
 *  - onRetry        Called when the user clicks "Try again" in the error state.
 *  - onRangeChange  ({ start, end, startStr, endStr, viewType }) whenever the
 *                   visible range changes — used for range-scoped fetching.
 *  - onEventClick   FullCalendar eventClick handler (arg with arg.event).
 *  - eventContent   Optional custom FullCalendar event renderer.
 *  - initialView    "month" | "week" | "day" (default "month").
 *  - height         FullCalendar height (default "auto").
 */

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarX2,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { useLocale, useDictionary } from "@/components/providers/LocaleProvider";

const VIEWS = [
  { key: "month", fcView: "dayGridMonth" },
  { key: "week", fcView: "timeGridWeek" },
  { key: "day", fcView: "timeGridDay" },
];

const FC_TO_KEY = {
  dayGridMonth: "month",
  timeGridWeek: "week",
  timeGridDay: "day",
};

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-px bg-zinc-100 p-px rounded-[3px] overflow-hidden">
      {Array.from({ length: 42 }).map((_, i) => (
        <div key={i} className="h-20 bg-white animate-pulse sm:h-24" />
      ))}
    </div>
  );
}

const CalendarView = dynamic(() => import("./CalendarView"), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
});

export default function OrdersCalendar({
  events = [],
  loading = false,
  error = null,
  onRetry,
  onRangeChange,
  onEventClick,
  eventContent,
  dayCellContent,
  allDaySlot = false,
  initialView = "month",
  height = "auto",
  bare = false,
}) {
  const { locale, dir } = useLocale();
  const dict = useDictionary();
  const t = dict?.admin?.orders?.calendar ?? {};
  const isRtl = dir === "rtl";

  const apiRef = useRef(null);
  const [title, setTitle] = useState("");
  const [activeView, setActiveView] = useState(initialView);

  const initialFcView = useMemo(
    () => VIEWS.find((v) => v.key === initialView)?.fcView ?? "dayGridMonth",
    [initialView],
  );

  const handleReady = useCallback((api) => {
    apiRef.current = api;
    setTitle(api.view.title);
  }, []);

  const handleDatesSet = useCallback(
    (info) => {
      setTitle(info.view.title);
      setActiveView(FC_TO_KEY[info.view.type] ?? "month");
      onRangeChange?.({
        start: info.start,
        end: info.end,
        startStr: info.startStr,
        endStr: info.endStr,
        viewType: FC_TO_KEY[info.view.type] ?? "month",
      });
    },
    [onRangeChange],
  );

  const goPrev = useCallback(() => apiRef.current?.prev(), []);
  const goNext = useCallback(() => apiRef.current?.next(), []);
  const goToday = useCallback(() => apiRef.current?.today(), []);
  const changeView = useCallback((fcView) => apiRef.current?.changeView(fcView), []);

  // Selecting a day drills into its day view (uses the calendar's own data).
  const handleDateClick = useCallback((info) => {
    apiRef.current?.changeView("timeGridDay", info.date);
  }, []);

  const moreLinkContent = useCallback(
    (arg) => (t.more ? t.more.replace("{count}", arg.num) : `+${arg.num}`),
    [t.more],
  );

  // In RTL the "previous in time" control points to the right and vice-versa.
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className={`oc-calendar flex flex-col bg-white ${
        bare ? "" : "rounded-[3px] border border-zinc-100"
      }`}
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-[3px] border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            {t.today ?? "Today"}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              aria-label={t.prev ?? "Previous"}
              className="rounded-[3px] border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <PrevIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t.next ?? "Next"}
              className="rounded-[3px] border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <NextIcon className="h-4 w-4" />
            </button>
          </div>
          <h2 className="ms-1 text-sm font-bold text-zinc-900 sm:text-base">{title}</h2>
        </div>

        {/* View switch */}
        <div
          className="inline-flex items-center rounded-[3px] border border-zinc-200 p-0.5"
          role="group"
          aria-label={t.view_label ?? "View"}
        >
          {VIEWS.map((v) => {
            const selected = activeView === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => changeView(v.fcView)}
                aria-pressed={selected}
                className={`rounded-[2px] px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {t[v.key] ?? v.key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="relative p-2 sm:p-3">
        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
          >
            <AlertCircle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {t.error_title ?? "Couldn't load orders"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {t.error_desc ?? "Something went wrong while loading the calendar."}
              </p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-[3px] border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <RotateCw className="h-4 w-4" />
                {t.retry ?? "Try again"}
              </button>
            )}
          </div>
        ) : (
          <>
            <CalendarView
              events={events}
              initialView={initialFcView}
              locale={locale}
              dir={dir}
              height={height}
              onReady={handleReady}
              onDatesSet={handleDatesSet}
              onEventClick={onEventClick}
              onDateClick={handleDateClick}
              eventContent={eventContent}
              dayCellContent={dayCellContent}
              allDaySlot={allDaySlot}
              moreLinkContent={moreLinkContent}
            />

            {/* Empty overlay — grid stays visible behind a subtle note. */}
            {!loading && events.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-[3px] border border-zinc-100 bg-white/95 px-6 py-5 text-center shadow-sm">
                  <CalendarX2 className="h-6 w-6 text-zinc-300" />
                  <p className="text-sm font-semibold text-zinc-700">
                    {t.empty_title ?? "No orders in this range"}
                  </p>
                  <p className="max-w-xs text-xs text-zinc-500">
                    {t.empty_desc ?? "Orders will appear on the calendar as customers check out."}
                  </p>
                </div>
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]"
              >
                <div className="flex items-center gap-2 rounded-[3px] border border-zinc-100 bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loading ?? "Loading orders…"}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
