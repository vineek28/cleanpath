"""
ClearPath Database Adapter
===========================
Provides a unified connection interface that works with:
  - SQLite  (local dev — no DATABASE_URL set)
  - PostgreSQL (production — DATABASE_URL set, e.g. Insforge/Supabase/Railway)

Usage:
    from services.db import get_conn, q

    with get_conn() as conn:
        rows = conn.execute(q("SELECT * FROM table WHERE id = ?"), (id,)).fetchall()
        for row in rows:
            d = dict(row)

`q()` rewrites `?` placeholders to `%s` when on PostgreSQL.
`dict(row)` works on both SQLite Row and psycopg2 RealDictRow.
"""

import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL", "")
IS_POSTGRES  = DATABASE_URL.startswith("postgres")
DB_PATH      = Path(__file__).parent.parent / "clearpath_audit.db"


def q(sql: str) -> str:
    """Rewrite SQLite ? placeholders to %s for PostgreSQL."""
    return sql.replace("?", "%s") if IS_POSTGRES else sql


# ── PostgreSQL support ────────────────────────────────────────────────────────

class _PGConn:
    """Thin wrapper around psycopg2 that mimics sqlite3 connection interface."""

    def __init__(self, url: str):
        import psycopg2
        import psycopg2.extras
        self._conn = psycopg2.connect(url)
        self._conn.autocommit = False
        self._cursor_factory = psycopg2.extras.RealDictCursor

    def execute(self, sql: str, params=()):
        cur = self._conn.cursor(cursor_factory=self._cursor_factory)
        cur.execute(sql, params or ())
        return _PGCursor(cur)

    def executemany(self, sql: str, seq):
        cur = self._conn.cursor()
        cur.executemany(sql, seq)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


class _PGCursor:
    """Wraps psycopg2 cursor to return RealDictRow results (work like sqlite3.Row)."""

    def __init__(self, cur):
        self._cur = cur

    def fetchone(self):
        return self._cur.fetchone()   # RealDictRow — dict(row) works

    def fetchall(self):
        return self._cur.fetchall()   # list of RealDictRow

    @property
    def rowcount(self):
        return self._cur.rowcount


# ── Public interface ──────────────────────────────────────────────────────────

@contextmanager
def get_conn():
    """
    Context manager that yields a database connection.
    Commits on clean exit, rolls back on exception.
    """
    if IS_POSTGRES:
        conn = _PGConn(DATABASE_URL)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            yield conn


def raw_sqlite() -> sqlite3.Connection:
    """Direct SQLite connection for legacy code that still imports DB_PATH."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
