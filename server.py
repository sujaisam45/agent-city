"""Agent City — a live 3D city where Cominty Managed Agents do real work.

This server is the bridge between the browser and Cominty:
  * starts / continues a conversation with your Cominty agent (cominty-sdk),
  * streams every progress event (thinking, tool calls, questions, files) to the
    browser as Server-Sent Events, so the city can animate them live,
  * downloads the files the agent produced and serves them to the browser,
  * records every real session so it can be replayed later (great for demos),
  * falls back to a scripted MOCK mode when no API key is configured.

Run:  uvicorn server:app --reload --port 8000   then open http://localhost:8000
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import mock_agent

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

API_KEY = os.getenv("COMINTY_API_KEY", "").strip()
USER_ID = os.getenv("COMINTY_USER_ID", "").strip()
AGENT_ID = os.getenv("COMINTY_AGENT_ID", "").strip()
MEMORY_NS = os.getenv("COMINTY_MEMORY_NAMESPACE", "city-planner").strip()
FORCE_MOCK = os.getenv("AGENT_CITY_MOCK", "").strip() in {"1", "true", "yes"}
# When deployed publicly, live runs (which spend Cominty credits) need this passcode.
PASSCODE = os.getenv("AGENT_CITY_PASSCODE", "").strip()
LIVE = bool(API_KEY and USER_ID and AGENT_ID) and not FORCE_MOCK

REC_DIR = ROOT / "recordings"
REC_DIR.mkdir(exist_ok=True)

client = None  # AsyncCominty, created at startup in live mode


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global client
    if LIVE:
        from cominty_sdk import AsyncCominty

        client = AsyncCominty(api_token=API_KEY, user_id=USER_ID, timeout=120)
        print(f"[agent-city] LIVE mode — agent {AGENT_ID}")
    else:
        missing = [k for k, v in {"COMINTY_API_KEY": API_KEY, "COMINTY_USER_ID": USER_ID,
                                  "COMINTY_AGENT_ID": AGENT_ID}.items() if not v]
        why = "AGENT_CITY_MOCK is on" if FORCE_MOCK else f"missing in .env: {', '.join(missing)}"
        print(f"[agent-city] MOCK mode ({why}). .env looked for at: {ROOT / '.env'}")
    yield
    if client is not None:
        await client.close()


app = FastAPI(title="Agent City", lifespan=lifespan)


@app.middleware("http")
async def no_cache(request: Request, call_next):
    """Always serve the latest files, so design updates show up on a normal refresh."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


# --------------------------------------------------------------------------- #
# Runs: one assistant turn, broadcast to the browser as an event list
# --------------------------------------------------------------------------- #
class Run:
    def __init__(self) -> None:
        self.id = uuid.uuid4().hex
        self.events: list[dict[str, Any]] = []
        self.done = False
        self.cond = asyncio.Condition()

    async def emit(self, ev: dict[str, Any]) -> None:
        ev.setdefault("ts", time.time())
        async with self.cond:
            self.events.append(ev)
            self.cond.notify_all()

    async def finish(self) -> None:
        async with self.cond:
            self.done = True
            self.cond.notify_all()


RUNS: dict[str, Run] = {}


def _safe_name(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip() or "file"
    return name[:120]


class Recorder:
    """Writes a session (all turns of one thread) to recordings/<thread>/."""

    def __init__(self, thread_id: str, message: str) -> None:
        self.dir = REC_DIR / _safe_name(thread_id)
        (self.dir / "files").mkdir(parents=True, exist_ok=True)
        self.path = self.dir / "session.json"
        self.raw = self.dir / "raw-events.jsonl"
        if self.path.exists():
            self.session = json.loads(self.path.read_text())
        else:
            self.session = {"thread_id": thread_id, "title": message[:80],
                            "created": time.time(), "turns": []}
        self.turn = {"message": message, "events": []}
        self.session["turns"].append(self.turn)
        self.t0 = time.time()

    def add(self, ev: dict[str, Any]) -> None:
        self.turn["events"].append({"dt": round(time.time() - self.t0, 3),
                                    "ev": {k: v for k, v in ev.items() if k != "ts"}})
        self.save()

    def add_raw(self, raw: dict[str, Any]) -> None:
        with self.raw.open("a") as f:
            f.write(json.dumps(raw, default=str) + "\n")

    def save_file(self, name: str, data: bytes) -> str:
        fname = _safe_name(name)
        (self.dir / "files" / fname).write_bytes(data)
        return f"/recordings/{self.dir.name}/files/{fname}"

    def save(self) -> None:
        self.path.write_text(json.dumps(self.session, indent=1, default=str))


# --------------------------------------------------------------------------- #
# Live Cominty runs
# --------------------------------------------------------------------------- #
def normalize(ev: Any) -> dict[str, Any] | None:
    """Turn an SDK progress event into the small JSON shape the city understands."""
    n = ev.name
    base = {"cid": getattr(ev, "correlation_id", None), "status": getattr(ev, "status", None)}
    if n == "waiting_for_start":
        return {"type": "waiting", **base}
    if n == "setting_up_sandbox":
        return {"type": "sandbox", **base}
    if n == "uploading_file":
        return {"type": "upload", "text": ev.data.filename, **base}
    if n == "llm":
        return {"type": "thinking", "text": ev.data.description, "model": ev.data.model, **base}
    if n == "intermediary_update":
        return {"type": "update", "text": ev.data.message, **base}
    if n == "tool_call":
        return {"type": "tool", "tool": ev.data.name, "text": ev.data.description,
                "detail": ev.data.message or ev.data.error, **base}
    if n == "result":
        return None  # handled once the terminal message is known
    data = getattr(ev, "data", None)
    return {"type": "other", "name": n, "data": data, **base}


async def live_turn(run: Run, message: str, thread_id: str | None) -> None:
    assert client is not None
    rec: Recorder | None = None

    async def emit(ev: dict[str, Any]) -> None:
        await run.emit(ev)
        if rec:
            rec.add(ev)

    try:
        if thread_id:
            r = await client.chat.send(thread_id, message=message, agent_id=AGENT_ID)
        else:
            r = await client.chat.start(agent_id=AGENT_ID, message=message, name=message[:60])
            thread_id = str(r.thread.id)
        rec = Recorder(thread_id, message)
        await emit({"type": "run_started", "thread_id": thread_id, "mode": "live"})

        cost = None
        async for ev in r:
            try:
                rec.add_raw(ev.model_dump(mode="json"))
            except Exception:  # noqa: BLE001 - logging must never break a run
                pass
            if ev.name == "result":
                cost = str(ev.data.cost.total)
            n = normalize(ev)
            if n:
                await emit(n)

        msg = await r.result()
        files = []
        for f in msg.files or []:
            await emit({"type": "tool", "tool": "deliver", "status": "running",
                        "cid": f"file-{f.id}", "text": f"Bringing {f.name} to your desk"})
            try:
                data = await client.chat.download_file(f.id)
                url = rec.save_file(f.name, data)
                files.append({"id": f.id, "name": f.name, "mimetype": f.mimetype,
                              "size": len(data), "url": url})
            except Exception as exc:  # noqa: BLE001
                files.append({"id": f.id, "name": f.name, "mimetype": f.mimetype,
                              "url": None, "error": str(exc)})
            await emit({"type": "tool", "tool": "deliver", "status": "success",
                        "cid": f"file-{f.id}", "text": f.name})

        questions = [{"prompt": q.prompt, "options": list(q.options)} for q in msg.questions or []]
        await emit({"type": "result", "reply": msg.content, "questions": questions,
                    "files": files, "cost": cost, "status": str(msg.status.value)})

        if MEMORY_NS:
            try:
                items = await client.memory.list(namespace=MEMORY_NS)
                await emit({"type": "memory", "namespace": MEMORY_NS,
                            "items": [{"path": m.path, "purpose": m.purpose} for m in items]})
            except Exception:  # noqa: BLE001
                pass
    except Exception as exc:  # noqa: BLE001
        await emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
    finally:
        await emit({"type": "done"})
        await run.finish()


# --------------------------------------------------------------------------- #
# Mock + replay runs
# --------------------------------------------------------------------------- #
async def mock_turn(run: Run, message: str, thread_id: str | None) -> None:
    answered = bool(thread_id)
    thread_id = thread_id or f"mock-{uuid.uuid4().hex[:8]}"
    try:
        async for ev in mock_agent.script(message, thread_id, answered=answered):
            await run.emit(ev)
    except Exception as exc:  # noqa: BLE001
        await run.emit({"type": "error", "message": str(exc)})
    finally:
        await run.emit({"type": "done"})
        await run.finish()


async def replay_turn(run: Run, session: dict[str, Any], turn_ix: int, speed: float) -> None:
    turns = session["turns"]
    turn = turns[turn_ix]
    prev = 0.0
    try:
        for item in turn["events"]:
            gap = max(0.0, item["dt"] - prev)
            prev = item["dt"]
            # Compress long waits (an agent thinking for 40 s) so demos stay snappy.
            await asyncio.sleep(min(gap, 5.0) / max(speed, 0.1))
            ev = dict(item["ev"])
            if ev.get("type") == "done":
                continue
            if ev.get("type") == "run_started":
                ev["mode"] = "replay"
            if ev.get("type") == "result" and turn_ix + 1 < len(turns):
                ev["replay_next"] = {"turn": turn_ix + 1,
                                     "message": turns[turn_ix + 1]["message"]}
            await run.emit(ev)
    except Exception as exc:  # noqa: BLE001
        await run.emit({"type": "error", "message": str(exc)})
    finally:
        await run.emit({"type": "done"})
        await run.finish()


# --------------------------------------------------------------------------- #
# HTTP API
# --------------------------------------------------------------------------- #
def list_recordings() -> list[dict[str, Any]]:
    out = []
    for p in sorted(REC_DIR.glob("*/session.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            s = json.loads(p.read_text())
            turns = s.get("turns", [])
            out.append({"id": p.parent.name, "title": s.get("title", p.parent.name),
                        "goal": turns[0]["message"] if turns else "",
                        "turns": len(s.get("turns", [])), "created": s.get("created")})
        except Exception:  # noqa: BLE001
            continue
    out.sort(key=lambda r: r.get("created") or 0, reverse=True)
    return out


@app.get("/api/config")
async def config() -> dict[str, Any]:
    return {"mode": "live" if LIVE else "mock", "agent_id": AGENT_ID if LIVE else None,
            "locked": bool(LIVE and PASSCODE),
            "memory_namespace": MEMORY_NS, "recordings": list_recordings()}


@app.post("/api/runs")
async def start_run(req: Request) -> dict[str, str]:
    body = await req.json()
    message = str(body.get("message", "")).strip()
    if not message:
        raise HTTPException(400, "message is required")
    thread_id = body.get("thread_id") or None
    if LIVE and PASSCODE and str(body.get("passcode", "")).strip() != PASSCODE:
        raise HTTPException(403, "passcode")
    run = Run()
    RUNS[run.id] = run
    if LIVE:
        asyncio.create_task(live_turn(run, message, thread_id))
    else:
        asyncio.create_task(mock_turn(run, message, thread_id))
    return {"run_id": run.id}


@app.post("/api/replay")
async def start_replay(req: Request) -> dict[str, str]:
    body = await req.json()
    sid = _safe_name(str(body.get("session", "")))
    path = REC_DIR / sid / "session.json"
    if not path.exists():
        raise HTTPException(404, "recording not found")
    session = json.loads(path.read_text())
    turn = int(body.get("turn", 0))
    if not 0 <= turn < len(session["turns"]):
        raise HTTPException(400, "no such turn")
    run = Run()
    RUNS[run.id] = run
    asyncio.create_task(replay_turn(run, session, turn, float(body.get("speed", 2.0))))
    return {"run_id": run.id}


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str, request: Request, offset: int = 0) -> StreamingResponse:
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(404, "unknown run")

    async def gen():
        i = max(0, offset)
        while True:
            if await request.is_disconnected():
                return
            async with run.cond:
                if i >= len(run.events) and not run.done:
                    try:
                        await asyncio.wait_for(run.cond.wait(), timeout=15)
                    except asyncio.TimeoutError:
                        pass
                batch = run.events[i:]
                finished = run.done
            if not batch:
                if finished:
                    return
                yield ": keep-alive\n\n"
                continue
            for ev in batch:
                yield f"data: {json.dumps(ev, default=str)}\n\n"
            i += len(batch)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.mount("/recordings", StaticFiles(directory=REC_DIR), name="recordings")
app.mount("/mock-files", StaticFiles(directory=ROOT / "mock_files"), name="mock-files")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(ROOT / "static" / "index.html")


app.mount("/", StaticFiles(directory=ROOT / "static"), name="static")


@app.exception_handler(Exception)
async def _err(_req: Request, exc: Exception) -> JSONResponse:
    return JSONResponse({"error": str(exc)}, status_code=500)
