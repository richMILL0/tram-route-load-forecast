package ru.routeload.backend.client;

import ru.routeload.backend.dto.FastApiForecastRequest;
import ru.routeload.backend.dto.RouteForecastRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Component
public class FastApiClient {

    private final WebClient webClient;

    public FastApiClient(WebClient fastApiWebClient) {
        this.webClient = fastApiWebClient;
    }

    public Mono<String> requestForecast(int routeId, RouteForecastRequest request) {
        FastApiForecastRequest payload = FastApiForecastRequest.from(routeId, request);
        return webClient.post()
                .uri("/predict/forecast")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class);
    }
}
