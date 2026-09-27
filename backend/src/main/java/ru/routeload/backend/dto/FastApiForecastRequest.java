package ru.routeload.backend.dto;

import java.time.LocalDateTime;

public record FastApiForecastRequest(
        int ngpt_route,
        LocalDateTime start_datetime,
        LocalDateTime end_datetime
) {
    public static FastApiForecastRequest from(int routeId, RouteForecastRequest request) {
        return new FastApiForecastRequest(
                routeId,
                request.startDate(),
                request.endDate()
        );
    }
}
