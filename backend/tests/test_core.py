import pytest
from datetime import timedelta
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.schemas.auth import UserCreate


def test_password_hashing():
    password = "SuperSecurePassword123!"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_jwt_tokens():
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    
    # Access Token
    token = create_access_token(subject=user_id)
    decoded = decode_token(token)
    assert decoded["sub"] == user_id
    assert decoded["type"] == "access"
    
    # Invalid token decodes as empty dict
    assert decode_token("invalid_token_string") == {}


def test_schemas_validation():
    # Valid registration schema
    user_in = UserCreate(
        email="test@example.com",
        password="securepass123",
        first_name="Jane",
        last_name="Doe"
      )
    assert user_in.email == "test@example.com"
    assert user_in.first_name == "Jane"
    
    # Invalid email structure raises validation error
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        UserCreate(
            email="invalid-email-address",
            password="123",
        )
