"""
Получение списка чатов из Avito API.
GET / — список чатов аккаунта
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


def refresh_token(conn, client_id: str, client_secret: str):
    """Получает новый токен и обновляет его в БД."""
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
        result = json.loads(resp.read().decode("utf-8"))
    access_token = result["access_token"]
    expires_in = result.get("expires_in", 86400)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {DB_SCHEMA}.avito_tokens SET access_token=%s, expires_at=%s, updated_at=%s",
        (access_token, expires_at, datetime.now(timezone.utc)),
    )
    conn.commit()
    cur.close()
    print(f"[avito-chats] token refreshed, expires_in={expires_in}s")
    return access_token


def get_token_and_user_id():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        f"SELECT access_token, expires_at, user_id, client_id, client_secret FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        conn.close()
        return None, None, "Токен не найден. Подключите Avito в Настройках."
    access_token, expires_at, user_id, client_id, client_secret = row
    now = datetime.now(timezone.utc)

    # Автообновление токена если истёк
    if expires_at <= now:
        if client_id and client_secret:
            print("[avito-chats] token expired, refreshing...")
            try:
                access_token = refresh_token(conn, client_id, client_secret)
            except Exception as e:
                conn.close()
                return None, None, f"Не удалось обновить токен: {str(e)}"
        else:
            conn.close()
            return None, None, "Токен истёк. Переподключите Avito в Настройках."

    conn.close()
    if not user_id:
        return None, None, "ID пользователя не указан. Переподключите Avito с указанием User ID."
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

    token, user_id, err = get_token_and_user_id()
    if err:
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": err}),
        }

    print(f"[avito-chats] using user_id={user_id}")

    params = event.get("queryStringParameters") or {}
    limit = params.get("limit", "50")
    offset = params.get("offset", "0")
    item_ids = params.get("item_ids", "")
    unread_only = params.get("unread_only", "false")

    path = f"/messenger/v2/accounts/{user_id}/chats?limit={limit}&offset={offset}"
    if item_ids:
        path += f"&item_ids={item_ids}"
    if unread_only == "true":
        path += "&unread_only=true"

    try:
        print(f"[avito-chats] fetching chats path={path}")
        data = avito_get(path, token)
        print(f"[avito-chats] chats response keys={list(data.keys())}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[avito-chats] chats error {e.code}: {body}")
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Ошибка Avito API: {e.code}", "detail": body}),
        }
    except Exception as e:
        print(f"[avito-chats] chats unexpected: {e}")
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Неожиданная ошибка: {str(e)}"}),
        }

    chats = data.get("chats", [])
    result = []
    for chat in chats:
        context_value = chat.get("context", {}) or {}
        item = context_value.get("value", {}) or {}
        last_message = chat.get("last_message", {}) or {}
        users = chat.get("users", []) or []

        other_user = next(
            (u for u in users if str(u.get("id")) != str(user_id)),
            users[0] if users else {}
        )

        created_ts = last_message.get("created", 0)
        created_dt = datetime.fromtimestamp(created_ts / 1000, tz=timezone.utc) if created_ts else None

        result.append({
            "id": chat.get("id"),
            "user_id": user_id,
            "author_name": other_user.get("name", "Неизвестный"),
            "author_id": other_user.get("id"),
            "item_title": item.get("title", "Объявление"),
            "item_id": item.get("id"),
            "item_url": item.get("url"),
            "last_message_text": last_message.get("content", {}).get("text", ""),
            "last_message_time": created_dt.isoformat() if created_dt else None,
            "unread_count": chat.get("unread_messages_count", 0),
            "is_new": chat.get("unread_messages_count", 0) > 0,
        })

    return {
        "statusCode": 200,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({
            "chats": result,
            "total": len(result),
            "user_id": user_id,
        }),
    }