import type { RouteFeature, RouteForecastResponse } from "../types/route";
import { LOAD_COLORS, LOAD_LABELS } from "../theme/load";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";

interface ForecastPanelProps {
  selectedRoute: RouteFeature | undefined;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onRunForecast: () => void;
  isPending: boolean;
  error: string | null;
  result: RouteForecastResponse | undefined;
}

const MIN_FORECAST_DATE = "2025-01-01";
const MAX_FORECAST_DATE = "2026-12-31";

function addOneMonth(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  result.setMonth(result.getMonth() + 1);
  if (result.getDate() !== day) result.setDate(0);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

export function ForecastPanel({ selectedRoute, startDate, endDate, startTime, endTime, onStartDateChange, onEndDateChange, onStartTimeChange, onEndTimeChange, onRunForecast, isPending, error, result }: ForecastPanelProps) {
  const maxEndDate = startDate
    ? [addOneMonth(startDate), MAX_FORECAST_DATE].sort()[0]
    : undefined;
  const datetimeRangeInvalid = (() => {
    if (!startDate || !endDate || !startTime || !endTime) return false;
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    const maxEnd = new Date(start);
    maxEnd.setMonth(maxEnd.getMonth() + 1);
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start || end > maxEnd;
  })();

  return (
    <div className="forecast-panel">
      <div className="forecast-panel__section">
        <span className="forecast-panel__label">Маршрут</span>
        <p className="forecast-panel__route-name">
          {selectedRoute ? `№${selectedRoute.properties.id} · ${selectedRoute.properties.name}` : "Выберите маршрут в списке слева"}
        </p>
      </div>

      {selectedRoute && (
        <>
          <div className="forecast-panel__section forecast-panel__date-section">
            <span className="forecast-panel__label">Начало периода</span>
            <div className="forecast-panel__datetime">
              <DatePicker
                value={startDate}
                onChange={onStartDateChange}
                min={MIN_FORECAST_DATE}
                max={MAX_FORECAST_DATE}
              />
              <TimePicker value={startTime} onChange={onStartTimeChange} />
            </div>
          </div>

          <div className="forecast-panel__section forecast-panel__date-section">
            <span className="forecast-panel__label">Конец периода</span>
            <div className="forecast-panel__datetime">
              <DatePicker
                value={endDate}
                onChange={onEndDateChange}
                min={startDate ?? undefined}
                max={maxEndDate}
                disabled={!startDate}
              />
              <TimePicker value={endTime} onChange={onEndTimeChange} disabled={!startDate} />
            </div>
          </div>

          {datetimeRangeInvalid && (
            <p className="forecast-panel__error">
              Конец периода должен быть не раньше начала, не позже чем через один календарный месяц и не позднее 31.12.2026.
            </p>
          )}

          <button
            type="button"
            className="forecast-panel__submit"
            onClick={onRunForecast}
            disabled={!startDate || !endDate || !startTime || !endTime || datetimeRangeInvalid || isPending}
          >
            {isPending ? "Считаем прогноз…" : "Построить прогноз"}
          </button>
        </>
      )}

      {error && <p className="forecast-panel__error">{error}</p>}

      {result && !error && (
        <div className="forecast-result">
          <div className="forecast-result__badge" style={{ backgroundColor: LOAD_COLORS[result.loadLevel] }}>
            {LOAD_LABELS[result.loadLevel]}
          </div>
          <dl className="forecast-result__details">
            <div><dt>Посадок за период</dt><dd>{Math.round(result.boardings).toLocaleString("ru-RU")}</dd></div>
            <div><dt>Посадок в час</dt><dd>{Math.round(result.boardingsPerHour).toLocaleString("ru-RU")}</dd></div>
            <div><dt>Период</dt><dd>{result.startDate} — {result.endDate}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
