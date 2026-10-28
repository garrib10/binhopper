"""Password hashing (Argon2id) and random tokens for sessions and emailed links."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2-cffi's defaults: Argon2id with RFC 9106's low-memory profile (t=3, 64 MiB).
hasher = PasswordHasher()
# Checked for unknown emails so a wrong address takes as long as a wrong password.
DUMMY_HASH = hasher.hash("binhopper-no-such-account")

MIN_LENGTH, MAX_LENGTH = 10, 128


def password_problem(password: str, email: str) -> str | None:
    """Why a new password isn't allowed, or None. Length only, as NIST 800-63B advises."""
    if len(password) < MIN_LENGTH:
        return f"Use at least {MIN_LENGTH} characters"
    if len(password) > MAX_LENGTH:
        return f"Use at most {MAX_LENGTH} characters"
    if password.strip().lower() == email:
        return "Your password can't be your email address"
    return None


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return hasher.verify(password_hash or DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return hasher.check_needs_rehash(password_hash)


def new_token() -> str:
    """32 random bytes, URL-safe: session cookies, emailed links and OAuth state."""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """What the database stores instead of the token itself."""
    return hashlib.sha256(token.encode()).hexdigest()
