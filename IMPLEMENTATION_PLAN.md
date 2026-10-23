# Rafiq Social Agent (Capstone TA) Implementation Plan

> **For agentic workers:** Implementation follows clean layered architecture using Mastra, TypeScript, Zod, and OmniRoute AI proxy endpoint (`http://localhost:20128/v1`).

**Goal:** Build a complete, production-grade agentic social media management backend implementing the 8 core domains of Rafiq Worker: Context Scoping, Campaign Strategy Setup, Autonomous Trend Research, Content Plan Matrix (Macro-HITL), Canonical Content Synthesis, Multi-Platform Deterministic Adapters, Scheduling Engine, and Closed-Loop Analytics.

**Architecture:** Layered modular Domain-Driven Architecture (Domain Models, Services, Workflows/Mastra Agents, Adapters/Tools, and Express/REST Controller API).
**Tech Stack:** Node.js (v24), TypeScript, Mastra Agentic Framework, Zod Schema Enforcement, Axios/Fetch, OmniRoute API Gateway (`http://localhost:20128/v1`, Model: `test-combo`), Vitest.

---

## Global Constraints
- Target workspace: `/opt/projects/rafiq_social_agent`
- Language: TypeScript (strict mode, ESNext modules)
- LLM Provider: OmniRoute OpenAI-compatible endpoint at `http://localhost:20128/v1` with model `test-combo`
- Validation: Zod schemas for all domain I/O and platform payloads
- Testing: Vitest unit & integration test suites
- Execution: Structured task execution with progress reporting after every task milestone.

---

## Task Breakdown & Roadmap

### Task 1: Project Scaffolding & Configuration
- Package.json with dependencies (`@mastra/core`, `zod`, `express`, `dotenv`, `cors`, `vitest`, `typescript`, `ts-node-dev`).
- `tsconfig.json` configured for clean Node module resolution.
- Environment configuration (`.env.example` and `.env` pointed to OmniRoute).
- Base directory structure setup (`src/domain`, `src/services`, `src/agents`, `src/tools`, `src/adapters`, `src/server`, `tests`).

### Task 2: Domain 1 — Context Scoping & Tenancy Entities
- Data models & Zod schemas for `Company`, `Project`, and `Application`.
- `TenantContext` isolation manager ensuring strict boundary checks.
- Unit tests for Tenancy & Scoping.

### Task 3: Domain 2 & 3 — Trend Research & Campaign Strategy Engine
- Mastra Web/Trend Search Tool (`trendResearchTool`) & Intelligence Extractor.
- Campaign Strategy setup agent extracting target audience, ICP, pillars, and goals.
- Unit tests verifying strategy extraction and research synthesis.

### Task 4: Domain 4 — Content Plan Matrix & Macro-HITL State Machine
- `ContentPlanMatrix` generator creating 15-topic batch grids with dates, hooks, pillars, and platforms.
- Macro-HITL Approval State Machine (`DRAFT` ➔ `PENDING_REVIEW` ➔ `APPROVED` / `REVISION_REQUESTED`).
- Chat mutation handler for adjusting specific topics in the matrix.
- Unit tests for Matrix generation and approval state transitions.

### Task 5: Domain 5 — Canonical Content Synthesis Engine
- Master Prompt Chain for deep Canonical Content generation (Thesis, multi-hooks, key arguments, facts/references, CTAs).
- Brand Voice & Tone enforcement.
- Unit tests verifying structured master content generation without platform bleed.

### Task 6: Domain 6 — Deterministic Multi-Platform Adapters (Zod Validated)
- `XPlatformAdapter`: Single post (<=280 chars) & Thread generator.
- `LinkedInPlatformAdapter`: Professional line spacing, hook gating, discussion CTA.
- `InstagramPlatformAdapter`: Caption formatting, visual/carousel prompt, curated hashtags.
- `MediumPlatformAdapter`: Long-form structured Markdown with headers and formatting.
- Unit tests validating strict platform character & schema constraints.

### Task 7: Domain 7 & 8 — Cloud Queue Scheduler & Closed-Loop Analytics
- In-memory / persistent Queue Simulator & Dispatcher for scheduled posting.
- Closed-Loop Analytics ingestion & Proactive Strategy Feedback Generator.
- Unit tests for publishing workflow and analytics loop.

### Task 8: REST API Gateway & Master Orchestrator Integration
- Express API server exposing endpoints for:
  - Tenancy management
  - Campaign chat & strategy initialization
  - Matrix generation & 1-click Macro HITL approval
  - Canonical & platform post compilation
  - Queue dispatch & analytics summary
- End-to-end integration test verifying full lifecycle (*Chat ➔ Plan ➔ HITL Approve ➔ Canonical ➔ Multi-Platform ➔ Schedule*).
