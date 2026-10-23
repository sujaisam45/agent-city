"""Scripted stand-in for a Cominty agent, used when no API key is configured.

It emits the same event shapes the server produces from real Cominty runs, so the
city can be developed and tested offline. Everything it says is clearly sample data.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import AsyncIterator
from typing import Any


def _ev(**kw: Any) -> dict[str, Any]:
    return kw


async def script(message: str, thread_id: str, answered: bool) -> AsyncIterator[dict[str, Any]]:
    sleep = asyncio.sleep
    yield _ev(type="run_started", thread_id=thread_id, mode="mock")
    yield _ev(type="sandbox", status="running", cid=1)
    await sleep(0.8)
    yield _ev(type="sandbox", status="success", cid=1)

    if not answered:
        yield _ev(type="thinking", status="running", cid=2, text="Reasoning", model="mock")
        await sleep(2.0)
        yield _ev(type="thinking", status="success", cid=2, text="Reasoning", model="mock")
        yield _ev(type="update", status="success", cid=3,
                  text="[ASK] Before I compare neighbourhoods, two details will change the plan.")
        await sleep(0.6)
        yield _ev(type="result", reply="Two quick questions before I start.", files=[], cost="0.01",
                  status="success", questions=[
                      {"prompt": "What is your monthly rent budget?",
                       "options": ["Up to €550", "Up to €700", "Up to €900"]},
                      {"prompt": "Do you want to live alone or share a flat?",
                       "options": ["Studio alone", "Shared flat (colocation)", "Either"]},
                  ])
        return

    cid = 10

    def nxt() -> int:
        nonlocal cid
        cid += 1
        return cid

    c = nxt()
    yield _ev(type="thinking", status="running", cid=c, text="Planning the move in phases", model="mock")
    await sleep(1.5)
    yield _ev(type="thinking", status="success", cid=c, text="Planning the move in phases", model="mock")
    yield _ev(type="update", status="success", cid=nxt(),
              text="[PLAN] Splitting the search: one researcher per neighbourhood, working in parallel.")

    hoods = ["Mont-Saint-Aignan", "Rive Gauche (Saint-Sever)", "Centre / Vieux-Marché"]
    sub_ids = []
    for h in hoods:
        s = nxt()
        sub_ids.append((s, h))
        yield _ev(type="tool", status="running", cid=s, tool="run_subagent",
                  text=f"Researcher: rents, transport and student life in {h}")
        await sleep(0.4)

    searches = [
        "average studio rent Mont-Saint-Aignan 2026",
        "TEOR bus line T1 NEOMA travel time",
        "Saint-Sever Rouen student rent colocation",
        "Rouen Vieux-Marché studio prices",
        "Mont-Saint-Aignan student residences CROUS",
        "Rouen metro Saint-Sever to Mont-Saint-Aignan",
    ]
    for q in searches:
        s = nxt()
        yield _ev(type="tool", status="running", cid=s, tool="search_web", text=f"Search {q}")
        await sleep(random.uniform(0.6, 1.2))
        yield _ev(type="tool", status="success", cid=s, tool="search_web", text=f"Search {q}",
                  detail="6 results")

    for s, h in sub_ids:
        await sleep(0.7)
        yield _ev(type="tool", status="success", cid=s, tool="run_subagent",
                  text=f"Researcher: rents, transport and student life in {h}",
                  detail=f"Report on {h} ready")

    c = nxt()
    yield _ev(type="thinking", status="running", cid=c, text="Comparing the three reports", model="mock")
    await sleep(1.8)
    yield _ev(type="thinking", status="success", cid=c, text="Comparing the three reports", model="mock")

    yield _ev(type="update", status="success", cid=nxt(), text="[WRITE] Writing your move plan and the landlord emails.")
    for f, d in [("move-plan.md", "Write move plan to move-plan.md"),
                 ("landlord-emails.md", "Write landlord emails to landlord-emails.md")]:
        s = nxt()
        yield _ev(type="tool", status="running", cid=s, tool="write_file", text=d)
        await sleep(1.4)
        yield _ev(type="tool", status="success", cid=s, tool="write_file", text=d)

    yield _ev(type="update", status="success", cid=nxt(), text="[IMAGE] Drawing a neighbourhood comparison card.")
    s = nxt()
    yield _ev(type="tool", status="running", cid=s, tool="generate_image",
              text="Create a neighbourhood comparison card for Rouen")
    await sleep(2.5)
    yield _ev(type="tool", status="success", cid=s, tool="generate_image",
              text="Create a neighbourhood comparison card for Rouen")

    yield _ev(type="update", status="success", cid=nxt(), text="[REVIEW] A reviewer is checking the emails against your brief.")
    s = nxt()
    yield _ev(type="tool", status="running", cid=s, tool="run_subagent",
              text="Reviewer: check landlord emails against the brief")
    s2 = nxt()
    yield _ev(type="tool", status="running", cid=s2, tool="read_file", text="Read landlord-emails.md")
    await sleep(1.2)
    yield _ev(type="tool", status="success", cid=s2, tool="read_file", text="Read landlord-emails.md")
    await sleep(1.0)
    yield _ev(type="tool", status="success", cid=s, tool="run_subagent",
              text="Reviewer: check landlord emails against the brief", detail="1 fix suggested, applied")

    s = nxt()
    yield _ev(type="tool", status="running", cid=s, tool="memory_write",
              text="Remember: budget and flat type for the move")
    await sleep(0.8)
    yield _ev(type="tool", status="success", cid=s, tool="memory_write",
              text="Remember: budget and flat type for the move")

    files = [
        {"id": "m1", "name": "move-plan.md", "mimetype": "text/markdown", "url": "/mock-files/move-plan.md"},
        {"id": "m2", "name": "landlord-emails.md", "mimetype": "text/markdown", "url": "/mock-files/landlord-emails.md"},
        {"id": "m3", "name": "rouen-neighbourhoods.svg", "mimetype": "image/svg+xml",
         "url": "/mock-files/rouen-neighbourhoods.svg"},
    ]
    for f in files:
        s = nxt()
        yield _ev(type="tool", status="running", cid=s, tool="present_file", text=f"Present {f['name']}")
        await sleep(0.9)
        yield _ev(type="tool", status="success", cid=s, tool="present_file", text=f"Present {f['name']}")

    yield _ev(type="result", status="success", cost="0.42", questions=[], files=files, reply=(
        "**Sample run (mock mode).** Your move plan is ready.\n\n"
        "Summary of deliverables\n"
        "1. Plan — `move-plan.md`: timeline, budget and checklist.\n"
        "2. Email — `landlord-emails.md`: two ready-to-send landlord emails.\n"
        "3. Image — `rouen-neighbourhoods.svg`: comparison card."))
    yield _ev(type="memory", namespace="city-planner",
              items=[{"path": "/move/preferences.md", "purpose": "Budget and flat type for the Rouen move"}])
