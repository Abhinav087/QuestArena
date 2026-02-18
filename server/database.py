from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./questarena.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.execute("PRAGMA temp_store=MEMORY;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_performance_indexes() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sessions_status_created_at ON sessions (status, created_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_players_session_banned ON players (session_id, is_banned)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_logs_session_timestamp ON logs (session_id, timestamp DESC)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
