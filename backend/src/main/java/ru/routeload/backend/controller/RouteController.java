package ru.routeload.backend.controller;

import ru.routeload.backend.dto.RouteCollection;
import ru.routeload.backend.dto.RouteForecastRequest;
import ru.routeload.backend.service.PredictionService;
import ru.routeload.backend.service.RouteService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/routes")
public class RouteController {

    private final RouteService routeService;
    private final PredictionService predictionService;

    public RouteController(RouteService routeService, PredictionService predictionService) {
        this.routeService = routeService;
        this.predictionService = predictionService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<RouteCollection> getRoutes() {
        return routeService.getRoutes();
    }

    @PostMapping(
            value = "/{routeId}/forecast",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )

    public Mono<ResponseEntity<String>> forecast(
            @PathVariable int routeId,
            @Valid @RequestBody RouteForecastRequest request
    ) {
        if (!routeService.containsRoute(routeId)) {
            return Mono.just(ResponseEntity.notFound().build());
        }
        if (!request.isRangeValid()) {
            return Mono.just(ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"" + request.validationError() + "\"}"));
        }

        return predictionService.requestForecast(routeId, request)
            .map(body -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                    .body(body));
    }
}
