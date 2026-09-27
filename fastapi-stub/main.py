from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator

from model_inference import ROUTES, predict_route_load

ALLOWED_NGPT_ROUTES = set(ROUTES)
MOSCOW = ZoneInfo("Europe/Moscow")
MIN_DATE = date(2025, 1, 1)
MAX_DATE = date(2026, 12, 31)

app = FastAPI(title="Route Load ML Inference", version="1.0.0")

class ForecastRequest(BaseModel):
    ngpt_route: int
    start_datetime: datetime
    end_datetime: datetime

    @model_validator(mode="after")
    def validate_range(self):
        if self.ngpt_route not in ALLOWED_NGPT_ROUTES:
            raise ValueError(
                "ngpt_route must be one of: "
                + ", ".join(map(str, sorted(ALLOWED_NGPT_ROUTES)))
            )

        start = self.start_datetime
        end = self.end_datetime
        if end < start:
            raise ValueError("end_datetime must not be earlier than start_datetime")

        if not (MIN_DATE <= start.date() <= MAX_DATE):
            raise ValueError("start_datetime must be between 2025-01-01 and 2026-12-31")
        if not (MIN_DATE <= end.date() <= MAX_DATE):
            raise ValueError("end_datetime must be between 2025-01-01 and 2026-12-31")

        max_end = start + _one_calendar_month(start)
        if end > max_end:
            raise ValueError(
                "end_datetime must be between start_datetime and start_datetime + one calendar month"
            )
        return self

def _one_calendar_month(value: datetime) -> timedelta:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    import calendar
    day = min(value.day, calendar.monthrange(year, month)[1])
    return datetime(year, month, day, value.hour, value.minute, value.second, value.microsecond) - value

def _naive_moscow(dt: datetime) -> str:
    local = dt.astimezone(MOSCOW) if dt.tzinfo else dt
    return local.replace(tzinfo=None).isoformat(timespec="seconds")

LOW_MAX_PER_HOUR = 201.0
MEDIUM_MAX_PER_HOUR = 677.0
HIGH_MAX_PER_HOUR = 1468.0

def _load_level(boardings_per_hour: float) -> str:
    if boardings_per_hour <= LOW_MAX_PER_HOUR:
        return "LOW"
    if boardings_per_hour <= MEDIUM_MAX_PER_HOUR:
        return "MEDIUM"
    if boardings_per_hour <= HIGH_MAX_PER_HOUR:
        return "HIGH"
    return "CRITICAL"

@app.get("/health")
def health():
    return {"status": "ok", "models": 10, "routes": sorted(ALLOWED_NGPT_ROUTES)}

@app.post("/predict/forecast")
def predict(request: ForecastRequest):
    try:
        boardings = predict_route_load(
            request.start_datetime,
            request.end_datetime,
            request.ngpt_route,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="ML inference failed") from exc

    duration_hours = (request.end_datetime - request.start_datetime).total_seconds() / 3600.0
    duration_hours = max(duration_hours, 1.0)
    boardings_per_hour = boardings / duration_hours

    return {
        "routeId": request.ngpt_route,
        "startDate": _naive_moscow(request.start_datetime),
        "endDate": _naive_moscow(request.end_datetime),
        "boardings": boardings,
        "boardingsPerHour": boardings_per_hour,
        "loadLevel": _load_level(boardings_per_hour),
        "generatedAt": datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds"),
    }
