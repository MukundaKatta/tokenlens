# TokenLens

> See Every Dollar Your AI Spends

## Overview

TokenLens tracks and optimizes LLM API costs across your organization. Monitor token usage by team, project, and model, set budgets, get alerts, and identify optimization opportunities.

## Key Features

- **Real-Time Cost Tracking** — Per-request cost monitoring across all LLM providers
- **Team/Project Breakdown** — Allocate costs by department, project, or feature
- **Budget Alerts** — Set spending limits with Slack/email notifications
- **Model Comparison** — Cost-per-quality analysis across models
- **Optimization Suggestions** — AI recommends prompt compression and model routing
- **Usage Analytics** — Token consumption trends and forecasting

## Tech Stack

Python, FastAPI, PostgreSQL, TimescaleDB, React, Recharts

## Getting Started

```bash
git clone https://github.com/MukundaKatta/tokenlens.git
cd tokenlens && pip install -e .
tokenlens track --provider anthropic --api-key $KEY
```

---

**Mukunda Katta** · [Officethree Technologies](https://github.com/MukundaKatta/Office3) · 2026
