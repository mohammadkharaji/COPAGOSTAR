"""Agent memory store (SQLite via SQLAlchemy 2): rules/insights the agent recalls before querying data."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, Integer, String, Text, create_engine, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from ..config import DATA_DIR


class Base(DeclarativeBase):
    pass


class AgentInsight(Base):
    __tablename__ = "agent_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question: Mapped[str] = mapped_column(String(500))
    rule: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(String(500), default="")
    hits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


_path = Path(os.environ.get("SR_AGENT_DB", DATA_DIR / "agent_memory.sqlite"))
_engine = None
_Session = None


def _session():
    global _engine, _Session
    if _Session is None:
        _path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{_path}")
        Base.metadata.create_all(_engine)
        _Session = sessionmaker(bind=_engine)
    return _Session()


def search_memories(question: str, limit: int = 5) -> list[AgentInsight]:
    """Keyword match of the question against stored questions/rules (no embeddings)."""
    tokens = [t for t in question.replace("؟", " ").replace("?", " ").split() if len(t) >= 2]
    if not tokens:
        return []
    cond = or_(*(AgentInsight.question.like(f"%{t}%") | AgentInsight.rule.like(f"%{t}%") for t in tokens))
    with _session() as s:
        return s.query(AgentInsight).filter(cond).limit(limit).all()
