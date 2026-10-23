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


async def script(message: str, thread_id: str, answered: bool, agent: str = "planner") -> AsyncIterator[dict[str, Any]]:
    if agent == "analyst":
        async for ev in analyst_script(thread_id):
            yield ev
        return
    sleep = asyncio.sleep
    yield _ev(type="run_started", thread_id=thread_id, mode="mock", agent=agent)
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


async def analyst_script(thread_id: str) -> AsyncIterator[dict[str, Any]]:
    """Sample Data Analyst run: parallel data gathering, computation, a checked chart-ready CSV."""
    sleep = asyncio.sleep
    yield _ev(type="run_started", thread_id=thread_id, mode="mock", agent="analyst")
    yield _ev(type="sandbox", status="running", cid=1)
    await sleep(0.6)
    yield _ev(type="thinking", status="running", cid=2, text="Reasoning", model="mock")
    await sleep(1.4)
    yield _ev(type="thinking", status="success", cid=2, text="Reasoning", model="mock")
    yield _ev(type="update", status="success", cid=3, text="[PLAN] Compare rents per m² in 5 areas around NEOMA, then size a 25 m² studio.")
    areas = ["Mont-Saint-Aignan", "Bois-Guillaume", "Rouen Centre"]
    cid = 10
    for a in areas:
        cid += 1
        yield _ev(type="tool", status="running", cid=cid, tool="subagent", text=f"Gather official rent data for {a}")
        await sleep(0.3)
    for q in ["carte des loyers Seine-Maritime", "observatoire des loyers Rouen"]:
        cid += 1
        yield _ev(type="tool", status="running", cid=cid, tool="datagouv_search_datasets", text=f"Search data.gouv.fr for {q}")
        await sleep(1.0)
        yield _ev(type="tool", status="success", cid=cid, tool="datagouv_search_datasets", text=f"Search data.gouv.fr for {q}", detail="3 datasets")
    for i, a in enumerate(areas):
        await sleep(0.6)
        yield _ev(type="tool", status="success", cid=11 + i, tool="subagent", text=f"Gather official rent data for {a}", detail="data saved")
    yield _ev(type="update", status="success", cid=40, text="[ANALYSE] Computing rent per m² and a 25 m² studio cost for each area.")
    yield _ev(type="tool", status="running", cid=41, tool="execute_code", text="Run Python: rent per m² by area")
    await sleep(1.6)
    yield _ev(type="tool", status="success", cid=41, tool="execute_code", text="Run Python: rent per m² by area")
    yield _ev(type="update", status="success", cid=42, text="[CHART] Writing the chart-ready table and the report.")
    for f in ["results.csv", "analysis.md"]:
        yield _ev(type="tool", status="running", cid=43 if f.endswith("csv") else 44, tool="write_file", text=f"Write {f}")
        await sleep(1.0)
        yield _ev(type="tool", status="success", cid=43 if f.endswith("csv") else 44, tool="write_file", text=f"Write {f}")
    yield _ev(type="update", status="success", cid=45, text="[REVIEW] A second opinion checks the numbers.")
    yield _ev(type="tool", status="running", cid=46, tool="subagent", text="Second opinion: check the rent figures")
    await sleep(1.4)
    yield _ev(type="tool", status="success", cid=46, tool="subagent", text="Second opinion: check the rent figures", detail="figures confirmed")
    files = [
        {"id": "a1", "name": "results.csv", "mimetype": "text/csv", "url": "/mock-files/results.csv"},
        {"id": "a2", "name": "analysis.md", "mimetype": "text/markdown", "url": "/mock-files/analysis.md"},
    ]
    for i, f in enumerate(files):
        yield _ev(type="tool", status="running", cid=50 + i, tool="present_file", text=f"Present {f['name']}")
        await sleep(0.7)
        yield _ev(type="tool", status="success", cid=50 + i, tool="present_file", text=f"Present {f['name']}")
    yield _ev(type="result", status="success", cost="0.31", questions=[], files=files, reply=(
        "**Sample analysis (mock mode).** A 25 m² studio fits a €600 budget in every area except Rouen Centre.\n\n"
        "Summary of deliverables\n1. Data — `results.csv`: rent per m² by area, ready to chart.\n"
        "2. Report — `analysis.md`: method, table, answer, sources and caveats."))
