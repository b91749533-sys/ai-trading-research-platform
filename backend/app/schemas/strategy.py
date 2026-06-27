import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class StrategyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    code_content: str = Field(..., min_length=1)
    parameters: Dict[str, Any] = Field(default_factory=dict)


class StrategyCreate(StrategyBase):
    pass


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    code_content: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class StrategyOut(StrategyBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
