import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies enterprise security headers to every response to mitigate
    XSS, clickjacking, MIME-sniffing, and cross-origin attacks.
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding window rate limiter per client IP.
    Protects against DoS, brute force, and prompt spam without requiring Redis.
    """
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # client_ip -> list of timestamps
        self.requests_map: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Exclude OpenAPI documentation and root from strict throttling
        path = request.url.path
        if path in ["/docs", "/openapi.json", "/redoc", "/favicon.ico"]:
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old timestamps
        history = [ts for ts in self.requests_map[client_ip] if ts > window_start]
        self.requests_map[client_ip] = history

        if len(history) >= self.max_requests:
            retry_after = int(history[0] + self.window_seconds - now) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "detail": "Rate limit exceeded. Please throttle your requests.",
                    "retryAfterSeconds": max(1, retry_after),
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self.requests_map[client_ip].append(now)
        return await call_next(request)


class ProcessTimeMiddleware(BaseHTTPMiddleware):
    """
    Measures and appends processing latency in milliseconds to response headers.
    Enables frontend latency tracking and performance observability.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response: Response = await call_next(request)
        process_time_ms = (time.perf_counter() - start_time) * 1000.0
        response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"
        return response

