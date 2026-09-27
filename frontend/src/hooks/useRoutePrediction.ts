import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchRouteForecast, fetchRoutes } from "../api/client";

export function useRoutesQuery() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: fetchRoutes,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useForecastMutation() {
  return useMutation({
    mutationFn: ({ routeId, startDate, endDate }: { routeId: number; startDate: string; endDate: string }) =>
      fetchRouteForecast(routeId, startDate, endDate),
  });
}
