import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field

from app.db.sqlite_manager import sqlite_db

logger = logging.getLogger("wattwise.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email address")
    password: str = Field(..., min_length=1, description="Account password")


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Full name")
    email: str = Field(..., min_length=3, description="User email address")
    password: str = Field(..., min_length=8, description="Account password (minimum 8 characters)")
    provider: Optional[str] = "Household Account"
    householdType: Optional[str] = "Residential Household"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    provider: str
    householdType: str
    avatarUrl: Optional[str] = None
    role: str
    createdAt: Optional[str] = None
    lastLoginAt: Optional[str] = None


class AuthResponse(BaseModel):
    ok: bool
    message: str
    user: UserResponse
    token: str


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """
    Authenticate a user directly against the SQLite database using
    PBKDF2-HMAC-SHA256 salted constant-time comparison and issue a stateful session.
    """
    result = sqlite_db.authenticate_user(req.email, req.password)
    if not result:
        logger.warning("Failed login attempt for email: %s", req.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user, token = result
    logger.info("User successfully logged in via SQLite: %s (%s)", user["name"], user["email"])
    return {
        "ok": True,
        "message": f"Welcome back, {user['name']}!",
        "user": user,
        "token": token,
    }


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    """
    Register a new household user into SQLite with automatic salt generation,
    cryptographic hashing, and active session creation.
    """
    try:
        user, token = sqlite_db.create_user(
            name=req.name,
            email=req.email,
            password=req.password,
            provider=req.provider or "Household Account",
            household_type=req.householdType or "Residential Household",
        )
        logger.info("New user registered in SQLite: %s (%s)", user["name"], user["email"])
        return {
            "ok": True,
            "message": "Account created successfully.",
            "user": user,
            "token": token,
        }
    except ValueError as e:
        status_code = status.HTTP_409_CONFLICT if "already exists" in str(e) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=str(e),
        )


@router.get("/me")
def get_me(authorization: Optional[str] = Header(None)):
    """
    Verify session token against user_sessions table in SQLite and return live user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    user = sqlite_db.get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again.",
        )

    return {
        "ok": True,
        "user": user,
    }


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """
    Revoke user session in SQLite.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        sqlite_db.revoke_session(token)
    return {"ok": True, "message": "Successfully logged out."}


@router.get("/users", response_model=List[UserResponse])
def list_users():
    """
    List all active users directly from SQLite (excludes password hashes for security).
    """
    return sqlite_db.get_all_users()
