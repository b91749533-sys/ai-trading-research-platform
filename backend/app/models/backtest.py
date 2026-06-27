import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BacktestStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TradeSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class Backtest(Base):
    __tablename__ = "backtests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    strategy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("strategies.id", on_delete="CASCADE"),
        nullable=False,
        index=True
    )
    status: Mapped[BacktestStatus] = mapped_column(
        Enum(BacktestStatus),
        default=BacktestStatus.PENDING,
        nullable=False
    )
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    initial_balance: Mapped[float] = mapped_column(
        Numeric(15, 4),
        nullable=False
    )
    end_balance: Mapped[float] = mapped_column(
        Numeric(15, 4),
        nullable=True
    )

    # Calculated metrics
    total_return: Mapped[float] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    sharpe_ratio: Mapped[float] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    sortino_ratio: Mapped[float] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    max_drawdown: Mapped[float] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    win_rate: Mapped[float] = mapped_column(
        Numeric(6, 4),
        nullable=True
    )

    error_message: Mapped[str] = mapped_column(
        Text,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    strategy = relationship("Strategy", back_populates="backtests")
    trades = relationship("Trade", back_populates="backtest", cascade="all, delete-orphan")


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    backtest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("backtests.id", on_delete="CASCADE"),
        nullable=False,
        index=True
    )
    symbol: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    side: Mapped[TradeSide] = mapped_column(
        Enum(TradeSide),
        nullable=False
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 6),
        nullable=False
    )
    price: Mapped[float] = mapped_column(
        Numeric(15, 4),
        nullable=False
    )
    commission: Mapped[float] = mapped_column(
        Numeric(10, 4),
        default=0.0000,
        nullable=False
    )
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    # Relationships
    backtest = relationship("Backtest", back_populates="trades")
