package ru.routeload.backend.dto;

import java.util.List;

public record RouteFeature(
        String type,
        RouteGeometry geometry,
        RouteProperties properties
) {
    public record RouteGeometry(
            String type,
            List<List<Double>> coordinates
    ) {}

    public record RouteProperties(
            int id,
            String name
    ) {}
}
