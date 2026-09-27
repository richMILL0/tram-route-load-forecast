package ru.routeload.backend.service;

import ru.routeload.backend.client.FastApiClient;
import ru.routeload.backend.dto.RouteForecastRequest;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class PredictionService {

    private final FastApiClient fastApiClient;

    public PredictionService(FastApiClient fastApiClient) {
        this.fastApiClient = fastApiClient;
    }

    public Mono<String> requestForecast(int routeId, RouteForecastRequest request) {
        return fastApiClient.requestForecast(routeId, request);
    }
}
