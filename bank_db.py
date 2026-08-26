import os
import psycopg2
from psycopg2.extras import RealDictCursor
from db import getconn, putconn


def get_connection():
    return getconn()


def _has_column(cursor, table_name, column_name):
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name = %s
        """,
        (table_name, column_name),
    )
    return cursor.fetchone() is not None


def fetch_bank_managers(
    bank_name=None,
    city=None,
    district=None,
    state=None,
    branch=None,
    manager_name=None,
):
    conn = get_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        select_fields = [
            "id",
            "bank_name",
            "name AS manager_name",
            "'' AS employee_code",
            "phone AS mobile_no",
            "email AS email_id",
            "location AS location_city",
            "'' AS location_district",
            "'' AS state",
            "role AS branch_name",
            "'' AS branch_code",
            "role AS designation",
        ]
        if _has_column(cursor, "bank_managers", "status"):
            select_fields.append("status")

        query = "SELECT " + ", ".join(select_fields) + " FROM bank_managers"
        where_clauses = []
        params = []

        if _has_column(cursor, "bank_managers", "status"):
            where_clauses.append("status = 'active'")

        if bank_name:
            where_clauses.append("LOWER(bank_name) LIKE LOWER(%s)")
            params.append(f"%{bank_name}%")

        if city:
            where_clauses.append("LOWER(location) LIKE LOWER(%s)")
            params.append(f"%{city}%")

        if manager_name:
            where_clauses.append("LOWER(name) LIKE LOWER(%s)")
            params.append(f"%{manager_name}%")

        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)

        query += " ORDER BY bank_name, location, name LIMIT 100"

        cursor.execute(query, params)
        results = cursor.fetchall()
        return [dict(row) for row in results]
    finally:
        putconn(conn)
