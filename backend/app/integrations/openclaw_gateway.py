from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse
from uuid import uuid4

import websockets



class OpenClawGatewayError(RuntimeError):
    pass


@dataclass
class OpenClawResponse:
    payload: Any


@dataclass(frozen=True)
class GatewayConfig:
    url: str
    token: str | None = None


def _build_gateway_url(config: GatewayConfig) -> str:
    base_url = (config.url or "").strip()
    if not base_url:
        raise OpenClawGatewayError("Gateway URL is not configured for this board.")
    token = config.token
    if not token:
        return base_url
    parsed = urlparse(base_url)
    query = urlencode({"token": token})
    return urlunparse(parsed._replace(query=query))


async def _await_response(ws: websockets.WebSocketClientProtocol, request_id: str) -> Any:
    while True:
        raw = await ws.recv()
        data = json.loads(raw)

        if data.get("type") == "res" and data.get("id") == request_id:
            if data.get("ok") is False:
                error = data.get("error", {}).get("message", "Gateway error")
                raise OpenClawGatewayError(error)
            return data.get("payload")

        if data.get("id") == request_id:
            if data.get("error"):
                raise OpenClawGatewayError(data["error"].get("message", "Gateway error"))
            return data.get("result")


async def _send_request(
    ws: websockets.WebSocketClientProtocol, method: str, params: dict[str, Any] | None
) -> Any:
    request_id = str(uuid4())
    message = {"type": "req", "id": request_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(message))
    return await _await_response(ws, request_id)


async def _handle_challenge(
    ws: websockets.WebSocketClientProtocol,
    first_message: str | bytes | None,
    config: GatewayConfig,
) -> None:
    if not first_message:
        return
    if isinstance(first_message, bytes):
        first_message = first_message.decode("utf-8")
    data = json.loads(first_message)
    if data.get("type") != "event" or data.get("event") != "connect.challenge":
        return

    connect_id = str(uuid4())
    params: dict[str, Any] = {
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
            "id": "gateway-client",
            "version": "1.0.0",
            "platform": "web",
            "mode": "ui",
        },
    }
    if config.token:
        params["auth"] = {"token": config.token}
    response = {
        "type": "req",
        "id": connect_id,
        "method": "connect",
        "params": params,
    }
    await ws.send(json.dumps(response))
    await _await_response(ws, connect_id)


async def openclaw_call(
    method: str,
    params: dict[str, Any] | None = None,
    *,
    config: GatewayConfig,
) -> Any:
    gateway_url = _build_gateway_url(config)
    try:
        async with websockets.connect(gateway_url, ping_interval=None) as ws:
            first_message = None
            try:
                first_message = await asyncio.wait_for(ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                first_message = None
            await _handle_challenge(ws, first_message, config)
            return await _send_request(ws, method, params)
    except OpenClawGatewayError:
        raise
    except Exception as exc:  # pragma: no cover - network errors
        raise OpenClawGatewayError(str(exc)) from exc


async def send_message(
    message: str,
    *,
    session_key: str,
    config: GatewayConfig,
    deliver: bool = False,
) -> Any:
    params: dict[str, Any] = {
        "sessionKey": session_key,
        "message": message,
        "deliver": deliver,
        "idempotencyKey": str(uuid4()),
    }
    return await openclaw_call("chat.send", params, config=config)


async def get_chat_history(
    session_key: str,
    config: GatewayConfig,
    limit: int | None = None,
) -> Any:
    params: dict[str, Any] = {"sessionKey": session_key}
    if limit is not None:
        params["limit"] = limit
    return await openclaw_call("chat.history", params, config=config)


async def delete_session(session_key: str, *, config: GatewayConfig) -> Any:
    return await openclaw_call("sessions.delete", {"key": session_key}, config=config)


async def ensure_session(
    session_key: str,
    *,
    config: GatewayConfig,
    label: str | None = None,
) -> Any:
    params: dict[str, Any] = {"key": session_key}
    if label:
        params["label"] = label
    return await openclaw_call("sessions.patch", params, config=config)
