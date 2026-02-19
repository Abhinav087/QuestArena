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
        async with self._lock:
            connections = list(self._connections)

        stale: list[WebSocket] = []
        for conn in connections:
            try:
                await asyncio.wait_for(conn.send_json(message), timeout=2.0)
            except Exception:
                stale.append(conn)

        if stale:
            async with self._lock:
                for conn in stale:
                    self._connections.discard(conn)


manager = ConnectionManager()
