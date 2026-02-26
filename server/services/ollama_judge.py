"""
Ollama-based code judge for the final coding challenge (Level 5).

Uses the chat API with a strict system prompt for reliable judging,
even with the small qwen2.5-coder:1.5b model.

A global asyncio.Semaphore caps concurrent Ollama calls so requests are
queued instead of overwhelming the model under load.

Model expected: qwen2.5-coder:1.5b  (run `ollama pull qwen2.5-coder:1.5b`)
Ollama must be running locally on port 11434.
"""

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

# ── Ollama config ───────────────────────────────────────────────────
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen2.5-coder:1.5b"

# Max concurrent Ollama requests — prevents queue explosion under load.
MAX_CONCURRENT = 5
_ollama_semaphore = asyncio.Semaphore(MAX_CONCURRENT)

# ── Prompt ──────────────────────────────────────────────────────────
_SYSTEM_PROMPT = (
    "You are a strict code judge. You decide if code correctly solves a given programming task.\n"
    "Rules:\n"
    "- The code MUST produce the correct result for ALL possible inputs.\n"
    "- Variable names and coding style do NOT matter. Only correctness matters.\n"
    "- If the code hardcodes or directly prints the expected output instead of computing it, say WRONG.\n"
    "- If the code does nothing, returns the wrong value, or uses the wrong operation, say WRONG.\n"
    "Reply with ONLY one word: CORRECT or WRONG."
)


async def judge_code(question: str, code: str) -> bool:
    """
    Ask Ollama to judge whether `code` correctly solves `question`.

    Requests are queued through a semaphore so concurrent traffic
    doesn't overwhelm the model.

    Returns True  → model says CORRECT
    Returns False → model says WRONG or Ollama is unavailable
    """
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Task: {question.strip()}\n\nCode:\n{code.strip()}"},
        ],
        "stream": False,
        "options": {
            "temperature": 0,       # deterministic
            "num_predict": 5,       # we only need one word
        },
    }

    async with _ollama_semaphore:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(OLLAMA_URL, json=payload)
                resp.raise_for_status()
                data = resp.json()
                verdict = data.get("message", {}).get("content", "").strip().upper()
                logger.info("Ollama verdict for submission: %r", verdict)
                return "CORRECT" in verdict
        except httpx.ConnectError:
            logger.warning(
                "Ollama is not running at %s — falling back to WRONG", OLLAMA_URL
            )
        except Exception as exc:
            logger.warning("Ollama judge error: %s — falling back to WRONG", exc)

    return False
