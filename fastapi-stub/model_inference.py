from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
import json
import os
import tempfile
from typing import Iterable

import holidays
import numpy as np
import pandas as pd
import requests
from catboost import CatBoostRegressor
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
CACHE_DIR = BASE_DIR / "weather_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ROUTES = [1, 5, 7, 11, 12, 17, 25, 26, 28, 50]
MOSCOW_TZ = ZoneInfo("Europe/Moscow")
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MOSCOW_LATITUDE = 55.75
MOSCOW_LONGITUDE = 37.62
WEATHER_FORECAST_HORIZON_DAYS = 14

FEATURES = [
    "route", "hour", "dayofweek", "is_weekend", "is_holiday",
    "lag_mean", "lag_median", "lag_std", "lag_count",
    "lag_mean_coarse", "lag_median_coarse",
    "temperature_2m_mean", "precipitation_sum",
]

ENSEMBLE_SEEDS = [42, 123, 456, 789, 2024, 111, 222, 333, 444, 555]

_lag_features = pd.read_csv(MODEL_DIR / "lag_features_final.csv", sep=";")
_lag_coarse = pd.read_csv(MODEL_DIR / "lag_features_coarse_final.csv", sep=";")
_weather_2025 = pd.read_csv(MODEL_DIR / "weather_2025.csv", sep=";")
_weather_2025["date"] = pd.to_datetime(_weather_2025["date"]).dt.date
_weather_2025 = _weather_2025[["date", "temperature_2m_mean", "precipitation_sum"]]

_ru_holidays = holidays.Russia(years=[2025, 2026])

_models: list[CatBoostRegressor] = []
for index, seed in enumerate(ENSEMBLE_SEEDS, start=1):
    model = CatBoostRegressor()
    model.load_model(str(MODEL_DIR / f"model_ensemble_{index}_seed{seed}.cbm"))
    _models.append(model)

_http = requests.Session()
_http.headers.update({"User-Agent": "route-load-fastapi/1.0"})

def _current_moscow_date() -> date:
    return datetime.now(MOSCOW_TZ).date()

def _previous_year_same_date(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)

def _cache_path(value: date) -> Path:
    return CACHE_DIR / f"{value.isoformat()}.json"

def _read_cache(value: date) -> dict | None:
    path = _cache_path(value)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None

def _write_cache(value: date, payload: dict) -> None:
    path = _cache_path(value)
    try:
        fd, tmp_name = tempfile.mkstemp(prefix="weather-", suffix=".json", dir=CACHE_DIR)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
        os.replace(tmp_name, path)
    except OSError:
        try:
            Path(tmp_name).unlink(missing_ok=True)
        except (OSError, UnboundLocalError):
            pass

def _fetch_open_meteo(days: Iterable[date]) -> dict[date, dict[str, float]]:
    requested = sorted(set(days))
    if not requested:
        return {}

    start = requested[0]
    end = requested[-1]
    params = {
        "latitude": MOSCOW_LATITUDE,
        "longitude": MOSCOW_LONGITUDE,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "Europe/Moscow",
        "forecast_days": 16,
    }

    response = _http.get(OPEN_METEO_URL, params=params, timeout=12)
    response.raise_for_status()
    data = response.json()
    daily = data.get("daily") or {}
    dates = daily.get("time") or []
    temperatures = daily.get("temperature_2m_mean") or []
    precipitation = daily.get("precipitation_sum") or []

    result: dict[date, dict[str, float]] = {}
    for raw_date, temperature, rain in zip(dates, temperatures, precipitation):
        if temperature is None or rain is None:
            continue
        result[date.fromisoformat(raw_date)] = {
            "temperature_2m_mean": float(temperature),
            "precipitation_sum": float(rain),
        }
    return result

def _weather_for_dates(dates: Iterable[date]) -> pd.DataFrame:
    requested = sorted(set(dates))
    if not requested:
        return pd.DataFrame(columns=["date", "temperature_2m_mean", "precipitation_sum"])

    known_2025 = _weather_2025.set_index("date").to_dict("index")
    rows: dict[date, dict[str, float]] = {}
    need_forecast: list[date] = []
    need_previous_year: list[date] = []
    today = _current_moscow_date()
    forecast_limit = today + timedelta(days=WEATHER_FORECAST_HORIZON_DAYS)

    for value in requested:
        if value.year == 2025 and value in known_2025:
            rows[value] = known_2025[value]
            continue

        if value.year == 2026 and today < value <= forecast_limit:
            cached = _read_cache(value)
            if cached and "temperature_2m_mean" in cached and "precipitation_sum" in cached:
                rows[value] = cached
            else:
                need_forecast.append(value)
        else:
            need_previous_year.append(value)

    if need_forecast:
        try:
            fetched = _fetch_open_meteo(need_forecast)
            for value in need_forecast:
                weather = fetched.get(value)
                if weather is None:
                    need_previous_year.append(value)
                    continue
                rows[value] = weather
                _write_cache(value, weather)
        except (requests.RequestException, ValueError, KeyError, TypeError):
            need_previous_year.extend(need_forecast)

    for value in need_previous_year:
        source_date = _previous_year_same_date(value)
        source = known_2025.get(source_date)
        if source is None:
            raise RuntimeError(f"No weather data available for {value.isoformat()}")
        rows[value] = source

    return pd.DataFrame(
        [{"date": value, **rows[value]} for value in requested]
    )

def _build_grid(start: datetime, end: datetime) -> pd.DataFrame:
    first_hour = start.replace(minute=0, second=0, microsecond=0)
    last_hour = end.replace(minute=0, second=0, microsecond=0)
    hours = pd.date_range(first_hour, last_hour, freq="h")

    grid = pd.MultiIndex.from_product(
        [ROUTES, hours], names=["route", "datetime"]
    ).to_frame(index=False)
    grid["date"] = grid["datetime"].dt.date
    grid["hour"] = grid["datetime"].dt.hour
    grid["dayofweek"] = grid["datetime"].dt.dayofweek
    grid["is_weekend"] = grid["dayofweek"].isin([5, 6]).astype(int)
    grid["is_holiday"] = grid["date"].apply(lambda d: int(d in _ru_holidays))

    grid = grid.merge(
        _lag_features,
        on=["route", "dayofweek", "hour"],
        how="left",
        validate="many_to_one",
    )
    grid = grid.merge(
        _lag_coarse,
        on=["route", "hour"],
        how="left",
        validate="many_to_one",
    )
    grid = grid.merge(
        _weather_for_dates(grid["date"]),
        on="date",
        how="left",
        validate="many_to_one",
    )

    return grid

def predict_route_load(start: datetime, end: datetime, route: int) -> float:
    """Return total predicted boardings for one route and datetime range."""
    if route not in ROUTES:
        raise ValueError(f"Unsupported route: {route}")
    if end < start:
        raise ValueError("end_datetime must not be earlier than start_datetime")

    grid = _build_grid(start, end)
    route_grid = grid[grid["route"] == route].copy()
    predictions = np.mean(
        [model.predict(route_grid[FEATURES]) for model in _models],
        axis=0,
    )
    return float(np.clip(predictions, 0, None).sum())

def predict_route_hourly(start: datetime, end: datetime, route: int) -> pd.DataFrame:
    """Return the individual hourly predictions for diagnostics/tests."""
    if route not in ROUTES:
        raise ValueError(f"Unsupported route: {route}")
    grid = _build_grid(start, end)
    route_grid = grid[grid["route"] == route].copy()
    route_grid["prediction"] = np.clip(
        np.mean([model.predict(route_grid[FEATURES]) for model in _models], axis=0),
        0,
        None,
    )
    return route_grid[["datetime", "route", "prediction"]]
