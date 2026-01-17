"""Test configuration for service tests that don't need database."""

import pytest


# Override the db fixture from parent conftest to prevent database connection
@pytest.fixture(scope="session", autouse=True)
def db():
    """Dummy db fixture for service tests that don't need database."""
    yield None
