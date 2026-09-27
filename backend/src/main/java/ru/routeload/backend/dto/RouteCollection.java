package ru.routeload.backend.dto;

import java.util.List;

public record RouteCollection(
        String type,
        List<RouteFeature> features
) {
}
