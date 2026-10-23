# Agent City

**Your move to France, handled by a team of AI agents — and you can watch every one of them work.**

Agent City is an agent-native app built on **[Cominty](https://cominty.ai) Managed Agents**. An international student describes what they need ("I arrive at NEOMA in Rouen on 4 January — find me a neighbourhood, write to landlords, and put my admin deadlines in my calendar"). A Cominty agent team does the work: it asks the questions that matter, researches in parallel, writes, reviews, generates visuals and puts real events in Google Calendar.

Every step is shown live in a 3D Paris. Each robot you see is a real event streamed from the Cominty SDK.

## The problem

Moving to France as an international student means housing, French-language landlord emails, visa validation (OFII), CAF housing aid, a bank account, insurance — with deadlines, in a language you are still learning. Advice exists, but nobody does the work for you.

## What the agents actually do

| Step | What happens (real Cominty capability) | In the city |
|---|---|---|
| Understand | The agent asks structured questions before acting (`questions`) | A courier robot brings a form to **Your Desk** |
| Research | **Parallel subagents**, one per neighbourhood; web search + official sources | Researchers and scouts walk to the **Library (Panthéon)** |
| Create | Writes comparison + bilingual landlord email; **generates a poster** | Writers at the **Writers' Café**, an artist in **Montmartre** |
| Review | A **reviewer subagent** checks the files and the agent applies fixes | A reviewer at the **Town Hall** |
| Act & deliver | **Creates Google Calendar events** (after you confirm) and delivers files | Operators at the **Workshop (Pompidou)**, files land on your desk |

The agent never sends, pays or signs anything on your behalf: it prepares, asks, and acts only after confirmation.

## How Cominty is integrated

- **Managed Agent** "City Planner" (definition in `city-planner.agent.json`): Claude Sonnet 5 with GPT and Gemini failovers, web search, image generation, memory, subagents, workflows, second opinion, Google Calendar and DataGouv integrations.
- **Python SDK** (`cominty-sdk`) in `server.py`:
  - `chat.start` / `chat.send` to run missions and answer the agent's questions in the same thread,
  - streaming **progress events** (`llm`, `tool_call`, `intermediary_update`, `result`) forwarded to the browser over SSE,
  - `chat.download_file` to deliver the agent's files,
  - `memory.list` to show what the agent remembers.
- The browser (`static/`) maps each event to the city: tool name → role and building, `[TAG]` progress lines → captions and the mission tracker.

## Run it locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add COMINTY_API_KEY, COMINTY_USER_ID, COMINTY_AGENT_ID
uvicorn server:app --port 8000
```

Open http://localhost:8000 (or `/?lite` on older laptops). Without keys it runs a scripted **mock mode**.

## Recordings and replay

Every live session is saved in `recordings/` with the files the agents produced. The deployed demo plays a **real recorded run** for visitors; live runs are protected by `AGENT_CITY_PASSCODE` so the demo can't spend credits.

## Deploy (Render)

`render.yaml` is included: New → Blueprint → this repo, then set `COMINTY_API_KEY`, `COMINTY_USER_ID`, `COMINTY_AGENT_ID` and `AGENT_CITY_PASSCODE`.

---
Built by Sujai Samraj for the Cominty Agent-Native Product Challenge. 3D: Three.js. Landmarks are stylised, not to scale.
