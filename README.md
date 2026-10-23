# Rafiq Social Media AI Agent (Socialpal Backend)

Backend engine AI Agent untuk otomatisasi pengelolaan dan distribusi konten media sosial multi-platform berbasis **Domain-Driven Design (DDD)**, **Mastra Agentic Framework**, **Model Context Protocol (MCP)**, dan **Prompt Chaining**.

Proyek Capstone Tugas Akhir: *Penerapan Domain-Driven Design pada AI Content Generation Pipeline Berbasis Prompt Chaining untuk Distribusi Media Sosial di Rafiqspace.ai*.

---

## 🏛️ Arsitektur Sistem

Arsitektur dibangun berlandaskan prinsip Bounded Contexts DDD:
- **Presentation / Interface Layer:** REST API Controller, SSE Streaming, MCP Protocol Server, Webhook & Telegram Polling Daemon.
- **Application Workflow Layer:** CampaignWorkflowService, FastAckWorker (respons instan <800ms), Mastra Workflow Engine (`strategyStep` ➔ `planningStep` ➔ `synthesisStep`).
- **Core Domain Layer (DDD):** Context Scoping Multi-Tenant (`Company ➔ Project ➔ Application`), Campaign Aggregate Root, Content Plan Matrix Aggregate, Value Objects Zod (menjamin kepatuhan format & eliminasi *constraint bleed*).
- **Infrastructure Layer:** Mastra AI Agents (`StrategyAgent`, `PlanningAgent`, `CanonicalAgent`, `PlatformAdapterAgent`, `ChatOrchestratorAgent`), PostgreSQL 15 Pool, Native MCP Server.

---

## 🔄 4 Tahap Pipeline Prompt Chaining (Macro-HITL)

1. **Tahap 1 (Strategi Kampanye):** Mengubah brief & brand DNA menjadi `StrategyVO` ➔ **HITL Gate 1**.
2. **Tahap 2 (Matriks Kalender):** Menyusun kalender mingguan ➔ **HITL Gate 2 (Macro-HITL 1-Klik)**.
3. **Tahap 3 (Canonical Content):** Sintesis konten master *Single Source of Truth* tanpa batasan format platform.
4. **Tahap 4 (Adaptasi Multi-Platform):** Transformasi deterministik ke X (≤280 kar), Threads (≤500 kar), LinkedIn, Instagram, Facebook, Medium ➔ **HITL Gate 4 (Otorisasi Final)**.

---

## 🚀 Persyaratan & Instalasi

### Prasyarat
- Node.js >= 20
- PostgreSQL 15
- LLM Provider (OpenAI-compatible router / Gemini Flash)

### Setup
```bash
# Clone repository
git clone git@github.com:Xeron23/rafiq_social_agent.git
cd rafiq_social_agent

# Install dependencies
npm install

# Setup Environment
cp .env.example .env
# Sesuaikan isi .env dengan kredensial Anda

# Build
npm run build

# Menjalankan Server
npm start
```

---

## 🧪 Pengujian (Vitest)
```bash
npm test
```

---

## 📄 Lisensi
Hak Cipta © 2026 Muhammad Rifki Anandita (Xeron). Seluruh hak cipta dilindungi undang-undang.
