import type { RouteCollection, LoadLevel } from "../types/route";
import { LOAD_COLORS, NEUTRAL_ROUTE_COLOR } from "../theme/load";

interface RouteListProps {
  routes: RouteCollection;
  selectedRouteId: number | null;
  loadLevelByRoute: Record<number, LoadLevel | undefined>;
  onSelectRoute: (routeId: number) => void;
}

export function RouteList({ routes, selectedRouteId, loadLevelByRoute, onSelectRoute }: RouteListProps) {
  return (
    <ul className="route-list">
      {routes.features.map(({ properties }) => {
        const isSelected = properties.id === selectedRouteId;
        const loadLevel = loadLevelByRoute[properties.id];
        const dotColor = loadLevel ? LOAD_COLORS[loadLevel] : NEUTRAL_ROUTE_COLOR;
        return (
          <li key={properties.id}>
            <button
              type="button"
              className={isSelected ? "route-item route-item--selected" : "route-item"}
              onClick={() => onSelectRoute(properties.id)}
              aria-pressed={isSelected}
            >
              <span className="route-item__dot" style={{ backgroundColor: dotColor }} aria-hidden="true" />
              <span className="route-item__id">№{properties.id}</span>
              <span className="route-item__name">{properties.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
