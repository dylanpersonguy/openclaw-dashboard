from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import require_admin_auth
from app.core.auth import AuthContext
from app.integrations.openclaw_gateway import (
    GatewayConfig,
    OpenClawGatewayError,
    ensure_session,
    get_chat_history,
    openclaw_call,
    send_message,
)
from app.db.session import get_session
from app.models.boards import Board

router = APIRouter(prefix="/gateway", tags=["gateway"])


def _require_board_config(session: Session, board_id: str | None) -> tuple[Board, GatewayConfig]:
    if not board_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="board_id is required",
        )
    board = session.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if not board.gateway_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Board gateway_url is required",
        )
    return board, GatewayConfig(url=board.gateway_url, token=board.gateway_token)


@router.get("/status")
async def gateway_status(
    board_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(require_admin_auth),
) -> dict[str, object]:
    board, config = _require_board_config(session, board_id)
    try:
        sessions = await openclaw_call("sessions.list", config=config)
        if isinstance(sessions, dict):
            sessions_list = list(sessions.get("sessions") or [])
        else:
            sessions_list = list(sessions or [])
        main_session = board.gateway_main_session_key or "agent:main:main"
        main_session_entry: object | None = None
        main_session_error: str | None = None
        if main_session:
            try:
                ensured = await ensure_session(
                    main_session, config=config, label="Main Agent"
                )
                if isinstance(ensured, dict):
                    main_session_entry = ensured.get("entry") or ensured
            except OpenClawGatewayError as exc:
                main_session_error = str(exc)
        return {
            "connected": True,
            "gateway_url": board.gateway_url,
            "sessions_count": len(sessions_list),
            "sessions": sessions_list,
            "main_session_key": main_session,
            "main_session": main_session_entry,
            "main_session_error": main_session_error,
        }
    except OpenClawGatewayError as exc:
        return {
            "connected": False,
            "gateway_url": board.gateway_url,
            "error": str(exc),
        }


@router.get("/sessions")
async def list_sessions(
    board_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(require_admin_auth),
) -> dict[str, object]:
    board, config = _require_board_config(session, board_id)
    try:
        sessions = await openclaw_call("sessions.list", config=config)
    except OpenClawGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    if isinstance(sessions, dict):
        sessions_list = list(sessions.get("sessions") or [])
    else:
        sessions_list = list(sessions or [])

    main_session = board.gateway_main_session_key or "agent:main:main"
    main_session_entry: object | None = None
    if main_session:
        try:
            ensured = await ensure_session(
                main_session, config=config, label="Main Agent"
            )
            if isinstance(ensured, dict):
                main_session_entry = ensured.get("entry") or ensured
        except OpenClawGatewayError:
            main_session_entry = None

    return {
        "sessions": sessions_list,
        "main_session_key": main_session,
        "main_session": main_session_entry,
    }


@router.get("/sessions/{session_id}")
async def get_gateway_session(
    session_id: str,
    board_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(require_admin_auth),
) -> dict[str, object]:
    board, config = _require_board_config(session, board_id)
    try:
        sessions = await openclaw_call("sessions.list", config=config)
    except OpenClawGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    if isinstance(sessions, dict):
        sessions_list = list(sessions.get("sessions") or [])
    else:
        sessions_list = list(sessions or [])
    main_session = board.gateway_main_session_key or "agent:main:main"
    if main_session and not any(
        session.get("key") == main_session for session in sessions_list
    ):
        try:
            await ensure_session(main_session, config=config, label="Main Agent")
            refreshed = await openclaw_call("sessions.list", config=config)
            if isinstance(refreshed, dict):
                sessions_list = list(refreshed.get("sessions") or [])
            else:
                sessions_list = list(refreshed or [])
        except OpenClawGatewayError:
            pass
    session_entry = next(
        (item for item in sessions_list if item.get("key") == session_id), None
    )
    if session_entry is None and main_session and session_id == main_session:
        try:
            ensured = await ensure_session(main_session, config=config, label="Main Agent")
            if isinstance(ensured, dict):
                session_entry = ensured.get("entry") or ensured
        except OpenClawGatewayError:
            session_entry = None
    if session_entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return {"session": session_entry}


@router.get("/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    board_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(require_admin_auth),
) -> dict[str, object]:
    _, config = _require_board_config(session, board_id)
    try:
        history = await get_chat_history(session_id, config=config)
    except OpenClawGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    if isinstance(history, dict) and isinstance(history.get("messages"), list):
        return {"history": history["messages"]}
    return {"history": list(history or [])}


@router.post("/sessions/{session_id}/message")
async def send_session_message(
    session_id: str,
    payload: dict = Body(...),
    board_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(require_admin_auth),
) -> dict[str, bool]:
    content = payload.get("content")
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="content is required"
        )
    board, config = _require_board_config(session, board_id)
    try:
        main_session = board.gateway_main_session_key or "agent:main:main"
        if main_session and session_id == main_session:
            await ensure_session(main_session, config=config, label="Main Agent")
        await send_message(content, session_key=session_id, config=config)
    except OpenClawGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"ok": True}
