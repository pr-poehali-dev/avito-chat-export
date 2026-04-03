"""
Получение списка чатов из Avito API.
GET / — список чатов аккаунта
"""
import json
import os
import urllib.request
import psycopg2
from datetime import datetime, timezone


AVITO_API = "https://api.avito.ru"
DB_SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p85251297_avito_chat_export")


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def get_token():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        f"SELECT access_token, expires_at FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None, "Токен не найден. Подключите Avito в Настройках."
    access_token, expires_at = row
    now = datetime.now(timezone.utc)
    if expires_at <= now:
        return None, "Токен истёк. Переподключите Avito в Настройках."
    return access_token, None


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

    token, err = get_token()
    if err:
        return {
            "statusCode": 401,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": err}),
        }

    try:
        user_info = avito_get("/core/v1/accounts/self", token)
        user_id = user_info.get("id")
        if not user_id:
            return {
                "statusCode": 502,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": "Не удалось получить ID пользователя"}),
            }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return {
            "statusCode": e.code,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Ошибка профиля Avito: {e.code}", "detail": body}),
        }

    params = event.get("queryStringParameters") or {}
    limit = params.get("limit", "50")
    offset = params.get("offset", "0")
    item_ids = params.get("item_ids", "")
    unread_only = params.get("unread_only", "false")

    path = f"/messenger/v3/accounts/{user_id}/chats?limit={limit}&offset={offset}"
    if item_ids:
        path += f"&item_ids={item_ids}"
    if unread_only == "true":
        path += "&unread_only=true"

    try:
        data = avito_get(path, token)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return {
            "statusCode": e.code,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Ошибка Avito API: {e.code}", "detail": body}),
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
