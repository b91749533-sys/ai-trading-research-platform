from typing import Any, List
import uuid
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import redis.asyncio as aioredis

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import User
from app.models.strategy import Strategy
from app.models.backtest import Backtest, Trade
from app.schemas.backtest import BacktestCreate, BacktestOut, TradeOut

router = APIRouter()


@router.post("/", response_model=BacktestOut, status_code=status.HTTP_202_ACCEPTED)
async def create_backtest(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    backtest_in: BacktestCreate
) -> Any:
    # Verify the strategy belongs to the current user
    strategy_result = await db.execute(
        select(Strategy).where(
            Strategy.id == backtest_in.strategy_id,
            Strategy.user_id == current_user.id
        )
    )
    strategy = strategy_result.scalars().first()
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found"
        )
        
    # Create Backtest record
    backtest = Backtest(
        strategy_id=backtest_in.strategy_id,
        start_date=backtest_in.start_date,
        end_date=backtest_in.end_date,
        initial_balance=backtest_in.initial_balance,
        status="PENDING"
    )
    db.add(backtest)
    await db.flush()
    
    # Trigger Async Celery Task
    # Imported dynamically to avoid circular dependencies
    from app.workers.tasks import run_backtest_task
    run_backtest_task.delay(str(backtest.id))
    
    return backtest


@router.get("/{id}", response_model=BacktestOut)
async def read_backtest(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    id: uuid.UUID
) -> Any:
    result = await db.execute(
        select(Backtest)
        .join(Strategy)
        .where(Backtest.id == id, Strategy.user_id == current_user.id)
    )
    backtest = result.scalars().first()
    if not backtest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backtest not found"
        )
    return backtest


@router.get("/{id}/trades", response_model=List[TradeOut])
async def read_backtest_trades(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    id: uuid.UUID,
    skip: int = 0,
    limit: int = 100
) -> Any:
    # Verify backtest belongs to user's strategy
    result = await db.execute(
        select(Backtest)
        .join(Strategy)
        .where(Backtest.id == id, Strategy.user_id == current_user.id)
    )
    backtest = result.scalars().first()
    if not backtest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backtest not found"
        )
        
    trades_result = await db.execute(
        select(Trade)
        .where(Trade.backtest_id == id)
        .order_by(Trade.executed_at.asc())
        .offset(skip)
        .limit(limit)
    )
    trades = trades_result.scalars().all()
    return trades


@router.websocket("/ws/{backtest_id}")
async def websocket_backtest_status(
    websocket: WebSocket,
    backtest_id: str
):
    await websocket.accept()
    
    # We authenticate the websocket connection
    # Note: For production, token can be passed as query parameter
    # e.g., ws://.../ws/123?token=ACCESS_TOKEN
    token = websocket.query_params.get("token")
    if not token:
        # fallback to receive first message for auth
        try:
            auth_msg = await websocket.receive_text()
            data = json.loads(auth_msg)
            token = data.get("token")
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    # Subscribe to Redis PubSub channel for this backtest ID
    redis_client = aioredis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}")
    pubsub = redis_client.pubsub()
    channel_name = f"backtest_progress:{backtest_id}"
    await pubsub.subscribe(channel_name)
    
    try:
        while True:
            # We listen to Redis PubSub channel and forward to WebSocket
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                data = message["data"].decode("utf-8")
                await websocket.send_text(data)
                
                # If backtest is finished, break connection
                parsed_data = json.loads(data)
                if parsed_data.get("type") in ["complete", "failed"]:
                    break
                    
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel_name)
        await pubsub.close()
        await redis_client.close()
