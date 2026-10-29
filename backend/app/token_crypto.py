"""Encrypt third-party tokens at rest (SPEC.md › Privacy › Connected accounts).

TOKEN_ENCRYPTION_KEY is a Fernet key: python -c "from cryptography.fernet import Fernet;
print(Fernet.generate_key().decode())". It lives only in backend/.env and Railway.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class TokenKeyMissing(RuntimeError):
    pass


def _fernet() -> Fernet:
    if not settings.token_encryption_key:
        raise TokenKeyMissing("TOKEN_ENCRYPTION_KEY is not set")
    return Fernet(settings.token_encryption_key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str, max_age: int | None = None) -> str | None:
    """The plain value, or None if it was tampered with, made with another key, or too old."""
    try:
        return _fernet().decrypt(value.encode(), ttl=max_age).decode()
    except (InvalidToken, ValueError):
        return None
