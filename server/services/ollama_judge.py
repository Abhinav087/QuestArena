"""
Ollama-based code judge for the final coding challenge (Level 5).

Sends the question + student code to a locally running Ollama instance
and returns True if the model decides the solution is correct.

Model expected: qwen2.5-coder:1.5b  (run `ollama pull qwen2.5-coder:1.5b`)
Ollama must be running locally on port 11434.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:1.5b"

_PROMPT_TEMPLATE = """Task: {question}

Submission:
{code}

Does this submission correctly solve the task? Reply with one word only: CORRECT or WRONG."""


async def judge_code(question: str, code: str) -> bool:
    """
    Ask Ollama to judge whether `code` correctly solves `question`.

    Returns True  → model says CORRECT
    Returns False → model says WRONG or Ollama is unavailable
    """
    prompt = _PROMPT_TEMPLATE.format(question=question.strip(), code=code.strip())
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0,       # deterministic
            "num_predict": 5,       # we only need one word
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            verdict = data.get("response", "").strip().upper()
            logger.info("Ollama verdict for submission: %r", verdict)
            return "CORRECT" in verdict
    except httpx.ConnectError:
        logger.warning("Ollama is not running at %s — falling back to WRONG", OLLAMA_URL)
    except Exception as exc:
        logger.warning("Ollama judge error: %s — falling back to WRONG", exc)

    return False
