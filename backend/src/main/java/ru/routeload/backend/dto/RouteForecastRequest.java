package ru.routeload.backend.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record RouteForecastRequest(
        @NotNull LocalDateTime startDate,
        @NotNull LocalDateTime endDate
) {
    private static final LocalDate MIN_DATE = LocalDate.of(2025, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(2026, 12, 31);

    public boolean isRangeValid() {
        return !endDate.isBefore(startDate)
                && !startDate.toLocalDate().isBefore(MIN_DATE)
                && !startDate.toLocalDate().isAfter(MAX_DATE)
                && !endDate.toLocalDate().isBefore(MIN_DATE)
                && !endDate.toLocalDate().isAfter(MAX_DATE)
                && !endDate.isAfter(startDate.plusMonths(1));
    }

    public String validationError() {
        if (startDate.toLocalDate().isBefore(MIN_DATE) || endDate.toLocalDate().isBefore(MIN_DATE)
                || startDate.toLocalDate().isAfter(MAX_DATE) || endDate.toLocalDate().isAfter(MAX_DATE)) {
            return "Дата должна находиться в диапазоне с 01.01.2025 по 31.12.2026.";
        }
        if (endDate.isBefore(startDate)) {
            return "Дата окончания должна быть не раньше начальной.";
        }
        return "Дата окончания должна быть не позже чем через один календарный месяц.";
    }
}
