import sqlite3
import os
import re
import logging
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from app.config import settings
from app.models.bill import StatementData, ItemizedCharge
from app.models.appliance import ApplianceTelemetry
from app.models.notification import NotificationItem
from app.models.chat import SuggestedPrompt

logger = logging.getLogger("wattwise.sqlite")

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Cryptographically secure PBKDF2-HMAC-SHA256 password hashing.
    Uses 100,000 iterations and a cryptographically random salt.
    """
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return key.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """
    Constant-time password verification to prevent side-channel timing attacks.
    """
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return secrets.compare_digest(key.hex(), password_hash)


class SQLiteManager:
    """
    High-performance SQLite database manager configured with WAL mode
    for concurrent, sub-millisecond offline-first persistence.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            settings.SQLITE_DB_PATH
        )
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Create a connection with WAL mode and row factory enabled."""
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        # Enable WAL (Write-Ahead Logging) for lightning fast concurrency
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db(self):
        """Create all tables, indexes, and seed comprehensive initial sample data."""
        logger.info("Initializing SQLite database at: %s", self.db_path)
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Statements table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS statements (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                account_no TEXT NOT NULL,
                period TEXT NOT NULL,
                days INTEGER NOT NULL,
                due_date TEXT NOT NULL,
                amount_due TEXT NOT NULL,
                amount_due_numeric REAL NOT NULL,
                consumption_kwh REAL NOT NULL,
                effective_rate TEXT NOT NULL,
                rate_numeric REAL NOT NULL,
                generation_adjustment TEXT NOT NULL,
                utility_type TEXT NOT NULL DEFAULT 'electricity',
                is_verified INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                synced_to_supabase INTEGER NOT NULL DEFAULT 0
            );
            """)

            # 2. Itemized Charges table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS itemized_charges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                statement_id TEXT NOT NULL,
                name TEXT NOT NULL,
                amount TEXT NOT NULL,
                amount_numeric REAL NOT NULL,
                tagalog TEXT NOT NULL,
                desc TEXT NOT NULL,
                percentage INTEGER NOT NULL,
                color TEXT NOT NULL,
                rate TEXT NOT NULL,
                category TEXT NOT NULL,
                FOREIGN KEY (statement_id) REFERENCES statements(id) ON DELETE CASCADE
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_charges_stmt ON itemized_charges(statement_id);")

            # 3. Appliances Telemetry table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS appliances (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                monthly_cost TEXT NOT NULL,
                cost_numeric REAL NOT NULL,
                monthly_kwh TEXT NOT NULL,
                kwh_numeric REAL NOT NULL,
                percentage INTEGER NOT NULL,
                meta TEXT NOT NULL,
                icon TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced_to_supabase INTEGER NOT NULL DEFAULT 0
            );
            """)

            # 4. Notifications table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                section TEXT NOT NULL,
                icon TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                action_label TEXT,
                action_tab TEXT,
                synced_to_supabase INTEGER NOT NULL DEFAULT 0
            );
            """)

            # 5. Profile table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS profile (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                email TEXT NOT NULL,
                household_type TEXT NOT NULL,
                target_budget TEXT NOT NULL,
                is_schedule_applied INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                synced_to_supabase INTEGER NOT NULL DEFAULT 0
            );
            """)

            # 6. Chat history table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id TEXT PRIMARY KEY,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                show_breakdown INTEGER NOT NULL DEFAULT 0,
                savings_estimate TEXT,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """)

            # 7. Monthly Consumption table (for 10-month historical trend chart across utilities)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS monthly_consumption (
                id TEXT PRIMARY KEY,
                utility_type TEXT NOT NULL DEFAULT 'electricity',
                month TEXT NOT NULL,
                val_2024 REAL NOT NULL,
                val_2023 REAL NOT NULL,
                kwh REAL NOT NULL,
                bill TEXT NOT NULL,
                is_current INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL
            );
            """)
            try:
                cursor.execute("ALTER TABLE monthly_consumption ADD COLUMN utility_type TEXT NOT NULL DEFAULT 'electricity';")
            except Exception:
                pass
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_monthly_utility ON monthly_consumption(utility_type);")

            # 8. Suggested Prompts table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS suggested_prompts (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                category TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            );
            """)

            # 9. Real Users table (for authentication & household profiles)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                provider TEXT NOT NULL DEFAULT 'Household Account',
                household_type TEXT NOT NULL DEFAULT 'Residential Household',
                avatar_url TEXT,
                role TEXT NOT NULL DEFAULT 'member',
                is_active INTEGER NOT NULL DEFAULT 1,
                last_login_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced_to_supabase INTEGER NOT NULL DEFAULT 0
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

            # Migration safe additions if users was previously created
            for col in [("last_login_at", "TEXT"), ("updated_at", "TEXT")]:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col[0]} {col[1]};")
                except Exception:
                    pass

            # 10. User Sessions table (for stateful production token management & revocation)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                is_revoked INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);")

            # 11. Onboarding Slides table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_slides (
                id TEXT PRIMARY KEY,
                badge TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                visual_type TEXT NOT NULL
            );
            """)

            # 12. App Metadata (Tracks database state & initialization)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """)

            conn.commit()

        # Seed initial sample data only on first-time setup
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM app_metadata WHERE key = 'db_initialized';")
            row = cursor.fetchone()
            if not row:
                self._seed_initial_data()
                cursor.execute("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('db_initialized', '1');")
                conn.commit()

    def _seed_initial_data(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Seed Profile
            cursor.execute("SELECT COUNT(*) as count FROM profile;")
            if cursor.fetchone()["count"] == 0:
                cursor.execute("""
                INSERT INTO profile (id, display_name, email, household_type, target_budget, is_schedule_applied, updated_at)
                VALUES ('user-default', 'Household Account', '', 'Residential Household', '₱4,500', 0, datetime('now'));
                """)

            # Seed Statements & Itemized Charges
            cursor.execute("SELECT COUNT(*) as count FROM statements;")
            if cursor.fetchone()["count"] == 0:
                sample_statements = [
                    # 1. Electricity Statement (October 2024 - Active Current)
                    (
                        "statement-2024-10", "Electricity Statement", "1029-4820-192", "Oct 04 – Nov 03, 2024",
                        30, "November 22, 2024", "₱4,104.50", 4104.50, 342.0, "₱12.00 / kWh", 12.00,
                        "+₱0.42 / kWh", "electricity", 1, "2024-11-04 12:00:00", 0
                    ),
                    # 2. Water Utility Statement (October 2024 - Active Current)
                    (
                        "statement-water-2024-10", "Water Utility Bill", "0928-1140-581", "Sep 28 – Oct 27, 2024",
                        30, "November 24, 2024", "₱738.20", 738.20, 22.0, "₱33.55 / m³", 33.55,
                        "₱0.00 / m³", "water", 1, "2024-11-03 10:00:00", 0
                    ),
                    # 3. Fiber Broadband Statement (October 2024 - Active Current)
                    (
                        "statement-wifi-2024-10", "Fiber Broadband Bill", "8821-4921-002", "Oct 01 – Oct 31, 2024",
                        30, "November 15, 2024", "₱1,699.00", 1699.00, 8.6, "₱1,699.00 / mo", 1699.00,
                        "₱0.00", "wifi", 1, "2024-11-01 09:00:00", 0
                    ),
                    # 4. September Electricity Statement (Previous Cycle)
                    (
                        "statement-2024-09", "Electricity Statement", "1029-4820-192", "Sep 04 – Oct 03, 2024",
                        30, "October 22, 2024", "₱3,690.00", 3690.00, 318.0, "₱11.60 / kWh", 11.60,
                        "+₱0.18 / kWh", "electricity", 1, "2024-10-04 12:00:00", 0
                    ),
                    # 5. August Electricity Statement (Historical Cycle)
                    (
                        "statement-2024-08", "Electricity Statement", "1029-4820-192", "Aug 04 – Sep 03, 2024",
                        30, "September 22, 2024", "₱3,420.00", 3420.00, 295.0, "₱11.59 / kWh", 11.59,
                        "+₱0.12 / kWh", "electricity", 1, "2024-09-04 12:00:00", 0
                    ),
                ]

                cursor.executemany("""
                INSERT INTO statements (
                    id, provider, account_no, period, days, due_date,
                    amount_due, amount_due_numeric, consumption_kwh,
                    effective_rate, rate_numeric, generation_adjustment,
                    utility_type, is_verified, created_at, synced_to_supabase
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, sample_statements)

                # Charges for all statements
                charges_list = [
                    # Electricity Oct 2024
                    ("statement-2024-10", "Generation Charge", "₱2,257.48", 2257.48, "Halaga ng kuryente mula sa planta", "Cost of electricity generated by independent power producers (IPPs), bilateral contracts, and WESM.", 55, "#006D38", "₱6.60 / kWh", "generation"),
                    ("statement-2024-10", "Distribution Charge", "₱738.81", 738.81, "Singil sa paghahatid ng kuryente sa tahanan", "Charge for operating, maintaining, and modernizing the electric distribution network delivering power directly to your home.", 18, "#102B55", "₱2.16 / kWh", "distribution"),
                    ("statement-2024-10", "Transmission Charge", "₱410.45", 410.45, "Singil sa high-voltage transmission (NGCP)", "Pass-through charge paid to NGCP for moving high-voltage electricity through grid lines.", 10, "#E5C900", "₱1.20 / kWh", "transmission"),
                    ("statement-2024-10", "Government Taxes & VAT", "₱492.54", 492.54, "Buwis ng gobyerno (12% EVAT)", "Mandatory 12% Value Added Tax on generation, transmission, and distribution, plus local taxes.", 12, "#475E8B", "₱1.44 / kWh", "subsidies"),
                    ("statement-2024-10", "System Loss & Subsidies", "₱205.22", 205.22, "Technical losses at lifeline rate discount", "Technical energy dissipation in wires and transformers during delivery, plus lifeline subsidies.", 5, "#87909F", "₱0.60 / kWh", "system_loss"),

                    # Water Oct 2024
                    ("statement-water-2024-10", "Basic Charge", "₱442.92", 442.92, "Pangunahing singil sa tubig", "Baseline water consumption charge based on tiered domestic volume (0-22 m³).", 60, "#0284C7", "₱20.13 / m³", "generation"),
                    ("statement-water-2024-10", "Environmental & Sewerage", "₱147.64", 147.64, "Singil para sa wastewater at kalikasan", "Mandatory environmental charge (20% of basic charge) for sewage treatment and river basin preservation.", 20, "#0EA5E9", "₱6.71 / m³", "distribution"),
                    ("statement-water-2024-10", "Maintenance & Meter Service", "₱68.20", 68.20, "Pagpapanatili ng metro at linya", "Maintenance fee covering connection pipe reliability and pressure gauge calibration.", 9, "#38BDF8", "₱3.10 / m³", "transmission"),
                    ("statement-water-2024-10", "Government EVAT", "₱79.44", 79.44, "12% Value Added Tax", "National government Value Added Tax remitted according to water utility regulations.", 11, "#7DD3FC", "₱3.61 / m³", "subsidies"),

                    # Wi-Fi Oct 2024
                    ("statement-wifi-2024-10", "Fiber Plan 200 Mbps", "₱1,516.96", 1516.96, "Buwanang bayad sa internet plan", "Symmetric high-speed fiber broadband connection with unlimited household data quota.", 89, "#6366F1", "Flat fee", "generation"),
                    ("statement-wifi-2024-10", "12% Government EVAT", "₱182.04", 182.04, "Buwis ng gobyerno", "Mandatory Value Added Tax on telecommunication and digital services.", 11, "#818CF8", "12% tax", "subsidies"),

                    # Electricity Sep 2024
                    ("statement-2024-09", "Generation Charge", "₱2,029.50", 2029.50, "Halaga ng kuryente mula sa planta", "Cost of electricity generated by independent power producers.", 55, "#006D38", "₱6.38 / kWh", "generation"),
                    ("statement-2024-09", "Distribution Charge", "₱664.20", 664.20, "Singil sa paghahatid sa tahanan", "Local distribution network operations and wire repairs.", 18, "#102B55", "₱2.09 / kWh", "distribution"),
                    ("statement-2024-09", "Transmission Charge", "₱369.00", 369.00, "Singil sa NGCP high-voltage transmission", "Pass-through grid highway fee.", 10, "#E5C900", "₱1.16 / kWh", "transmission"),
                    ("statement-2024-09", "Government Taxes & VAT", "₱442.80", 442.80, "12% Value Added Tax", "Mandatory national EVAT.", 12, "#475E8B", "₱1.39 / kWh", "subsidies"),
                    ("statement-2024-09", "System Loss & Subsidies", "₱184.50", 184.50, "Technical wire loss & lifeline subsidy", "Line loss allowance within ERC cap.", 5, "#87909F", "₱0.58 / kWh", "system_loss"),

                    # Electricity Aug 2024
                    ("statement-2024-08", "Generation Charge", "₱1,881.00", 1881.00, "Halaga ng kuryente mula sa planta", "Baseline generation cost.", 55, "#006D38", "₱6.37 / kWh", "generation"),
                    ("statement-2024-08", "Distribution Charge", "₱615.60", 615.60, "Singil sa paghahatid sa tahanan", "Local distribution maintenance.", 18, "#102B55", "₱2.09 / kWh", "distribution"),
                    ("statement-2024-08", "Transmission Charge", "₱342.00", 342.00, "Singil sa high-voltage transmission", "Pass-through transmission charge.", 10, "#E5C900", "₱1.16 / kWh", "transmission"),
                    ("statement-2024-08", "Government Taxes & VAT", "₱410.40", 410.40, "12% Value Added Tax", "Mandatory EVAT.", 12, "#475E8B", "₱1.39 / kWh", "subsidies"),
                    ("statement-2024-08", "System Loss & Subsidies", "₱171.00", 171.00, "Technical wire loss & lifeline subsidy", "Technical line dissipation.", 5, "#87909F", "₱0.58 / kWh", "system_loss"),
                ]

                cursor.executemany("""
                INSERT INTO itemized_charges (
                    statement_id, name, amount, amount_numeric, tagalog, desc,
                    percentage, color, rate, category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, charges_list)

            # Seed Appliances
            cursor.execute("SELECT COUNT(*) as count FROM appliances;")
            if cursor.fetchone()["count"] == 0:
                apps = [
                    ("ac", "Living Room AC (1.5 HP Inverter)", "₱1,724", 1724.0, "144 kWh", 144.0, 42, "Avg 6.2 hrs/day · 23°C", "mode_fan"),
                    ("fridge", "Inverter Refrigerator", "₱739", 739.0, "62 kWh", 62.0, 18, "24/7 continuous duty", "kitchen"),
                    ("fans", "Stand Fans (2 Units)", "₱615", 615.0, "51 kWh", 51.0, 15, "~14 hrs/day combined", "mode_fan"),
                    ("laundry", "Washing Machine & Iron", "₱372", 372.0, "31 kWh", 31.0, 9, "Regular wash cycles", "payments"),
                    ("lighting", "Lighting & Wi-Fi Router", "₱660", 660.0, "55 kWh", 55.0, 16, "Daily household baseline", "bolt"),
                ]
                cursor.executemany("""
                INSERT INTO appliances (
                    id, name, monthly_cost, cost_numeric, monthly_kwh, kwh_numeric,
                    percentage, meta, icon, updated_at, synced_to_supabase
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0);
                """, apps)

            # Seed Notifications
            cursor.execute("SELECT COUNT(*) as count FROM notifications;")
            if cursor.fetchone()["count"] == 0:
                notifs = [
                    ("notif-1", "bills", "October Electricity Bill Analyzed", "Your latest bill of ₱4,104.50 (342 kWh) has been itemized by AI. Living Room AC accounts for 42% (₱1,724) of total draw.", "12:45 PM", "Today", "document_scanner", 0, "View Breakdown", "breakdown"),
                    ("notif-2", "bills", "Electricity Statement Due in 3 Days", "Your October bill of ₱4,104.50 (342 kWh) is scheduled for payment on Friday, Nov 22.", "9:15 AM", "Today", "receipt_long", 0, "View Bill", "breakdown"),
                    ("notif-3", "appliances", "Appliance Draw Alert: Living Room AC", "Living Room AC ran for 8.5 hours yesterday, consuming 18.2 kWh. AI estimates ~₱218 daily cooling expenditure.", "Yesterday, 8:00 PM", "Earlier", "trending_up", 1, "Ask AI Assistant", "insights"),
                    ("notif-4", "bills", "Water Utility Bill Processed", "October water consumption analyzed: 22 m³ (₱738.20). Daily baseline is normal with zero plumbing leaks detected.", "Nov 05", "Earlier", "water_drop", 1, "Ask AI About Water", "insights"),
                    ("notif-5", "bills", "Fiber Broadband Bill Itemized", "Monthly Wi-Fi plan (₱1,699.00) verified. 24/7 router draw is approx 8.6 kWh/month (~₱103 in power).", "Oct 28", "Earlier", "wifi", 1, "View Telemetry", "insights"),
                ]
                cursor.executemany("""
                INSERT INTO notifications (
                    id, category, title, body, timestamp, section, icon, read,
                    action_label, action_tab, synced_to_supabase
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
                """, notifs)

            # Seed Monthly Consumption History for all 3 utilities (Jan to Oct 2024 with 2023 values)
            cursor.execute("SELECT COUNT(*) as count FROM monthly_consumption WHERE utility_type = 'water';")
            if cursor.fetchone()["count"] == 0:
                cursor.execute("UPDATE monthly_consumption SET utility_type = 'electricity' WHERE utility_type IS NULL OR utility_type = '';")
                cursor.execute("SELECT COUNT(*) as count FROM monthly_consumption WHERE utility_type = 'electricity';")
                if cursor.fetchone()["count"] == 0:
                    elec_months = [
                        ("m-elec-1", "electricity", "Jan", 68.0, 75.0, 275.0, "₱3,300.00", 0, 1),
                        ("m-elec-2", "electricity", "Feb", 62.0, 70.0, 250.0, "₱3,000.00", 0, 2),
                        ("m-elec-3", "electricity", "Mar", 74.0, 82.0, 300.0, "₱3,600.00", 0, 3),
                        ("m-elec-4", "electricity", "Apr", 94.0, 98.0, 410.0, "₱4,920.00", 0, 4),
                        ("m-elec-5", "electricity", "May", 88.0, 92.0, 380.0, "₱4,560.00", 0, 5),
                        ("m-elec-6", "electricity", "Jun", 72.0, 80.0, 295.0, "₱3,540.00", 0, 6),
                        ("m-elec-7", "electricity", "Jul", 65.0, 76.0, 265.0, "₱3,180.00", 0, 7),
                        ("m-elec-8", "electricity", "Aug", 70.0, 78.0, 285.0, "₱3,420.00", 0, 8),
                        ("m-elec-9", "electricity", "Sep", 76.0, 84.0, 310.0, "₱3,720.00", 0, 9),
                        ("m-elec-10", "electricity", "Oct", 84.0, 95.0, 342.0, "₱4,104.50", 1, 10),
                    ]
                    cursor.executemany("""
                    INSERT OR REPLACE INTO monthly_consumption (
                        id, utility_type, month, val_2024, val_2023, kwh, bill, is_current, sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """, elec_months)

                water_months = [
                    ("m-water-1", "water", "Jan", 60.0, 65.0, 16.0, "₱536.80", 0, 1),
                    ("m-water-2", "water", "Feb", 65.0, 70.0, 17.0, "₱570.35", 0, 2),
                    ("m-water-3", "water", "Mar", 70.0, 75.0, 18.0, "₱603.90", 0, 3),
                    ("m-water-4", "water", "Apr", 85.0, 90.0, 23.0, "₱771.65", 0, 4),
                    ("m-water-5", "water", "May", 80.0, 85.0, 21.0, "₱704.55", 0, 5),
                    ("m-water-6", "water", "Jun", 68.0, 72.0, 18.0, "₱603.90", 0, 6),
                    ("m-water-7", "water", "Jul", 64.0, 70.0, 17.0, "₱570.35", 0, 7),
                    ("m-water-8", "water", "Aug", 72.0, 74.0, 19.0, "₱637.45", 0, 8),
                    ("m-water-9", "water", "Sep", 75.0, 78.0, 20.0, "₱671.00", 0, 9),
                    ("m-water-10", "water", "Oct", 82.0, 88.0, 22.0, "₱738.20", 1, 10),
                ]
                cursor.executemany("""
                INSERT OR REPLACE INTO monthly_consumption (
                    id, utility_type, month, val_2024, val_2023, kwh, bill, is_current, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, water_months)

                wifi_months = [
                    ("m-wifi-1", "wifi", "Jan", 75.0, 70.0, 280.0, "₱1,699.00", 0, 1),
                    ("m-wifi-2", "wifi", "Feb", 78.0, 72.0, 295.0, "₱1,699.00", 0, 2),
                    ("m-wifi-3", "wifi", "Mar", 82.0, 78.0, 310.0, "₱1,699.00", 0, 3),
                    ("m-wifi-4", "wifi", "Apr", 88.0, 85.0, 330.0, "₱1,699.00", 0, 4),
                    ("m-wifi-5", "wifi", "May", 85.0, 84.0, 320.0, "₱1,699.00", 0, 5),
                    ("m-wifi-6", "wifi", "Jun", 80.0, 80.0, 305.0, "₱1,699.00", 0, 6),
                    ("m-wifi-7", "wifi", "Jul", 78.0, 76.0, 290.0, "₱1,699.00", 0, 7),
                    ("m-wifi-8", "wifi", "Aug", 84.0, 82.0, 315.0, "₱1,699.00", 0, 8),
                    ("m-wifi-9", "wifi", "Sep", 89.0, 86.0, 335.0, "₱1,699.00", 0, 9),
                    ("m-wifi-10", "wifi", "Oct", 92.0, 90.0, 348.0, "₱1,699.00", 1, 10),
                ]
                cursor.executemany("""
                INSERT OR REPLACE INTO monthly_consumption (
                    id, utility_type, month, val_2024, val_2023, kwh, bill, is_current, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, wifi_months)

            # Seed Suggested Prompts
            cursor.execute("SELECT COUNT(*) as count FROM suggested_prompts;")
            if cursor.fetchone()["count"] == 0:
                prompts = [
                    ("prompt-1", "How much does my Living Room AC cost per month?", "appliances", 1),
                    ("prompt-2", "Analyze my water consumption & check for leaks", "water", 2),
                    ("prompt-3", "How much electricity does my Wi-Fi router use 24/7?", "wifi", 3),
                    ("prompt-4", "Compare October vs September bill", "history", 4),
                    ("prompt-5", "What is my refrigerator's monthly cost & kWh?", "appliances", 5),
                    ("prompt-6", "Show me itemized charges on my electricity bill", "electricity", 6),
                ]
                cursor.executemany("""
                INSERT INTO suggested_prompts (id, text, category, sort_order)
                VALUES (?, ?, ?, ?);
                """, prompts)

            # Seed Onboarding Slides
            cursor.execute("SELECT COUNT(*) as count FROM onboarding_slides;")
            if cursor.fetchone()["count"] == 0:
                slides = [
                    (
                        "ocr",
                        "On-Device Document Scanner",
                        "Scan Utility Statements in Seconds",
                        "Point your camera at your electric, water, or broadband bill. WattWise extracts account figures, kWh consumption, and fuel adjustments securely on-device.",
                        0,
                        "ocr",
                    ),
                    (
                        "breakdown",
                        "Transparent Tariff Decomposition",
                        "Decipher Generation & Distribution Charges",
                        "Break down unbundled electric, water, and broadband billing components. Understand the exact cost of generation, transmission, subsidies, and EVAT.",
                        1,
                        "breakdown",
                    ),
                    (
                        "copilot",
                        "AI Energy Copilot",
                        "AI Energy Copilot Built for Philippine Tariffs",
                        'Ask plain-language questions like "How much does running our AC at 23°C cost?" and get instant actionable advice tailored to your household.',
                        2,
                        "copilot",
                    ),
                ]
                cursor.executemany("""
                INSERT INTO onboarding_slides (id, badge, title, description, sort_order, visual_type)
                VALUES (?, ?, ?, ?, ?, ?);
                """, slides)

            conn.commit()

    def truncate_all_tables(self, keep_users: bool = True):
        """
        Truncate all operational/utility data in the database, resetting all record counts to 0.
        When keep_users is True, preserves user accounts in `users` and active session tokens in `user_sessions`.
        Maintains db_initialized flag so sample data is not automatically repopulated on restart.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = OFF;")
            tables = [
                "itemized_charges",
                "statements",
                "appliances",
                "notifications",
                "chat_history",
                "monthly_consumption",
                "suggested_prompts",
                "onboarding_slides",
                "profile",
            ]
            if not keep_users:
                tables.extend(["user_sessions", "users"])

            for tbl in tables:
                cursor.execute(f"DELETE FROM {tbl};")

            try:
                for tbl in tables:
                    cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?;", (tbl,))
            except Exception:
                pass

            cursor.execute("CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
            cursor.execute("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('db_initialized', '1');")
            cursor.execute("PRAGMA foreign_keys = ON;")
            conn.commit()
            cursor.execute("VACUUM;")
            logger.info("Successfully truncated data tables (users preserved).")

    def reseed_sample_data(self):
        """
        Manually re-seeds initial sample dataset into the database.
        """
        self._seed_initial_data()

    def reset_and_reseed_db(self):
        """Drops all tables and re-seeds complete realistic sample data."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS itemized_charges;")
            cursor.execute("DROP TABLE IF EXISTS statements;")
            cursor.execute("DROP TABLE IF EXISTS appliances;")
            cursor.execute("DROP TABLE IF EXISTS notifications;")
            cursor.execute("DROP TABLE IF EXISTS profile;")
            cursor.execute("DROP TABLE IF EXISTS chat_history;")
            cursor.execute("DROP TABLE IF EXISTS monthly_consumption;")
            cursor.execute("DROP TABLE IF EXISTS suggested_prompts;")
            cursor.execute("DROP TABLE IF EXISTS user_sessions;")
            cursor.execute("DROP TABLE IF EXISTS users;")
            cursor.execute("DROP TABLE IF EXISTS onboarding_slides;")
            cursor.execute("DROP TABLE IF EXISTS app_metadata;")
            conn.commit()
        self.init_db()

    # Query Helpers
    def get_current_statement(self, utility_type: Optional[str] = None) -> Tuple[StatementData, List[ItemizedCharge]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if utility_type:
                cursor.execute(
                    "SELECT * FROM statements WHERE utility_type = ? ORDER BY created_at DESC LIMIT 1;",
                    (utility_type,)
                )
            else:
                cursor.execute(
                    "SELECT * FROM statements WHERE utility_type = 'electricity' ORDER BY created_at DESC LIMIT 1;"
                )
            row = cursor.fetchone()
            if not row:
                cursor.execute("SELECT * FROM statements ORDER BY created_at DESC LIMIT 1;")
                row = cursor.fetchone()
            if not row:
                raise ValueError("No statement records found in SQLite")

            stmt = StatementData(
                id=row["id"],
                provider=row["provider"],
                accountNo=row["account_no"],
                period=row["period"],
                days=row["days"],
                dueDate=row["due_date"],
                amountDue=row["amount_due"],
                amountDueNumeric=row["amount_due_numeric"],
                consumptionKwh=row["consumption_kwh"],
                effectiveRate=row["effective_rate"],
                rateNumeric=row["rate_numeric"],
                generationAdjustment=row["generation_adjustment"],
                utilityType=row["utility_type"],
            )

            cursor.execute("SELECT * FROM itemized_charges WHERE statement_id = ?;", (stmt.id,))
            charges = [
                ItemizedCharge(
                    name=c["name"],
                    amount=c["amount"],
                    amountNumeric=c["amount_numeric"],
                    tagalog=c["tagalog"],
                    desc=c["desc"],
                    percentage=c["percentage"],
                    color=c["color"],
                    rate=c["rate"],
                    category=c["category"],
                )
                for c in cursor.fetchall()
            ]
            return stmt, charges

    def get_statement_by_id(self, stmt_id: str) -> Optional[Tuple[StatementData, List[ItemizedCharge]]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM statements WHERE id = ? LIMIT 1;", (stmt_id,))
            row = cursor.fetchone()
            if not row:
                return None

            stmt = StatementData(
                id=row["id"],
                provider=row["provider"],
                accountNo=row["account_no"],
                period=row["period"],
                days=row["days"],
                dueDate=row["due_date"],
                amountDue=row["amount_due"],
                amountDueNumeric=row["amount_due_numeric"],
                consumptionKwh=row["consumption_kwh"],
                effectiveRate=row["effective_rate"],
                rateNumeric=row["rate_numeric"],
                generationAdjustment=row["generation_adjustment"],
                utilityType=row["utility_type"],
            )

            cursor.execute("SELECT * FROM itemized_charges WHERE statement_id = ?;", (stmt.id,))
            charges = [
                ItemizedCharge(
                    name=c["name"],
                    amount=c["amount"],
                    amountNumeric=c["amount_numeric"],
                    tagalog=c["tagalog"],
                    desc=c["desc"],
                    percentage=c["percentage"],
                    color=c["color"],
                    rate=c["rate"],
                    category=c["category"],
                )
                for c in cursor.fetchall()
            ]
            return stmt, charges

    def save_statement(self, stmt: StatementData, charges: List[ItemizedCharge]) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO statements (
                id, provider, account_no, period, days, due_date,
                amount_due, amount_due_numeric, consumption_kwh,
                effective_rate, rate_numeric, generation_adjustment,
                utility_type, is_verified, created_at, synced_to_supabase
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), 0);
            """, (
                stmt.id, stmt.provider, stmt.accountNo, stmt.period, stmt.days,
                stmt.dueDate, stmt.amountDue, stmt.amountDueNumeric, stmt.consumptionKwh,
                stmt.effectiveRate, stmt.rateNumeric, stmt.generationAdjustment, stmt.utilityType or 'electricity'
            ))

            cursor.execute("DELETE FROM itemized_charges WHERE statement_id = ?;", (stmt.id,))
            charge_rows = [
                (stmt.id, c.name, c.amount, c.amountNumeric, c.tagalog, c.desc, c.percentage, c.color, c.rate, c.category)
                for c in charges
            ]
            cursor.executemany("""
            INSERT INTO itemized_charges (
                statement_id, name, amount, amount_numeric, tagalog, desc,
                percentage, color, rate, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, charge_rows)
            conn.commit()

    def get_recent_bills(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM statements ORDER BY created_at DESC LIMIT 10;")
            return [
                {
                    "id": row["id"],
                    "provider": row["provider"],
                    "title": row["provider"],
                    "type": row["utility_type"],
                    "accountNo": f"...{row['account_no'][-4:]}" if len(row["account_no"]) >= 4 else row["account_no"],
                    "period": row["period"],
                    "amount": row["amount_due"],
                    "metric": f"{int(row['consumption_kwh']) if row['consumption_kwh'].is_integer() else row['consumption_kwh']} {('m³' if row['utility_type'] == 'water' else 'Mbps' if row['utility_type'] == 'wifi' else 'kWh')}",
                    "date": row["due_date"],
                    "status": "Due Soon" if "2024-10" in row["id"] else "Paid",
                }
                for row in cursor.fetchall()
            ]

    def get_monthly_consumption(self, utility_type: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if utility_type:
                ut = "electricity" if utility_type in ("elec", "electricity") else utility_type
                cursor.execute(
                    "SELECT * FROM monthly_consumption WHERE utility_type = ? ORDER BY sort_order ASC;",
                    (ut,)
                )
            else:
                cursor.execute("SELECT * FROM monthly_consumption ORDER BY sort_order ASC;")
            return [
                {
                    "month": row["month"],
                    "val2024": row["val_2024"],
                    "val2023": row["val_2023"],
                    "kwh": row["kwh"],
                    "bill": row["bill"],
                    "isCurrent": bool(row["is_current"]),
                    "utilityType": row["utility_type"] if "utility_type" in row.keys() else "electricity",
                }
                for row in cursor.fetchall()
            ]

    def get_all_monthly_consumption(self) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "elec": self.get_monthly_consumption("electricity"),
            "water": self.get_monthly_consumption("water"),
            "wifi": self.get_monthly_consumption("wifi"),
        }

    def get_utility_telemetry(self) -> Dict[str, Dict[str, Any]]:
        telemetry = {}
        type_mapping = {
            "elec": "electricity",
            "water": "water",
            "wifi": "wifi"
        }
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for key, ut in type_mapping.items():
                cursor.execute(
                    "SELECT * FROM statements WHERE utility_type = ? ORDER BY created_at DESC LIMIT 1;",
                    (ut,)
                )
                row = cursor.fetchone()
                if not row:
                    continue
                consumption = float(row["consumption_kwh"])
                days = row["days"] or 30
                amount_num = float(row["amount_due_numeric"])
                daily_avg = round(consumption / days, 2)
                
                if key == "water":
                    unit = "m³"
                    name = "Water"
                    trend = "-4.2% vs last year"
                    daily_unit = "m³/d"
                    daily_vs = "-2.1% vs previous cycle"
                    forecast_sub = "Low-flow conservation tier"
                    carbon = str(round(consumption * 0.55))
                    carbon_unit = "kg CO₂"
                    carbon_sub = "Water purification offset"
                elif key == "wifi":
                    unit = "GB"
                    name = "Wi-Fi"
                    trend = "Unlimited Fiber"
                    daily_unit = "GB/d"
                    daily_vs = "14 active devices online"
                    forecast_sub = "Fixed 200 Mbps fiber plan"
                    carbon = "4.2"
                    carbon_unit = "kg CO₂"
                    carbon_sub = "Optical low-power network"
                else:
                    unit = "kWh"
                    name = "Electricity"
                    trend = "-11.8% vs last year"
                    daily_unit = "kWh/d"
                    daily_vs = "-9.5% vs previous cycle"
                    forecast_sub = "Tier 2 household tariff"
                    carbon = str(round(consumption * 0.538))
                    carbon_unit = "kg CO₂"
                    trees = max(1, round(consumption * 0.538 / 22))
                    carbon_sub = f"≈ {trees} trees equivalent"
                
                telemetry[key] = {
                    "name": name,
                    "unit": unit,
                    "stat": f"{consumption:g}",
                    "trend": trend,
                    "estBill": row["amount_due"],
                    "dueDate": f"Due {row['due_date']} · Current Cycle",
                    "dailyAvg": f"{daily_avg:g}",
                    "dailyUnit": daily_unit,
                    "dailyVs": daily_vs,
                    "forecast": f"₱{round(amount_num * 0.95):,}.00",
                    "forecastSub": forecast_sub,
                    "carbon": carbon,
                    "carbonUnit": carbon_unit,
                    "carbonSub": carbon_sub,
                    "cycleLabel": "Oct 2024 Cycle",
                }
        return telemetry

    def get_suggested_prompts(self) -> List[SuggestedPrompt]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM suggested_prompts ORDER BY sort_order ASC;")
            return [
                SuggestedPrompt(
                    id=row["id"],
                    text=row["text"],
                    category=row["category"],
                )
                for row in cursor.fetchall()
            ]

    def get_onboarding_slides(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, badge, title, description, sort_order, visual_type FROM onboarding_slides ORDER BY sort_order ASC;")
            return [dict(row) for row in cursor.fetchall()]

    def get_appliances(self) -> List[ApplianceTelemetry]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM appliances ORDER BY cost_numeric DESC;")
            return [
                ApplianceTelemetry(
                    id=row["id"],
                    name=row["name"],
                    monthlyCost=row["monthly_cost"],
                    costNumeric=row["cost_numeric"],
                    monthlyKwh=row["monthly_kwh"],
                    kwhNumeric=row["kwh_numeric"],
                    percentage=row["percentage"],
                    meta=row["meta"],
                    icon=row["icon"],
                )
                for row in cursor.fetchall()
            ]

    def update_thermostat(self, temp: int = 25, applied: bool = True) -> List[ApplianceTelemetry]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if applied:
                cursor.execute("""
                UPDATE appliances
                SET name = ?, monthly_cost = '₱1,204', cost_numeric = 1204.0,
                    monthly_kwh = '100 kWh', kwh_numeric = 100.0, percentage = 33,
                    meta = ?, updated_at = datetime('now'), synced_to_supabase = 0
                WHERE id = 'ac';
                """, (f"Living Room AC ({temp}°C Optimized)", f"Avg 6.2 hrs/day · {temp}°C eco schedule"))
            else:
                cursor.execute("""
                UPDATE appliances
                SET name = 'Living Room AC (1.5 HP Inverter)', monthly_cost = '₱1,724', cost_numeric = 1724.0,
                    monthly_kwh = '144 kWh', kwh_numeric = 144.0, percentage = 42,
                    meta = 'Avg 6.2 hrs/day · 23°C', updated_at = datetime('now'), synced_to_supabase = 0
                WHERE id = 'ac';
                """)

            cursor.execute("""
            UPDATE profile
            SET is_schedule_applied = ?, updated_at = datetime('now'), synced_to_supabase = 0
            WHERE id = 'user-default';
            """, (1 if applied else 0,))

            conn.commit()
        return self.get_appliances()

    def get_notifications(self) -> List[NotificationItem]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM notifications ORDER BY timestamp DESC;")
            return [
                NotificationItem(
                    id=row["id"],
                    category=row["category"],
                    title=row["title"],
                    body=row["body"],
                    timestamp=row["timestamp"],
                    section=row["section"],
                    icon=row["icon"],
                    read=bool(row["read"]),
                    actionLabel=row["action_label"],
                    actionTab=row["action_tab"],
                )
                for row in cursor.fetchall()
            ]

    def mark_notification_read(self, notif_id: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE notifications SET read = 1, synced_to_supabase = 0 WHERE id = ?;", (notif_id,))
            conn.commit()
            return cursor.rowcount > 0

    def mark_all_notifications_read(self) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE notifications SET read = 1, synced_to_supabase = 0 WHERE read = 0;")
            conn.commit()
            return cursor.rowcount

    def save_chat_message(self, sender: str, text: str, show_breakdown: bool = False, savings_estimate: Optional[str] = None) -> str:
        msg_id = f"msg-{int(datetime.now().timestamp() * 1000)}"
        now_str = datetime.now().strftime("%I:%M %p")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO chat_history (id, sender, text, show_breakdown, savings_estimate, timestamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'));
            """, (msg_id, sender, text, 1 if show_breakdown else 0, savings_estimate, now_str))
            conn.commit()
        return msg_id

    def get_chat_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, sender, text, show_breakdown, savings_estimate, timestamp FROM chat_history ORDER BY created_at ASC LIMIT ?;",
                (limit,)
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "sender": r["sender"],
                    "text": r["text"],
                    "showBreakdown": bool(r["show_breakdown"]),
                    "savingsEstimate": r["savings_estimate"],
                    "time": r["timestamp"],
                }
                for r in rows
            ]

    def get_profile(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name, email, household_type FROM users ORDER BY created_at DESC LIMIT 1;")
            user_row = cursor.fetchone()

            cursor.execute("SELECT * FROM profile WHERE id = 'user-default';")
            row = cursor.fetchone()

            display_name = user_row["name"] if user_row else (row["display_name"] if row else "Household Resident")
            email = user_row["email"] if user_row else (row["email"] if row else "resident@wattwise.local")
            household_type = user_row["household_type"] if user_row else (row["household_type"] if row else "Single Family")
            target_budget = row["target_budget"] if row else "₱4,500"
            is_schedule_applied = bool(row["is_schedule_applied"]) if row else False

            return {
                "displayName": display_name,
                "email": email,
                "householdType": household_type,
                "targetBudget": target_budget,
                "isScheduleApplied": is_schedule_applied,
            }

    def update_budget(self, budget: str) -> str:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE profile SET target_budget = ?, updated_at = datetime('now'), synced_to_supabase = 0 WHERE id = 'user-default';", (budget,))
            conn.commit()
            return budget

    def get_unsynced_count(self) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            stmt_c = cursor.execute("SELECT COUNT(*) FROM statements WHERE synced_to_supabase = 0;").fetchone()[0]
            app_c = cursor.execute("SELECT COUNT(*) FROM appliances WHERE synced_to_supabase = 0;").fetchone()[0]
            notif_c = cursor.execute("SELECT COUNT(*) FROM notifications WHERE synced_to_supabase = 0;").fetchone()[0]
            prof_c = cursor.execute("SELECT COUNT(*) FROM profile WHERE synced_to_supabase = 0;").fetchone()[0]
            user_c = cursor.execute("SELECT COUNT(*) FROM users WHERE synced_to_supabase = 0;").fetchone()[0]
            return stmt_c + app_c + notif_c + prof_c + user_c

    def get_table_counts(self) -> Dict[str, int]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            stmts = cursor.execute("SELECT COUNT(*) FROM statements;").fetchone()[0]
            apps = cursor.execute("SELECT COUNT(*) FROM appliances;").fetchone()[0]
            notifs = cursor.execute("SELECT COUNT(*) FROM notifications;").fetchone()[0]
            monthly = cursor.execute("SELECT COUNT(*) FROM monthly_consumption;").fetchone()[0]
            prompts = cursor.execute("SELECT COUNT(*) FROM suggested_prompts;").fetchone()[0]
            users = cursor.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
            sessions = cursor.execute("SELECT COUNT(*) FROM user_sessions WHERE is_revoked = 0;").fetchone()[0]
            onboarding = cursor.execute("SELECT COUNT(*) FROM onboarding_slides;").fetchone()[0]
            return {
                "statements": stmts,
                "appliances": apps,
                "notifications": notifs,
                "monthly_records": monthly,
                "suggested_prompts": prompts,
                "users": users,
                "active_sessions": sessions,
                "onboarding_slides": onboarding,
            }

    # Session Management (Production Stateful Token Storage in SQLite)
    def create_session(self, user_id: str, days: int = 30) -> str:
        """Create a cryptographically secure token and persist in user_sessions table."""
        token = f"ww_sess_{secrets.token_urlsafe(32)}"
        now = datetime.now()
        expires = now + timedelta(days=days)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO user_sessions (token, user_id, created_at, expires_at, is_revoked)
            VALUES (?, ?, ?, ?, 0);
            """, (token, user_id, now.strftime("%Y-%m-%d %H:%M:%S"), expires.strftime("%Y-%m-%d %H:%M:%S")))
            cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?;", (now.strftime("%Y-%m-%d %H:%M:%S"), user_id))
            conn.commit()
        return token

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify token against user_sessions table in SQLite and return live user profile."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT u.id, u.name, u.email, u.provider, u.household_type, u.avatar_url, u.role, u.is_active, u.created_at, u.last_login_at
            FROM users u
            JOIN user_sessions s ON s.user_id = u.id
            WHERE s.token = ? AND s.is_revoked = 0 AND s.expires_at > datetime('now') AND u.is_active = 1;
            """, (token,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "provider": row["provider"],
                "householdType": row["household_type"],
                "avatarUrl": row["avatar_url"],
                "role": row["role"],
                "createdAt": row["created_at"],
                "lastLoginAt": row["last_login_at"],
            }

    def revoke_session(self, token: str) -> bool:
        """Revoke a session token in SQLite upon logout."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE user_sessions SET is_revoked = 1 WHERE token = ?;", (token,))
            conn.commit()
            return cursor.rowcount > 0

    # User Authentication & Management Helpers
    def authenticate_user(self, email: str, password: str) -> Optional[Tuple[Dict[str, Any], str]]:
        """Verify user credentials against SQLite with constant-time password hash checking and issue a session token."""
        clean_email = email.strip().lower()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ? AND is_active = 1;", (clean_email,))
            user = cursor.fetchone()
            if not user:
                return None
            if not verify_password(password, user["password_hash"], user["salt"]):
                return None

            user_dict = {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "provider": user["provider"],
                "householdType": user["household_type"],
                "avatarUrl": user["avatar_url"],
                "role": user["role"],
                "createdAt": user["created_at"],
            }

        token = self.create_session(user["id"])
        return user_dict, token

    def create_user(
        self,
        name: str,
        email: str,
        password: str,
        provider: str = "Household Account",
        household_type: str = "Residential Household",
        avatar_url: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], str]:
        """Register a new user directly in SQLite with salt generation, password hashing, and active session."""
        clean_email = email.strip().lower()
        clean_name = name.strip()

        if not EMAIL_REGEX.match(clean_email):
            raise ValueError("Please enter a valid email address.")
        if len(clean_name) < 2:
            raise ValueError("Name must be at least 2 characters long.")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?;", (clean_email,))
            if cursor.fetchone():
                raise ValueError("This email address is already registered.")

            user_id = f"user-{uuid.uuid4().hex[:8]}"
            p_hash, salt = hash_password(password)
            default_avatar = avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
            INSERT INTO users (id, name, email, password_hash, salt, provider, household_type, avatar_url, role, is_active, created_at, updated_at, synced_to_supabase)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member', 1, ?, ?, 0);
            """, (user_id, clean_name, clean_email, p_hash, salt, provider, household_type, default_avatar, now_str, now_str))
            conn.commit()

            user_dict = {
                "id": user_id,
                "name": clean_name,
                "email": clean_email,
                "provider": provider,
                "householdType": household_type,
                "avatarUrl": default_avatar,
                "role": "member",
                "createdAt": now_str,
            }

        token = self.create_session(user_id)
        return user_dict, token

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, provider, household_type, avatar_url, role, is_active, created_at FROM users WHERE email = ?;", (clean_email,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "provider": row["provider"],
                "householdType": row["household_type"],
                "avatarUrl": row["avatar_url"],
                "role": row["role"],
                "isActive": bool(row["is_active"]),
                "createdAt": row["created_at"],
            }

    def get_all_users(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, provider, household_type, avatar_url, role, is_active, created_at FROM users ORDER BY created_at ASC;")
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "email": r["email"],
                    "provider": r["provider"],
                    "householdType": r["household_type"],
                    "avatarUrl": r["avatar_url"],
                    "role": r["role"],
                    "isActive": bool(r["is_active"]),
                    "createdAt": r["created_at"],
                }
                for r in cursor.fetchall()
            ]


sqlite_db = SQLiteManager()
