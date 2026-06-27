from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup DB initialization
    async with async_engine.begin() as conn:
        # Create all tables (in production, use Alembic migrations instead)
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown logic if any (e.g. closing pools)
    await async_engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS Middleware Configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API. Access documentation at /docs."}
