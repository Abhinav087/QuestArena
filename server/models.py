from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=30)
    remaining_seconds = Column(Integer, nullable=False, default=30 * 60)
    status = Column(String(20), nullable=False, default="waiting")
    leaderboard_frozen = Column(Boolean, nullable=False, default=False)
    frozen_snapshot = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    players = relationship("Player", back_populates="session", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="session", cascade="all, delete-orphan")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), nullable=False, unique=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False, default=0)
    current_level = Column(Integer, nullable=False, default=0)
    join_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_active = Column(DateTime, nullable=False, default=datetime.utcnow)
    ip_address = Column(String(64), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_banned = Column(Boolean, nullable=False, default=False)
    auth_token = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    session = relationship("SessionModel", back_populates="players")
    logs = relationship("Log", back_populates="player", cascade="all, delete-orphan")
    clears = relationship("PlayerQuestionClear", back_populates="player", cascade="all, delete-orphan")


class PlayerQuestionClear(Base):
    __tablename__ = "player_question_clears"
    __table_args__ = (UniqueConstraint("player_id", "question_id", name="uq_player_question_clear"),)

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(80), nullable=False, index=True)
    level = Column(Integer, nullable=False)
    cleared_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    player = relationship("Player", back_populates="clears")


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True, index=True)
    action_type = Column(String(80), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    session = relationship("SessionModel", back_populates="logs")
    player = relationship("Player", back_populates="logs")
