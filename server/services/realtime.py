import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)

    async def broadcast(self, event: str, payload: Any) -> None:
        message = {"event": event, "payload": payload}
        stale: list[WebSocket] = []
        async with self._lock:
            for conn in self._connections:
                try:
                    await conn.send_json(message)
                except Exception:
                    stale.append(conn)
            for conn in stale:
                self._connections.remove(conn)


manager = ConnectionManager()
