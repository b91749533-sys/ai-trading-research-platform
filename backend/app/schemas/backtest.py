import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.backtest import BacktestStatus, TradeSide


class BacktestCreate(BaseModel):
    strategy_id: uuid.UUID
    start_date: datetime
    end_date: datetime
    initial_balance: float = Field(..., gt=0)


class BacktestOut(BaseModel):
    id: uuid.UUID
    strategy_id: uuid.UUID
    status: BacktestStatus
    start_date: datetime
    end_date: datetime
    initial_balance: float
    end_balance: Optional[float] = None
    
    total_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    sortino_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    win_rate: Optional[float] = None
    
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TradeOut(BaseModel):
    id: uuid.UUID
    backtest_id: uuid.UUID
    symbol: str
    side: TradeSide
    quantity: float
    price: float
    commission: float
    executed_at: datetime

    class Config:
        from_attributes = True
