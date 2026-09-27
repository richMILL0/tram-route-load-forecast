import {
  RouteCollectionSchema,
  RouteForecastResponseSchema,
  type RouteCollection,
  type RouteForecastResponse,
} from "../types/route";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  parse: (data: unknown) => T
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (cause) {
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение.", undefined);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`Бэкенд вернул ошибку ${res.status} на ${path}: ${body || res.statusText}`, res.status);
  }

  const json = await res.json();
  const parsed = parse(json);
  return parsed;
}

export function fetchRoutes(): Promise<RouteCollection> {
  return request("/routes", { method: "GET" }, (data) => RouteCollectionSchema.parse(data));
}

export function fetchRouteForecast(routeId: number, startDate: string, endDate: string): Promise<RouteForecastResponse> {
  return request(
    `/routes/${routeId}/forecast`,
    { method: "POST", body: JSON.stringify({ startDate, endDate }) },
    (data) => RouteForecastResponseSchema.parse(data)
  );
}

