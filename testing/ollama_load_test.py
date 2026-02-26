"""
Ollama Judge Load Test
======================
Sends 60 concurrent judging requests to the local Ollama instance
and logs timing for every single request + overall stats.

Usage:
    python testing/ollama_load_test.py

Requires: httpx  (pip install httpx)
"""

import asyncio
import time
import statistics

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen2.5-coder:1.5b"
CONCURRENT_REQUESTS = 60

# ---------- prompt (same as production judge — chat API) ----------
SYSTEM_PROMPT = (
    "You are a strict code judge. You decide if code correctly solves a given programming task.\n"
    "Rules:\n"
    "- The code MUST produce the correct result for ALL possible inputs.\n"
    "- Variable names and coding style do NOT matter. Only correctness matters.\n"
    "- If the code hardcodes or directly prints the expected output instead of computing it, say WRONG.\n"
    "- If the code does nothing, returns the wrong value, or uses the wrong operation, say WRONG.\n"
    "Reply with ONLY one word: CORRECT or WRONG."
)

QUESTION = "Write a function solve(a, b) that returns the sum of two integers."

# Mix of correct and wrong submissions to make it realistic
TEST_CASES = [
    # correct
    {"code": "def solve(a, b):\n    return a + b",                   "expected": True},
    {"code": "def solve(a, b):\n    return a+b",                     "expected": True},
    {"code": "def solve(a,b):\n    s = a + b\n    return s",         "expected": True},
    {"code": "def solve(x, y):\n    return x + y",                   "expected": True},
    {"code": "def solve(a, b):\n    return sum([a, b])",             "expected": True},
    # wrong
    {"code": "def solve(a, b):\n    return a - b",                   "expected": False},
    {"code": "def solve(a, b):\n    return a * b",                   "expected": False},
    {"code": "def solve(a, b):\n    return a",                       "expected": False},
    {"code": "def solve(a, b):\n    pass",                           "expected": False},
    {"code": "def solve(a, b):\n    return 0",                       "expected": False},
    # cheat (hardcoded output)
    {"code": "def solve(a, b):\n    return 3",                       "expected": False},
    {"code": "print(3)",                                              "expected": False},
]


async def judge_one(
    client: httpx.AsyncClient,
    request_id: int,
    code: str,
    expected: bool,
    results: list,
):
    """Send a single judge request and record timing + verdict."""
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Task: {QUESTION}\n\nCode:\n{code}"},
        ],
        "stream": False,
        "options": {"temperature": 0, "num_predict": 5},
    }

    start = time.perf_counter()
    try:
        resp = await client.post(OLLAMA_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        verdict_raw = data.get("message", {}).get("content", "").strip()
        is_correct = "CORRECT" in verdict_raw.upper()
        elapsed = time.perf_counter() - start
        matched = is_correct == expected
        results.append({
            "id": request_id,
            "elapsed_s": round(elapsed, 3),
            "verdict": verdict_raw,
            "expected_correct": expected,
            "judge_agreed": matched,
            "status": "OK",
        })
    except Exception as exc:
        elapsed = time.perf_counter() - start
        results.append({
            "id": request_id,
            "elapsed_s": round(elapsed, 3),
            "verdict": None,
            "expected_correct": expected,
            "judge_agreed": False,
            "status": f"ERROR: {exc}",
        })


async def main():
    print("=" * 70)
    print(f"  Ollama Judge Load Test — {CONCURRENT_REQUESTS} concurrent requests")
    print(f"  Model : {MODEL_NAME}")
    print(f"  Target: {OLLAMA_URL}")
    print("=" * 70)
    print()

    # Build 60 tasks cycling through the 10 test cases
    tasks_meta = []
    for i in range(CONCURRENT_REQUESTS):
        tc = TEST_CASES[i % len(TEST_CASES)]
        tasks_meta.append((i + 1, tc["code"], tc["expected"]))

    results: list[dict] = []

    # Use a single client with high connection limits
    limits = httpx.Limits(max_connections=CONCURRENT_REQUESTS, max_keepalive_connections=CONCURRENT_REQUESTS)
    async with httpx.AsyncClient(timeout=120.0, limits=limits) as client:
        # Warm-up: single request so the model is loaded in memory
        print("[warm-up] Sending 1 request to pre-load model...")
        warmup_start = time.perf_counter()
        warmup_resp = await client.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": "Say OK",
            "stream": False,
            "options": {"num_predict": 3},
        })
        warmup_time = time.perf_counter() - warmup_start
        print(f"[warm-up] Done in {warmup_time:.2f}s  (response: {warmup_resp.json().get('response', '').strip()!r})")
        print()

        # Fire all 60 requests at once
        print(f"[load test] Launching {CONCURRENT_REQUESTS} requests simultaneously...")
        overall_start = time.perf_counter()

        await asyncio.gather(*(
            judge_one(client, rid, code, expected, results)
            for rid, code, expected in tasks_meta
        ))

        overall_elapsed = time.perf_counter() - overall_start

    # Sort by request id
    results.sort(key=lambda r: r["id"])

    # Print per-request log
    print()
    print(f"{'#':>3}  {'Time (s)':>9}  {'Verdict':>10}  {'Expected':>10}  {'Match':>6}  Status")
    print("-" * 70)
    for r in results:
        exp_label = "CORRECT" if r["expected_correct"] else "WRONG"
        match_label = "✓" if r["judge_agreed"] else "✗"
        verdict = r["verdict"] or "—"
        print(f"{r['id']:>3}  {r['elapsed_s']:>9.3f}  {verdict:>10}  {exp_label:>10}  {match_label:>6}  {r['status']}")

    # Stats
    times = [r["elapsed_s"] for r in results if r["status"] == "OK"]
    ok_count = sum(1 for r in results if r["status"] == "OK")
    err_count = CONCURRENT_REQUESTS - ok_count
    correct_judge = sum(1 for r in results if r["judge_agreed"])

    print()
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"  Total requests   : {CONCURRENT_REQUESTS}")
    print(f"  Successful       : {ok_count}")
    print(f"  Errors           : {err_count}")
    print(f"  Judge accuracy   : {correct_judge}/{ok_count} ({correct_judge/max(ok_count,1)*100:.1f}%)")
    print()
    print(f"  Wall-clock time  : {overall_elapsed:.2f}s")
    if times:
        print(f"  Avg latency      : {statistics.mean(times):.2f}s")
        print(f"  Median latency   : {statistics.median(times):.2f}s")
        print(f"  Min latency      : {min(times):.2f}s")
        print(f"  Max latency      : {max(times):.2f}s")
        print(f"  Std dev          : {statistics.stdev(times):.2f}s" if len(times) > 1 else "")
        print(f"  Throughput       : {ok_count / overall_elapsed:.2f} req/s")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
