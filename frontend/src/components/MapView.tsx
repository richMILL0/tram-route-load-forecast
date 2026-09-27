import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import MapLibreMap, {
  NavigationControl,
  ScaleControl,
  Source,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Popup,
} from "react-map-gl/maplibre";
import type { LayerProps } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteCollection, RenderedRouteProperties } from "../types/route";
import { LOAD_COLORS, NEUTRAL_ROUTE_COLOR } from "../theme/load";
import { loadOsmTramRoutes, applyOsmRoutes, getOsmStops } from "../data/osmTramRoutes";

interface ForecastByRoute {
  [routeId: number]: {
    loadLevel: RenderedRouteProperties["loadLevel"];
  };
}

interface MapViewProps {
  routes: RouteCollection;
  forecastByRoute: ForecastByRoute;
  selectedRouteId: number | null;
  onSelectRoute: (routeId: number) => void;
}

const MIN_MAP_ZOOM = 8;

const MOSCOW_CENTER = {
  longitude: 37.62,
  latitude: 55.75,
  zoom: 10.5,
};

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

const ROUTE_OUTLINE_LAYER: LayerProps = {
  id: "routes-outline",
  type: "line",
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": "#111111",
    "line-width": ["case", ["==", ["get", "isSelected"], true], 3.2, 3.2],
    "line-opacity": 0.95,
  },
};

const ROUTE_LINE_LAYER: LayerProps = {
  id: "routes-line",
  type: "line",
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": [
      "match",
      ["coalesce", ["get", "loadLevel"], "NONE"],
      "LOW", LOAD_COLORS.LOW,
      "MEDIUM", LOAD_COLORS.MEDIUM,
      "HIGH", LOAD_COLORS.HIGH,
      "CRITICAL", LOAD_COLORS.CRITICAL,
      NEUTRAL_ROUTE_COLOR,
    ],
    "line-width": ["case", ["==", ["get", "isSelected"], true], 2.1, 2.1],
    "line-opacity": 1,
  },
};

const ROUTE_HIT_LAYER: LayerProps = {
  id: "routes-hit-area",
  type: "line",
  paint: {
    "line-color": "#000000",
    "line-width": 20,
    "line-opacity": 0,
  },
};

const STOP_LAYER: LayerProps = {
  id: "route-stops",
  type: "circle",
  paint: {
    "circle-radius": 4.5,
    "circle-color": "#ffffff",
    "circle-stroke-color": "#111111",
    "circle-stroke-width": 1.2,
    "circle-opacity": 1,
  },
};

function getRouteBounds(coordinates: Array<[number, number]>) {
  if (coordinates.length === 0) return null;

  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ] as [[number, number], [number, number]];
}

export function MapView({ routes, forecastByRoute, selectedRouteId, onSelectRoute }: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [routedRoutes, setRoutedRoutes] = useState<RouteCollection>(routes);
  const [osmRoutes, setOsmRoutes] = useState<Map<number, import("../data/osmTramRoutes").OsmTramRouteData>>(new globalThis.Map());
  const [hoveredStop, setHoveredStop] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredStopIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRealTramRoutes = async () => {
      try {
        const loaded = await loadOsmTramRoutes();
        if (cancelled) return;
        setOsmRoutes(new globalThis.Map(loaded));
        setRoutedRoutes(applyOsmRoutes(routes, loaded));
      } catch {
        if (!cancelled) {
          setOsmRoutes(new globalThis.Map());
          setRoutedRoutes(routes);
        }
      }
    };

    void loadRealTramRoutes();

    return () => {
      cancelled = true;
    };
  }, [routes]);

  const geoJson = useMemo(() => {
    if (selectedRouteId === null) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const selectedFeature = routedRoutes.features.find(
      (feature) => feature.properties.id === selectedRouteId,
    );
    if (!selectedFeature) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const forecast = forecastByRoute[selectedRouteId];
    const properties: RenderedRouteProperties & { isSelected: boolean } = {
      ...selectedFeature.properties,
      loadLevel: forecast?.loadLevel ?? null,
      isSelected: true,
    };

    return {
      type: "FeatureCollection" as const,
      features: [{ ...selectedFeature, properties }],
    };
  }, [routedRoutes, forecastByRoute, selectedRouteId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedRouteId === null) return;

    const selectedFeature = routedRoutes.features.find(
      (feature) => feature.properties.id === selectedRouteId,
    );
    if (!selectedFeature) return;

    const bounds = getRouteBounds(
      selectedFeature.geometry.coordinates as Array<[number, number]>,
    );
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: 35,
      duration: 900,
    });
  }, [routedRoutes, selectedRouteId]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = feature?.properties?.id;
      const routeId = Number(id);

      if (Number.isFinite(routeId)) {
        onSelectRoute(routeId);
      }
    },
    [onSelectRoute],
  );

  const stopsGeoJson = useMemo(() => {
    if (selectedRouteId === null) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const stops = getOsmStops(selectedRouteId, osmRoutes);
    const features = stops.map((stop, index) => ({
      type: "Feature" as const,
      properties: { stopId: `${selectedRouteId}-${index}`, name: stop.name },
      geometry: { type: "Point" as const, coordinates: stop.coordinates },
    }));

    return { type: "FeatureCollection" as const, features };
  }, [osmRoutes, selectedRouteId]);

  const clearStopHover = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    hoveredStopIdRef.current = null;
    setHoveredStop(null);
  }, []);

  const handleMapMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const stopFeature = event.features?.find((feature) => feature.layer?.id === "route-stops");
    if (!stopFeature) {
      clearStopHover();
      return;
    }

    const stopId = String(stopFeature.properties?.stopId ?? "");
    if (!stopId || stopId === hoveredStopIdRef.current) return;

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }
    hoveredStopIdRef.current = stopId;
    setHoveredStop(null);

    if (stopFeature.geometry?.type !== "Point") {
      clearStopHover();
      return;
    }

    const coordinates = stopFeature.geometry.coordinates as [number, number];
    const name = String(stopFeature.properties?.name ?? "");
    stopTimerRef.current = setTimeout(() => {
      setHoveredStop({ name, coordinates });
      stopTimerRef.current = null;
    }, 1500);
  }, [clearStopHover]);

  useEffect(() => clearStopHover, [clearStopHover, selectedRouteId]);

  return (
    <MapLibreMap
      ref={mapRef}
      initialViewState={MOSCOW_CENTER}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={true}
      renderWorldCopies={false}
      minZoom={MIN_MAP_ZOOM}

      interactiveLayerIds={["routes-hit-area", "route-stops"]}
      onClick={handleClick}
      onMouseMove={handleMapMouseMove}
      onMouseEnter={(e) => {
        e.target.getCanvas().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        e.target.getCanvas().style.cursor = "";
        clearStopHover();
      }}
    >
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-left" />
      <Source id="routes" type="geojson" data={geoJson}>
        <Layer {...ROUTE_OUTLINE_LAYER} />
        <Layer {...ROUTE_LINE_LAYER} />
        <Layer {...ROUTE_HIT_LAYER} />
      </Source>
      <Source id="route-stops-source" type="geojson" data={stopsGeoJson}>
        <Layer {...STOP_LAYER} />
      </Source>
      {hoveredStop && (
        <Popup
          longitude={hoveredStop.coordinates[0]}
          latitude={hoveredStop.coordinates[1]}
          closeButton={false}
          closeOnClick={false}
          offset={8}
          className="route-stop-popup"
        >
          {hoveredStop.name}
        </Popup>
      )}
    </MapLibreMap>
  );
}
