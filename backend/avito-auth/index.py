"""
Авторизация через Avito API: получение access_token по client_credentials.
Сохраняет токен и credentials в БД. GET — статус, POST — подключить/обновить.
"""
import json
import os
import urllib.request
import urllib.parse
import psycopg2
from datetime import datetime, timezone, timedelta


AVITO_TOKEN_URL = "https://api.avito.ru/token"
DB_SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p85251297_avito_chat_export")


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def fetch_token_from_avito(client_id: str, client_secret: str):
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode("utf-8")
    req = urllib.request.Request(
        AVITO_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        return handle_status()

    if method == "POST":
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except Exception:
                pass

        client_id = body.get("client_id", "").strip()
        client_secret = body.get("client_secret", "").strip()
        user_id = body.get("user_id")

        # Если credentials не переданы — пробуем взять из БД и просто обновить токен
        if not client_id or not client_secret:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(f"SELECT client_id, client_secret, user_id FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row and row[0] and row[1]:
                client_id, client_secret = row[0], row[1]
                if not user_id:
                    user_id = row[2]
            else:
                return {
                    "statusCode": 400,
                    "headers": {**cors_headers(), "Content-Type": "application/json"},
                    "body": json.dumps({"success": False, "error": "client_id и client_secret обязательны"}),
                }

        return handle_auth(client_id, client_secret, user_id)

    return {
        "statusCode": 405,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({"error": "Method not allowed"}),
    }


def handle_status():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT access_token, expires_at, updated_at, user_id, client_id FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"connected": False, "message": "Токен не найден. Введите данные ниже."}),
        }

    access_token, expires_at, updated_at, saved_user_id, saved_client_id = row
    now = datetime.now(timezone.utc)
    is_valid = expires_at > now
    expires_in_minutes = int((expires_at - now).total_seconds() / 60) if is_valid else 0

    return {
        "statusCode": 200,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({
            "connected": is_valid,
            "token_preview": access_token[:12] + "..." if access_token else None,
            "expires_at": expires_at.isoformat(),
            "expires_in_minutes": expires_in_minutes,
            "updated_at": updated_at.isoformat(),
            "user_id": saved_user_id,
            "has_credentials": bool(saved_client_id),
        }),
    }


def handle_auth(client_id: str, client_secret: str, user_id=None):
    print(f"[avito-auth] fetching token for client_id={client_id[:8]}... user_id={user_id}")
    try:
        result = fetch_token_from_avito(client_id, client_secret)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"[avito-auth] token error {e.code}: {error_body}")
        try:
            error_data = json.loads(error_body)
        except Exception:
            error_data = {"message": error_body}
        return {
            "statusCode": 401,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "success": False,
                "error": error_data.get("error_description") or error_data.get("message") or "Неверные credentials",
            }),
        }

    access_token = result.get("access_token")
    expires_in = result.get("expires_in", 86400)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    print(f"[avito-auth] token received, expires_in={expires_in}s, saving to DB")

    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {DB_SCHEMA}.avito_tokens")
    cur.execute(
        f"""INSERT INTO {DB_SCHEMA}.avito_tokens
            (access_token, expires_at, updated_at, user_id, client_id, client_secret)
            VALUES (%s, %s, %s, %s, %s, %s)""",
        (access_token, expires_at, datetime.now(timezone.utc), user_id, client_id, client_secret),
    )
    conn.commit()
    cur.close()
    conn.close()

    return {
        "statusCode": 200,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({
            "success": True,
            "token_preview": access_token[:12] + "...",
            "expires_in_minutes": int(expires_in / 60),
            "expires_at": expires_at.isoformat(),
            "user_id": user_id,
        }),
    }
