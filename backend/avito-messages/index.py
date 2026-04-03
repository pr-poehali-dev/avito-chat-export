"""
Получение сообщений чата и отправка нового сообщения через Avito API.
GET /?chat_id=XXX — список сообщений
POST / {chat_id, message} — отправить сообщение
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def get_token_and_user():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        f"SELECT access_token, expires_at FROM {DB_SCHEMA}.avito_tokens ORDER BY id DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None, None, "Токен не найден. Подключите Avito в Настройках."
    access_token, expires_at = row
    now = datetime.now(timezone.utc)
    if expires_at <= now:
        return None, None, "Токен истёк. Переподключите Avito в Настройках."
    return access_token, None, None


def avito_request(method: str, path: str, token: str, body=None):
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(
        f"{AVITO_API}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_user_id(token: str):
    info = avito_request("GET", "/core/v1/accounts/self", token)
    return info.get("id")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    token, _, err = get_token_and_user()
    if err:
        return {
            "statusCode": 401,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": err}),
        }

    try:
        user_id = get_user_id(token)
    except urllib.error.HTTPError as e:
        return {
            "statusCode": e.code,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": f"Ошибка профиля: {e.code}"}),
        }

    method = event.get("httpMethod", "GET")

    if method == "GET":
        params = event.get("queryStringParameters") or {}
        chat_id = params.get("chat_id")
        if not chat_id:
            return {
                "statusCode": 400,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": "Параметр chat_id обязателен"}),
            }
        limit = params.get("limit", "100")
        path = f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/?limit={limit}"
        try:
            data = avito_request("GET", path, token)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            return {
                "statusCode": e.code,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": f"Ошибка Avito API: {e.code}", "detail": body}),
            }

        messages_raw = data.get("messages", [])
        messages = []
        for msg in messages_raw:
            created_ts = msg.get("created", 0)
            created_dt = datetime.fromtimestamp(created_ts / 1000, tz=timezone.utc) if created_ts else None
            author_id = msg.get("author_id")
            messages.append({
                "id": msg.get("id"),
                "from": "me" if str(author_id) == str(user_id) else "them",
                "text": msg.get("content", {}).get("text", ""),
                "time": created_dt.isoformat() if created_dt else None,
                "time_display": created_dt.strftime("%H:%M") if created_dt else "",
                "type": msg.get("type", "text"),
                "author_id": author_id,
            })

        messages.sort(key=lambda x: x.get("time") or "")

        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"messages": messages, "total": len(messages)}),
        }

    if method == "POST":
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except Exception:
                pass

        chat_id = body.get("chat_id")
        message_text = body.get("message", "").strip()

        if not chat_id or not message_text:
            return {
                "statusCode": 400,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": "chat_id и message обязательны"}),
            }

        path = f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages"
        payload = {
            "message": {"text": message_text},
            "type": "text",
        }
        try:
            result = avito_request("POST", path, token, payload)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            return {
                "statusCode": e.code,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": f"Ошибка отправки: {e.code}", "detail": err_body}),
            }

        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"success": True, "message_id": result.get("id")}),
        }

    return {
        "statusCode": 405,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({"error": "Method not allowed"}),
    }
