# DRep Delegator Feedback System

Tools and workflows for Cardano delegators to share feedback with their chosen DReps, and for DReps to better understand, track, and respond to their delegators’ preferences.

This repository is created as part of a Project Catalyst initiative by **SIDAN Lab** to improve the signal flow between ADA holders and governance representatives.

---

## Goals

- Make it easy for **delegators** to:
  - Share feedback with their DRep (preferences, concerns, priorities).
  - Understand how their DRep is voting and why.
- Help **DReps** to:
  - Aggregate delegator feedback in one place.
  - Visualize priorities and sentiment from their delegators.
  - Use that feedback as input for future governance decisions.

---

## Repository structure

> ⚠️ Work in progress  
> The structure below is tentative and will be updated as the project evolves.

- `discord-bot/` – discord-bot to interact with the dedicated discord channel to gather delegator feedback.
- `frontend/` – Web UI for delegators and DReps to submit and review feedback.
- `api/` – APIs, data model, and integration with Cardano governance data, acting as the connector between web frontend and discord-bot.

---

## Maintainers

- Anson Chui (GitHub Handle: Anson SIDAN) - Project Lead & SIDAN Lab Governance Lead
- Jackal Leung (GitHub Handle: leuhk) - Technical Program Manager
- Ken Lau (GitHub Handle: kenlau666) - Software Engineer

---

## Getting started

At this early stage, there is no runnable code yet. Once the first implementation lands, this section will be updated with:

1. **Prerequisites**

   - Node.js / Rust / other toolchains (TBD)
   - Environment variables and configuration

2. **Local development**

   ```bash
   git clone https://github.com/sidan-lab/drep-delegator-feedback-system.git
   cd drep-delegator-feedback-system

   # TODO: add setup steps when implementation is ready
   ```
