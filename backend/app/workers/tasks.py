import asyncio
from datetime import datetime, timedelta, timezone
import json
import random
import uuid
import redis
from celery.utils.log import get_task_logger

from app.workers.worker import celery_app
from app.core.config import settings
from app.core.database import async_session_maker
from app.models.backtest import Backtest, BacktestStatus, Trade, TradeSide
from app.models.strategy import Strategy

logger = get_task_logger(__name__)


def publish_progress(backtest_id: str, message_type: str, data: dict):
    """Utility to publish progress notifications to Redis Pub/Sub."""
    try:
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB
        )
        channel = f"backtest_progress:{backtest_id}"
        payload = {"type": message_type, "backtest_id": backtest_id, **data}
        r.publish(channel, json.dumps(payload))
    except Exception as e:
        logger.error(f"Failed to publish progress to Redis: {e}")


async def execute_backtest(backtest_id: str):
    """Asynchronous core execution of backtest logic."""
    async with async_session_maker() as session:
        # 1. Fetch backtest and strategy
        backtest_uuid = uuid.UUID(backtest_id)
        backtest = await session.get(Backtest, backtest_uuid)
        if not backtest:
            logger.error(f"Backtest {backtest_id} not found.")
            return
            
        strategy = await session.get(Strategy, backtest.strategy_id)
        if not strategy:
            backtest.status = BacktestStatus.FAILED
            backtest.error_message = "Strategy configuration not found"
            backtest.completed_at = datetime.now(timezone.utc)
            await session.commit()
            publish_progress(backtest_id, "failed", {"error": backtest.error_message})
            return
            
        # 2. Update status to RUNNING
        backtest.status = BacktestStatus.RUNNING
        await session.commit()
        publish_progress(backtest_id, "progress", {"percent": 0.0, "message": "Backtest initialization started"})
        
        try:
            # Simulate backtest loading historical data and processing
            total_steps = 5
            symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
            simulated_trades = []
            
            start_date = backtest.start_date
            end_date = backtest.end_date
            total_days = (end_date - start_date).days
            if total_days <= 0:
                total_days = 30
                
            for step in range(1, total_steps + 1):
                await asyncio.sleep(1.0) # Simulate computation delay
                percent = (step / total_steps) * 100.0
                
                # Simulate generating some trades along the timeline
                step_date = start_date + timedelta(days=int((step / total_steps) * total_days))
                
                # Random trade simulation
                if random.random() > 0.3:
                    symbol = random.choice(symbols)
                    side = random.choice([TradeSide.BUY, TradeSide.SELL])
                    qty = round(random.uniform(5, 50), 2)
                    price = round(random.uniform(100, 500), 2)
                    commission = round(qty * price * 0.0005, 4) # 0.05% commission
                    
                    trade = Trade(
                        backtest_id=backtest.id,
                        symbol=symbol,
                        side=side,
                        quantity=qty,
                        price=price,
                        commission=commission,
                        executed_at=step_date
                    )
                    session.add(trade)
                    simulated_trades.append(trade)
                    
                    publish_progress(
                        backtest_id, 
                        "progress", 
                        {
                            "percent": percent, 
                            "message": f"Step {step}/{total_steps}: Executed {side.value} {qty} {symbol} at ${price:.2f}"
                        }
                    )
                else:
                    publish_progress(
                        backtest_id, 
                        "progress", 
                        {"percent": percent, "message": f"Step {step}/{total_steps}: Scanning market data..."}
                    )
                    
            # 3. Calculate Performance Metrics
            # Mock calculations based on random walk
            total_return = round(random.uniform(-0.15, 0.45), 4) # -15% to +45% return
            final_balance = float(backtest.initial_balance) * (1.0 + total_return)
            
            backtest.end_balance = round(final_balance, 4)
            backtest.total_return = total_return
            backtest.sharpe_ratio = round(random.uniform(0.5, 3.2), 4)
            backtest.sortino_ratio = round(backtest.sharpe_ratio * random.uniform(1.1, 1.4), 4)
            backtest.max_drawdown = round(random.uniform(0.02, 0.25), 4)
            backtest.win_rate = round(random.uniform(0.42, 0.68), 4)
            
            backtest.status = BacktestStatus.COMPLETED
            backtest.completed_at = datetime.now(timezone.utc)
            
            await session.commit()
            
            publish_progress(
                backtest_id, 
                "complete", 
                {
                    "status": "COMPLETED",
                    "total_return": float(backtest.total_return),
                    "sharpe_ratio": float(backtest.sharpe_ratio),
                    "max_drawdown": float(backtest.max_drawdown),
                    "end_balance": float(backtest.end_balance)
                }
            )
            
        except Exception as e:
            logger.error(f"Error running backtest: {e}")
            backtest.status = BacktestStatus.FAILED
            backtest.error_message = str(e)
            backtest.completed_at = datetime.now(timezone.utc)
            await session.commit()
            publish_progress(backtest_id, "failed", {"error": str(e)})


@celery_app.task(name="app.workers.tasks.run_backtest_task")
def run_backtest_task(backtest_id: str):
    """Celery task entry point."""
    logger.info(f"Starting Celery backtesting worker for ID: {backtest_id}")
    asyncio.run(execute_backtest(backtest_id))
