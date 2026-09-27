import { z } from "zod";

export const LOAD_LEVEL_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const LoadLevelSchema = z.enum(LOAD_LEVEL_VALUES);
export type LoadLevel = z.infer<typeof LoadLevelSchema>;

export const RouteForecastResponseSchema = z.object({
  routeId: z.number().int().positive(),
  startDate: z.string().datetime({ local: true }),
  endDate: z.string().datetime({ local: true }),
  boardings: z.number().nonnegative(),
  boardingsPerHour: z.number().nonnegative(),
  loadLevel: LoadLevelSchema,
  generatedAt: z.string().optional(),
});
export type RouteForecastResponse = z.infer<typeof RouteForecastResponseSchema>;

export const RouteFeaturePropertiesSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});
export type RouteFeatureProperties = z.infer<typeof RouteFeaturePropertiesSchema>;

const LngLatSchema = z.tuple([z.number(), z.number()]);

export const RouteGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(LngLatSchema).min(2),
});
export type RouteGeometry = z.infer<typeof RouteGeometrySchema>;

export const RouteFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: RouteGeometrySchema,
  properties: RouteFeaturePropertiesSchema,
});
export type RouteFeature = z.infer<typeof RouteFeatureSchema>;

export const RouteCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(RouteFeatureSchema).min(1),
});
export type RouteCollection = z.infer<typeof RouteCollectionSchema>;

export interface RenderedRouteProperties extends RouteFeatureProperties {
  loadLevel: LoadLevel | null;
}
