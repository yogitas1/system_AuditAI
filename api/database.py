import os
import re

import psycopg2
import psycopg2.extras

# postgresql://user:password@host:port/dbname
_DSN_RE = re.compile(r"postgresql://([^:]+):(.+)@([^:/]+):(\d+)/(.+)")


def get_connection():
    db_url = os.environ.get("SUPABASE_DB_URL", "")
    m = _DSN_RE.match(db_url)
    if not m:
        raise ValueError(f"Cannot parse SUPABASE_DB_URL: {db_url!r}")
    user, password, host, port, dbname = m.groups()
    return psycopg2.connect(
        host=host,
        port=int(port),
        dbname=dbname,
        user=user,
        password=password,
        sslmode="require",
    )


def get_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
