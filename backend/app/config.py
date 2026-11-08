from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "WattWise Utility Intelligence API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Secure CORS configuration: matches localhost, local emulator, and LAN IPs
    CORS_ORIGIN_REGEX: str = r"^https?://(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)(:\d+)?$"
    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:8000",
        "http://localhost:3000",
        "http://10.0.2.2:8000",
    ]
    
    # Upload constraints (Security & DoS protection)
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_MIMES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "application/pdf",
    ]

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 120

    # Database: SQLite (Local Offline Storage) & Supabase (Cloud Online Sync)
    SQLITE_DB_PATH: str = "data/wattwise.db"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    AUTO_CLOUD_SYNC: bool = True
    
    # Optional Gemini / OpenAI API key
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
