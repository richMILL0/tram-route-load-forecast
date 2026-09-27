import type { RouteCollection } from "../types/route";
import { ROUTE_STOP_NAMES } from "./stops";

const ROUTE_IDS = [1, 5, 7, 11, 12, 17, 25, 26, 28, 50] as const;

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role: string;
  }>;
}

interface OsmData {
  elements: OsmElement[];
}

export interface OsmTramRouteData {
  geometry: Array<[number, number]>;
  stops: Array<{ name: string; coordinates: [number, number] }>;
}

const CACHE = new Map<number, OsmTramRouteData>();

function routeQuery() {
  const refs = ROUTE_IDS.join("|");
  return `[out:json][timeout:30];relation["type"="route"]["route"="tram"]["ref"~"^(${refs})$"](55.35,37.15,56.05,38.25);(._;>;);out body;`;
}

function distanceSquared(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function buildGeometry(
  relation: OsmElement,
  ways: Map<number, OsmElement>,
  nodes: Map<number, OsmElement>,
) {
  type WayPart = {
    nodeIds: number[];
    coords: Array<[number, number]>;
  };

  const parts: WayPart[] = [];

  for (const member of relation.members ?? []) {
    if (member.type !== "way") continue;
    const way = ways.get(member.ref);
    if (!way?.nodes || way.nodes.length < 2) continue;

    const coords = way.nodes
      .map((nodeId) => nodes.get(nodeId))
      .filter((node): node is OsmElement & { lon: number; lat: number } =>
        node?.type === "node" && typeof node.lon === "number" && typeof node.lat === "number",
      )
      .map((node) => [node.lon, node.lat] as [number, number]);

    if (coords.length >= 2) {
      parts.push({ nodeIds: way.nodes, coords });
    }
  }

  const remaining = parts.slice();
  const chains: Array<Array<[number, number]>> = [];

  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const chain = first.coords.slice();
    let startNode = first.nodeIds[0];
    let endNode = first.nodeIds[first.nodeIds.length - 1];

    let extended = true;
    while (extended) {
      extended = false;

      for (let i = 0; i < remaining.length; i += 1) {
        const part = remaining[i];
        const partStart = part.nodeIds[0];
        const partEnd = part.nodeIds[part.nodeIds.length - 1];

        if (partStart === endNode) {
          chain.push(...part.coords.slice(1));
          endNode = partEnd;
        } else if (partEnd === endNode) {
          chain.push(...part.coords.slice(0, -1).reverse());
          endNode = partStart;
        } else if (partEnd === startNode) {
          chain.unshift(...part.coords.slice(0, -1));
          startNode = partStart;
        } else if (partStart === startNode) {
          chain.unshift(...part.coords.slice(1).reverse());
          startNode = partEnd;
        } else {
          continue;
        }

        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }

    if (chain.length >= 2) chains.push(chain);
  }

  const chainLength = (chain: Array<[number, number]>) => {
    let length = 0;
    for (let i = 1; i < chain.length; i += 1) {
      length += Math.sqrt(distanceSquared(chain[i - 1], chain[i]));
    }
    return length;
  };

  chains.sort((a, b) => chainLength(b) - chainLength(a));
  return chains[0] ?? [];
}

function buildStops(
  relation: OsmElement,
  nodes: Map<number, OsmElement>,
  fallbackNames: string[],
) {
  const stops: Array<{ name: string; coordinates: [number, number] }> = [];

  for (const member of relation.members ?? []) {
    if (member.type !== "node" || !/^(stop|forward_stop|backward_stop)$/.test(member.role)) continue;
    const node = nodes.get(member.ref);
    if (!node || typeof node.lon !== "number" || typeof node.lat !== "number") continue;

    const name = node.tags?.name ?? "";
    stops.push({
      name,
      coordinates: [node.lon, node.lat],
    });
  }

  return stops.map((stop, index) => ({
    ...stop,
    name: stop.name || fallbackNames[index] || `Остановка ${index + 1}`,
  }));
}

function selectRelation(relations: OsmElement[], routeId: number) {
  const candidates = relations.filter(
    (relation) => relation.tags?.ref === String(routeId) && relation.tags?.route === "tram",
  );

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const aStops = (a.members ?? []).filter((member) => member.type === "node" && /^(stop|forward_stop|backward_stop)$/.test(member.role)).length;
    const bStops = (b.members ?? []).filter((member) => member.type === "node" && /^(stop|forward_stop|backward_stop)$/.test(member.role)).length;
    return bStops - aStops;
  })[0];
}

export async function loadOsmTramRoutes(): Promise<Map<number, OsmTramRouteData>> {
  const missing = ROUTE_IDS.filter((routeId) => !CACHE.has(routeId));
  if (missing.length === 0) return CACHE;

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(routeQuery())}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OSM Overpass: HTTP ${response.status}`);

  const data = (await response.json()) as OsmData;
  const nodes = new Map(data.elements.filter((element) => element.type === "node").map((element) => [element.id, element]));
  const ways = new Map(data.elements.filter((element) => element.type === "way").map((element) => [element.id, element]));
  const relations = data.elements.filter((element) => element.type === "relation");

  for (const routeId of missing) {
    const relation = selectRelation(relations, routeId);
    if (!relation) continue;

    const geometry = buildGeometry(relation, ways, nodes);
    const stops = buildStops(relation, nodes, ROUTE_STOP_NAMES[routeId] ?? []);

    if (geometry.length >= 2) {
      CACHE.set(routeId, { geometry, stops });
    }
  }

  return CACHE;
}

export function applyOsmRoutes(routes: RouteCollection, osmRoutes: Map<number, OsmTramRouteData>): RouteCollection {
  return {
    ...routes,
    features: routes.features.map((feature) => {
      const osm = osmRoutes.get(feature.properties.id);
      if (!osm) return feature;

      return {
        ...feature,
        geometry: {
          type: "LineString" as const,
          coordinates: osm.geometry,
        },
      };
    }),
  };
}

export function getOsmStops(routeId: number, osmRoutes: Map<number, OsmTramRouteData>) {
  return osmRoutes.get(routeId)?.stops ?? [];
}
