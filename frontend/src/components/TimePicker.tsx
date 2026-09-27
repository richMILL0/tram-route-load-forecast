import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface TimePickerProps {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function isValidTime(hour: string, minute: string): boolean {
  if (hour.length !== 2 || minute.length !== 2) return false;
  const h = Number(hour);
  const m = Number(minute);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const [hour, setHour] = useState(value?.slice(0, 2) ?? "");
  const [minute, setMinute] = useState(value?.slice(3, 5) ?? "");
  const minuteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHour(value?.slice(0, 2) ?? "");
    setMinute(value?.slice(3, 5) ?? "");
  }, [value]);

  const emit = (nextHour: string, nextMinute: string) => {
    const valid = isValidTime(nextHour, nextMinute);
    if (valid) onChange(`${nextHour}:${nextMinute}`);
  };

  const handleHour = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 2);
    if (next.length === 2 && Number(next) > 23) return;
    setHour(next);
    if (next.length === 2) minuteRef.current?.focus();
    emit(next, minute);
  };

  const handleMinute = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 2);
    if (next.length === 2 && Number(next) > 59) return;
    setMinute(next);
    emit(hour, next);
  };
  const handleBlur = (_part: "hour" | "minute") => {
    const nextHour = hour ? hour.padStart(2, "0") : hour;
    const nextMinute = minute ? minute.padStart(2, "0") : minute;

    if (hour) setHour(nextHour);
    if (minute) setMinute(nextMinute);

    emit(nextHour, nextMinute);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, part: "hour" | "minute") => {
    if (event.key === "ArrowRight" && part === "hour") {
      event.preventDefault();
      minuteRef.current?.focus();
    }
    if (event.key === "ArrowLeft" && part === "minute") {
      event.preventDefault();
      (event.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
    }
    if (event.key === "Backspace" && part === "minute" && event.currentTarget.value === "") {
      (event.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
    }
  };

  return (
    <div className={`time-picker ${disabled ? "time-picker--disabled" : ""}`}>
      <div className="time-picker__segments">
        <input
          value={hour}
          onChange={(e) => handleHour(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => handleBlur("hour")}
          onKeyDown={(e) => handleKeyDown(e, "hour")}
          placeholder="ЧЧ"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Часы"
        />
        <span>:</span>
        <input
          ref={minuteRef}
          value={minute}
          onChange={(e) => handleMinute(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => handleBlur("minute")}
          onKeyDown={(e) => handleKeyDown(e, "minute")}
          placeholder="ММ"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Минуты"
        />
      </div>
    </div>
  );
}
