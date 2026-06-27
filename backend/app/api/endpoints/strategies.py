from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.auth import User
from app.models.strategy import Strategy
from app.schemas.strategy import StrategyCreate, StrategyOut, StrategyUpdate

router = APIRouter()


@router.get("/", response_model=List[StrategyOut])
async def read_strategies(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    result = await db.execute(
        select(Strategy)
        .where(Strategy.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    strategies = result.scalars().all()
    return strategies


@router.post("/", response_model=StrategyOut, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    strategy_in: StrategyCreate
) -> Any:
    strategy = Strategy(
        user_id=current_user.id,
        name=strategy_in.name,
        description=strategy_in.description,
        code_content=strategy_in.code_content,
        parameters=strategy_in.parameters
    )
    db.add(strategy)
    await db.flush()
    return strategy


@router.get("/{id}", response_model=StrategyOut)
async def read_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    id: uuid.UUID
) -> Any:
    result = await db.execute(
        select(Strategy)
        .where(Strategy.id == id, Strategy.user_id == current_user.id)
    )
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found"
        )
    return strategy


@router.put("/{id}", response_model=StrategyOut)
async def update_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    id: uuid.UUID,
    strategy_in: StrategyUpdate
) -> Any:
    result = await db.execute(
        select(Strategy)
        .where(Strategy.id == id, Strategy.user_id == current_user.id)
    )
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found"
        )
        
    update_data = strategy_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(strategy, field, value)
        
    db.add(strategy)
    await db.flush()
    return strategy


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    id: uuid.UUID
) -> Any:
    result = await db.execute(
        select(Strategy)
        .where(Strategy.id == id, Strategy.user_id == current_user.id)
    )
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found"
        )
        
    await db.delete(strategy)
    return None
