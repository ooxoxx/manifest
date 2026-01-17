from fastapi import APIRouter

from app.api.routes import (
    dashboard,
    datasets,
    login,
    minio_instances,
    private,
    samples,
    tags,
    users,
    utils,
    watched_paths,
    webhooks,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(dashboard.router)
api_router.include_router(minio_instances.router)
api_router.include_router(samples.router)
api_router.include_router(tags.router)
api_router.include_router(datasets.router)
api_router.include_router(watched_paths.router)
api_router.include_router(webhooks.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
