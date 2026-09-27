import { useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "./components/MapView";
import { RouteList } from "./components/RouteList";
import { ForecastPanel } from "./components/ForecastPanel";
import { LoadLegend } from "./components/LoadLegend";
import { useRoutesQuery, useForecastMutation } from "./hooks/useRoutePrediction";
import type { RouteForecastResponse, LoadLevel } from "./types/route";
import { ApiError } from "./api/client";

interface ForecastEntry extends RouteForecastResponse {}

export default function App() {
  const routesQuery = useRoutesQuery();
  const forecastMutation = useForecastMutation();

  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [forecastByRoute, setForecastByRoute] = useState<Record<number, ForecastEntry>>({});
  const [isForecastView, setIsForecastView] = useState(false);
  const forecastSectionRef = useRef<HTMLElement | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = forecastSectionRef.current;
    if (!section || !selectedRouteId) {
      setIsForecastView(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsForecastView(entry.isIntersecting && entry.intersectionRatio >= 0.25),
      { threshold: [0, 0.25, 0.5, 1] },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [selectedRouteId]);

  const selectedRoute = useMemo(
    () => routesQuery.data?.features.find((f) => f.properties.id === selectedRouteId),
    [routesQuery.data, selectedRouteId]
  );

  const loadLevelByRoute = useMemo<Record<number, LoadLevel | undefined>>(() => {
    const map: Record<number, LoadLevel | undefined> = {};
    for (const [id, entry] of Object.entries(forecastByRoute)) {
      map[Number(id)] = entry.loadLevel;
    }
    return map;
  }, [forecastByRoute]);

  const forecastForMap = useMemo(() => {
    const map: Record<number, { loadLevel: LoadLevel | null }> = {};
    for (const [id, entry] of Object.entries(forecastByRoute)) {
      map[Number(id)] = { loadLevel: entry.loadLevel };
    }
    return map;
  }, [forecastByRoute]);

  function handleRunForecast() {
    if (!selectedRouteId || !startDate || !endDate || !startTime || !endTime) return;

    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    const maxEnd = new Date(start);
    maxEnd.setMonth(maxEnd.getMonth() + 1);
    const absoluteMax = new Date("2026-12-31T23:59:59");

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start || end > maxEnd || end > absoluteMax) return;

    forecastMutation.mutate(
      { routeId: selectedRouteId, startDate: `${startDate}T${startTime}:00`, endDate: `${endDate}T${endTime}:00` },
      {
        onSuccess: (result) => {
          setForecastByRoute((prev) => ({ ...prev, [selectedRouteId]: result }));
          mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }
    );
  }

  const mutationError =
    forecastMutation.error instanceof ApiError
      ? forecastMutation.error.message
      : forecastMutation.error
      ? "Не удалось получить прогноз. Попробуйте ещё раз."
      : null;

  const scrollToForecast = () => {
    forecastSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={`app-shell ${selectedRouteId ? "app-shell--route-selected" : ""}`}>
      <header className="app-header">
        <h1>Загруженность маршрутов · Москва</h1>
        <p>Выберите маршрут, задайте период дат и постройте прогноз посадок, чтобы увидеть загруженность на карте.</p>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          {routesQuery.isLoading && <p className="status-text">Загружаем маршруты…</p>}
          {routesQuery.isError && <p className="status-text status-text--error">Не удалось загрузить список маршрутов.</p>}
          {routesQuery.data && (
            <RouteList
              routes={routesQuery.data}
              selectedRouteId={selectedRouteId}
              loadLevelByRoute={loadLevelByRoute}
              onSelectRoute={setSelectedRouteId}
            />
          )}
          <LoadLegend />
        </aside>

        <main className="app-map" ref={mapSectionRef}>
          {routesQuery.data && (
            <MapView
              routes={routesQuery.data}
              forecastByRoute={forecastForMap}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
            />
          )}

          {selectedRouteId && (
            <button
              type="button"
              className="map-scroll-cue"
              onClick={isForecastView ? scrollToMap : scrollToForecast}
              aria-label={isForecastView ? "Вернуться к карте" : "Перейти к выбору даты и прогнозу"}
            >
              <span className="map-scroll-cue__arrow">{isForecastView ? "↑" : "↓"}</span>
            </button>
          )}
        </main>
      </div>

      {selectedRouteId && (
        <section className="forecast-section" ref={forecastSectionRef}>
          <div className="forecast-section__inner">
            <ForecastPanel
              selectedRoute={selectedRoute}
              startDate={startDate}
              endDate={endDate}
              startTime={startTime}
              endTime={endTime}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onRunForecast={handleRunForecast}
              isPending={forecastMutation.isPending}
              error={mutationError}
              result={selectedRouteId ? forecastByRoute[selectedRouteId] : undefined}
            />
          </div>
        </section>
      )}
    </div>
  );
}
