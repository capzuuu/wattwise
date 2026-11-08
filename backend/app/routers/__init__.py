from .health import router as health_router
from .bills import router as bills_router
from .chat import router as chat_router
from .appliances import router as appliances_router
from .notifications import router as notifications_router
from .profile import router as profile_router
from .database import router as database_router
from .auth import router as auth_router
from .onboarding import router as onboarding_router

__all__ = [
    "health_router",
    "bills_router",
    "chat_router",
    "appliances_router",
    "notifications_router",
    "profile_router",
    "database_router",
    "auth_router",
    "onboarding_router",
]

