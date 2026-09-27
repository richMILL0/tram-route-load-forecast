import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

interface DatePickerProps {
  value: string | null;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DEFAULT_MIN_DATE = "2025-01-01";
const DEFAULT_MAX_DATE = "2026-12-31";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function DatePicker({ value, onChange, min, max, disabled }: DatePickerProps) {
  const selected = parseDate(value);
  const minDate = parseDate(min ?? DEFAULT_MIN_DATE);
  const maxDate = parseDate(max ?? DEFAULT_MAX_DATE);
  const initialCalendarDate = selected ?? minDate ?? new Date();

  const [open, setOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(initialCalendarDate);
  const [day, setDay] = useState(selected ? String(selected.getDate()).padStart(2, "0") : "");
  const [month, setMonth] = useState(selected ? String(selected.getMonth() + 1).padStart(2, "0") : "");
  const [year, setYear] = useState(selected ? String(selected.getFullYear()) : "");
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      setDay(String(selected.getDate()).padStart(2, "0"));
      setMonth(String(selected.getMonth() + 1).padStart(2, "0"));
      setYear(String(selected.getFullYear()));
      setCalendarDate(selected);
    }
  }, [value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const emitTypedDate = (nextDay: string, nextMonth: string, nextYear: string) => {
    if (nextDay.length !== 2 || nextMonth.length !== 2 || nextYear.length !== 4) return;
    const d = Number(nextDay);
    const m = Number(nextMonth);
    const y = Number(nextYear);
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1) || y < 1000) return;
    const candidate = new Date(y, m - 1, d);
    if (minDate && dateOnly(candidate) < dateOnly(minDate)) return;
    if (maxDate && dateOnly(candidate) > dateOnly(maxDate)) return;
    onChange(toIso(candidate));
    setCalendarDate(candidate);
  };

  const handleDay = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 2);
    if (next.length === 2 && Number(next) > 31) return;
    setDay(next);
    if (next.length === 2) monthRef.current?.focus();
    emitTypedDate(next, month, year);
  };

  const handleMonth = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 2);
    if (next.length === 2 && Number(next) > 12) return;
    setMonth(next);
    if (next.length === 2) yearRef.current?.focus();
    emitTypedDate(day, next, year);
  };

  const handleYear = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 4);
    if (next.length === 4 && (Number(next) < 2025 || Number(next) > 2026)) return;
    setYear(next);
    emitTypedDate(day, month, next);
  };
  const handleBlur = (_part: "day" | "month" | "year") => {
    const nextDay = day ? day.padStart(2, "0") : day;
    const nextMonth = month ? month.padStart(2, "0") : month;
    const nextYear = year;

    if (day) setDay(nextDay);
    if (month) setMonth(nextMonth);

    emitTypedDate(nextDay, nextMonth, nextYear);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, part: "day" | "month" | "year") => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (part === "day") monthRef.current?.focus();
      if (part === "month") yearRef.current?.focus();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (part === "year") monthRef.current?.focus();
      if (part === "month") dayRef.current?.focus();
    }
    if (event.key === "Backspace" && (event.currentTarget as HTMLInputElement).value === "") {
      if (part === "month") dayRef.current?.focus();
      if (part === "year") monthRef.current?.focus();
    }
  };

  const calendarDays = useMemo(() => {
    const yearValue = calendarDate.getFullYear();
    const monthValue = calendarDate.getMonth();
    const firstDay = new Date(yearValue, monthValue, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const total = daysInMonth(yearValue, monthValue);
    return Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
      const dayNumber = index - offset + 1;
      return dayNumber < 1 || dayNumber > total ? null : new Date(yearValue, monthValue, dayNumber);
    });
  }, [calendarDate]);

  const isDisabled = (date: Date) =>
    (minDate && dateOnly(date) < dateOnly(minDate)) || (maxDate && dateOnly(date) > dateOnly(maxDate));

  const moveMonth = (delta: number) => {
    setCalendarDate((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      if (minDate && next.getFullYear() === minDate.getFullYear() && next.getMonth() < minDate.getMonth()) {
        return new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      }
      if (minDate && dateOnly(next) < dateOnly(new Date(minDate.getFullYear(), minDate.getMonth(), 1))) {
        return new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      }
      if (maxDate && dateOnly(next) > dateOnly(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1))) {
        return new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      }
      return next;
    });
  };

  return (
    <div className="date-picker" ref={rootRef}>
      <div className={`date-picker__input ${disabled ? "date-picker__input--disabled" : ""}`} onClick={() => !disabled && setOpen(true)}>
        <div className="date-picker__segments">
          <input ref={dayRef} value={day} onChange={(e) => handleDay(e.target.value)} onFocus={(e) => e.currentTarget.select()} onBlur={() => handleBlur("day")} onKeyDown={(e) => handleKeyDown(e, "day")} placeholder="ДД" inputMode="numeric" disabled={disabled} aria-label="День" />
          <span>.</span>
          <input ref={monthRef} value={month} onChange={(e) => handleMonth(e.target.value)} onFocus={(e) => e.currentTarget.select()} onBlur={() => handleBlur("month")} onKeyDown={(e) => handleKeyDown(e, "month")} placeholder="ММ" inputMode="numeric" disabled={disabled} aria-label="Месяц" />
          <span>.</span>
          <input ref={yearRef} value={year} onChange={(e) => handleYear(e.target.value)} onFocus={(e) => e.currentTarget.select()} onBlur={() => handleBlur("year")} onKeyDown={(e) => handleKeyDown(e, "year")} placeholder="ГГГГ" inputMode="numeric" disabled={disabled} aria-label="Год" />
        </div>
        <button type="button" className="date-picker__calendar-button" onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((current) => !current); }} aria-label="Открыть календарь">▣</button>
      </div>

      {open && !disabled && (
        <div className="date-picker__popup">
          <div className="date-picker__header">
            <button type="button" onClick={() => moveMonth(-1)}>‹</button>
            <strong>{MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}</strong>
            <button type="button" onClick={() => moveMonth(1)}>›</button>
          </div>
          <div className="date-picker__weekdays">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="date-picker__grid">
            {calendarDays.map((date, index) => date ? (
              <button
                key={index}
                type="button"
                className={`date-picker__day ${selected && toIso(selected) === toIso(date) ? "date-picker__day--selected" : ""}`}
                disabled={!!isDisabled(date)}
                onClick={() => { onChange(toIso(date)); setOpen(false); }}
              >
                {date.getDate()}
              </button>
            ) : <span key={index} />)}
          </div>
        </div>
      )}
    </div>
  );
}
