"""WattWise SQLite Database Inspector CLI.

Usage:
    python backend/inspect_db.py                # Shows summary table of all tables & row counts
    python backend/inspect_db.py --all          # Dumps and displays data from EVERY table
    python backend/inspect_db.py statements     # Shows rows in 'statements' table
    python backend/inspect_db.py users          # Shows rows in 'users' table
    python backend/inspect_db.py appliances     # Shows rows in 'appliances' table
    python backend/inspect_db.py notifications  # Shows rows in 'notifications' table
    python backend/inspect_db.py -q "SELECT id, name, monthly_cost FROM appliances"
"""

import sys
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "wattwise.db"

def get_connection():
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def print_table_summary(conn):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables = [row[0] for row in cur.fetchall()]

    print("\n" + "=" * 65)
    print(f"  📊 WattWise SQLite Database: {DB_PATH.name}")
    print("=" * 65)
    print(f"{'Table Name':<28} | {'Rows':<8} | {'Columns'}")
    print("-" * 65)

    for tbl in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        cols = [c[1] for c in cur.execute(f"PRAGMA table_info({tbl})").fetchall()]
        cols_summary = ", ".join(cols[:4]) + (f" (+{len(cols)-4} more)" if len(cols) > 4 else "")
        print(f"{tbl:<28} | {count:<8} | {cols_summary}")

    print("=" * 65)
    print("💡 To see data across ALL tables, run:   python backend/inspect_db.py --all")
    print("💡 To inspect a specific table, run:    python backend/inspect_db.py <table_name>")
    print("💡 Example:                             python backend/inspect_db.py users\n")

def print_all_tables_data(conn, limit_per_table=5):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables = [row[0] for row in cur.fetchall()]

    print("\n" + "═" * 70)
    print(f"  📂 FULL DATABASE DUMP: All Tables in {DB_PATH.name}")
    print("═" * 70)

    for tbl in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        print(f"\n┌── 📑 TABLE: {tbl} ({count} total records) ───────────────────────")
        if count == 0:
            print("│   (Table is empty)")
            print("└──" + "─" * 60)
            continue

        rows = cur.execute(f"SELECT * FROM {tbl} LIMIT ?", (limit_per_table,)).fetchall()
        for idx, row in enumerate(rows, 1):
            d = dict(row)
            title = d.get('name') or d.get('title') or d.get('id') or d.get('token') or f"Record #{idx}"
            print(f"│  [{idx}] {title}")
            for k, v in d.items():
                if k in ("password_hash", "salt"):
                    v = f"{str(v)[:16]}... [PROTECTED PBKDF2 HASH]"
                elif k == "token":
                    v = f"{str(v)[:18]}... [SESSION TOKEN]"
                print(f"│      • {k}: {v}")
            if idx < len(rows):
                print("│  " + "-" * 40)
        if count > limit_per_table:
            print(f"│  ... and {count - limit_per_table} more record(s). (Use: python backend/inspect_db.py {tbl} to see more)")
        print("└──" + "─" * 60)
    print()

def print_table_rows(conn, table_name, limit=50):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    if not cur.fetchone():
        print(f"\n❌ Table '{table_name}' does not exist.")
        return

    count = cur.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    rows = cur.execute(f"SELECT * FROM {table_name} LIMIT ?", (limit,)).fetchall()

    if not rows:
        print(f"\nℹ️ Table '{table_name}' is empty (0 records).")
        return

    print(f"\n--- 📋 Data in '{table_name}' ({len(rows)} of {count} rows) ---")
    for idx, row in enumerate(rows, 1):
        d = dict(row)
        title = d.get('name') or d.get('title') or d.get('id') or d.get('token') or f"Row {idx}"
        print(f"\n[{idx}] {title}:")
        for k, v in d.items():
            if k in ("password_hash", "salt"):
                v = f"{str(v)[:16]}... [PROTECTED PBKDF2 HASH]"
            elif k == "token":
                v = f"{str(v)[:18]}... [SESSION TOKEN]"
            print(f"    • {k}: {v}")
    print("-" * 55)

def run_query(conn, query):
    cur = conn.cursor()
    try:
        cur.execute(query)
        rows = cur.fetchall()
        print(f"\n--- 🔍 Query Results ({len(rows)} rows) ---")
        for r in rows:
            print(dict(r))
    except Exception as e:
        print(f"\n❌ Query Error: {e}")

if __name__ == "__main__":
    conn = get_connection()
    args = sys.argv[1:]

    if not args:
        print_table_summary(conn)
    elif args[0] in ("--all", "-a", "all"):
        print_all_tables_data(conn)
    elif args[0] in ("--truncate", "-t", "truncate"):
        sys.path.insert(0, str(Path(__file__).parent))
        from app.db.sqlite_manager import sqlite_db
        sqlite_db.truncate_all_tables(keep_users=True)
        print("\n🧹 Truncated all data tables in database (users preserved).")
        print_table_summary(conn)
    elif args[0] in ("--reseed", "reseed"):
        sys.path.insert(0, str(Path(__file__).parent))
        from app.db.sqlite_manager import sqlite_db
        sqlite_db.reseed_sample_data()
        print_table_summary(conn)
    elif args[0] in ("-q", "--query") and len(args) > 1:
        run_query(conn, " ".join(args[1:]))
    else:
        print_table_rows(conn, args[0])
    conn.close()

