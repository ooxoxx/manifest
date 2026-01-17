"""Encryption utilities for sensitive data like MinIO credentials."""

import base64
import secrets

from cryptography.fernet import Fernet

from app.core.config import settings


def get_encryption_key() -> bytes:
    """Get or generate encryption key."""
    if settings.ENCRYPTION_KEY:
        # Ensure key is properly formatted for Fernet
        key = settings.ENCRYPTION_KEY.encode()
        # If it's not a valid Fernet key, derive one
        if len(key) != 44:
            # Use the key as a seed to generate a valid Fernet key
            key = base64.urlsafe_b64encode(key[:32].ljust(32, b"0"))
        return key
    # Generate a new key if not configured (for development)
    return Fernet.generate_key()


def generate_encryption_key() -> str:
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode()


def encrypt_value(value: str) -> str:
    """Encrypt a string value."""
    if not value:
        return value
    f = Fernet(get_encryption_key())
    return f.encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt an encrypted string value."""
    if not encrypted_value:
        return encrypted_value
    f = Fernet(get_encryption_key())
    return f.decrypt(encrypted_value.encode()).decode()
