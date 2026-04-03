"""
Статистика из Avito API: информация о профиле, объявлениях и чатах.
GET / — сводная статистика аккаунта
"""
import json
import os
import urllib.request
import urllib.parse
import psycopg2
from datetime import datetime, timezone, timedelta


AVITO_API = "https://api.avito.ru"
AVITO_TOKEN_URL = "https://api.avito.ru/token"
DB_SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p85251297_avito_chat_export")


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def refresh_token_if_needed(conn):
    cur = conn.cursor()
    cur.execute(
        f"SELECT access_token, expires_at, client_id, client_secret, user_id FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None, None, "Токен не найден. Подключите Avito в Настройках."
    access_token, expires_at, client_id, client_secret, user_id = row
    now = datetime.now(timezone.utc)
    if expires_at <= now:
        if not client_id or not client_secret:
            return None, None, "Токен истёк. Переподключите Avito в Настройках."
        data = urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }).encode("utf-8")
        req = urllib.request.Request(
            AVITO_TOKEN_URL, data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        access_token = result["access_token"]
        expires_in = result.get("expires_in", 86400)
        new_expires_at = now + timedelta(seconds=expires_in)
        cur2 = conn.cursor()
        cur2.execute(
            f"UPDATE {DB_SCHEMA}.avito_tokens SET access_token=%s, expires_at=%s, updated_at=%s",
            (access_token, new_expires_at, now),
        )
        conn.commit()
        cur2.close()
    if not user_id:
        return None, None, "User ID не указан. Переподключите Avito с указанием User ID."
    return access_token, user_id, None


def avito_get(path: str, token: str):
    req = urllib.request.Request(
        f"{AVITO_API}{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    conn = get_db()
    token, user_id, err = refresh_token_if_needed(conn)
    conn.close()
    if err:
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": err}),
        }

    result = {}

    # Информация о профиле
    try:
        profile = avito_get(f"/core/v1/accounts/{user_id}/", token)
        result["profile"] = {
            "id": profile.get("id"),
            "name": profile.get("name"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
            "profile_url": profile.get("profile_url"),
            "avatar_url": profile.get("photo", {}).get("url") if profile.get("photo") else None,
        }
        print(f"[avito-stats] profile loaded: {profile.get('name')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[avito-stats] profile error {e.code}: {body}")
        result["profile"] = None
        result["profile_error"] = f"{e.code}"

    # Список активных объявлений
    try:
        items_data = avito_get(
            f"/core/v1/accounts/{user_id}/items?per_page=50&status=active", token
        )
        items = items_data.get("resources", [])
        result["items_count"] = items_data.get("meta", {}).get("total", len(items))
        result["items"] = [
            {
                "id": it.get("id"),
                "title": it.get("title"),
                "price": it.get("price_string") or (str(it.get("price", "")) + " ₽" if it.get("price") else ""),
                "status": it.get("status"),
                "url": it.get("url"),
                "views": it.get("stats", {}).get("views", 0),
                "contacts": it.get("stats", {}).get("contacts", 0),
                "category": it.get("category", {}).get("name", ""),
            }
            for it in items[:10]
        ]
        print(f"[avito-stats] items loaded: {result['items_count']}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[avito-stats] items error {e.code}: {body}")
        result["items_count"] = 0
        result["items"] = []
        result["items_error"] = f"{e.code}"

    # Список чатов для подсчёта
    try:
        chats_data = avito_get(f"/messenger/v2/accounts/{user_id}/chats?limit=100", token)
        chats = chats_data.get("chats", [])
        result["chats_count"] = len(chats)
        result["chats_unread"] = sum(c.get("unread_messages_count", 0) for c in chats)
        print(f"[avito-stats] chats loaded: {result['chats_count']}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[avito-stats] chats error {e.code}: {body}")
        result["chats_count"] = 0
        result["chats_unread"] = 0

    return {
        "statusCode": 200,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(result),
    }
