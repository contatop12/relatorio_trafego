"""
Barramento simples de eventos em arquivo (JSONL) para observabilidade em tempo real.

Permite que processos diferentes (webhook e dashboard) compartilhem os mesmos eventos
sem depender de banco de dados.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

_LOCK = threading.Lock()
_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", ".tmp")
_EVENTS_FILE = os.path.join(_BASE_DIR, "live_events.jsonl")


def _ensure_storage() -> None:
    os.makedirs(_BASE_DIR, exist_ok=True)
    if not os.path.exists(_EVENTS_FILE):
        with open(_EVENTS_FILE, "w", encoding="utf-8"):
            pass


def publish_event(
    *,
    source: str,
    stage: str,
    status: str,
    detail: str,
    client_name: str = "",
    ad_account_id: str = "",
    page_id: str = "",
    group_id: str = "",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Publica um evento no stream compartilhado.

    status recomendado: info|ok|warning|error
    """
    _ensure_storage()
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "stage": stage,
        "status": status,
        "detail": detail,
        "client_name": client_name,
        "ad_account_id": ad_account_id,
        "page_id": page_id,
        "group_id": group_id,
        "payload": payload or {},
    }
    line = json.dumps(event, ensure_ascii=False)
    with _LOCK:
        with open(_EVENTS_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return event


def read_recent_events(limit: int = 400) -> List[Dict[str, Any]]:
    """Lê os eventos mais recentes do arquivo."""
    _ensure_storage()
    if limit <= 0:
        return []
    with _LOCK:
        with open(_EVENTS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
    out: List[Dict[str, Any]] = []
    for raw in lines[-limit:]:
        raw = raw.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                out.append(obj)
        except json.JSONDecodeError:
            continue
    return out


def read_events_since(offset: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    Lê eventos a partir de um offset em bytes.

    Retorna (eventos, novo_offset).
    """
    _ensure_storage()
    if offset < 0:
        offset = 0
    with _LOCK:
        with open(_EVENTS_FILE, "r", encoding="utf-8") as f:
            f.seek(offset)
            chunk = f.read()
            new_offset = f.tell()
    if not chunk:
        return [], new_offset
    events: List[Dict[str, Any]] = []
    for raw in chunk.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                events.append(obj)
        except json.JSONDecodeError:
            continue
    return events, new_offset


def get_events_file_path() -> str:
    _ensure_storage()
    return _EVENTS_FILE
