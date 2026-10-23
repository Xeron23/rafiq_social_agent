-- ========================================================
-- SOCIALPAL AGENTIC PLATFORM - DATABASE SCHEMA (POSTGRESQL 15)
-- Domain-Driven Design (DDD) Bounded Contexts
-- ========================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRAND VOICE & CORPORATE DNA
CREATE TABLE IF NOT EXISTS brand_voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name VARCHAR(100) NOT NULL DEFAULT 'Rafiqspace.ai',
    brand_description TEXT NOT NULL,
    tone_formal INT NOT NULL DEFAULT 30, -- 0=Formal, 100=Santai
    tone_warm INT NOT NULL DEFAULT 60,   -- 0=Lugas, 100=Hangat
    tone_simple INT NOT NULL DEFAULT 55, -- 0=Teknis, 100=Sederhana
    mandatory_keywords JSONB NOT NULL DEFAULT '["Sovereignty", "Responsible AI", "Enterprise Grade", "Secure", "AI Governance"]',
    banned_keywords JSONB NOT NULL DEFAULT '[]',
    language_guidelines TEXT DEFAULT 'Bahasa Indonesia baku; istilah teknis boleh dalam bahasa Inggris.',
    logo_filename VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CALENDAR EVENTS & NATIONAL HOLIDAYS (PLANNER)
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    event_date DATE NOT NULL,
    title VARCHAR(150) NOT NULL,
    short_label VARCHAR(50) NOT NULL,
    category VARCHAR(50) DEFAULT 'national_holiday',
    description TEXT,
    suggested_content_type VARCHAR(10) DEFAULT 'hb',
    is_annual BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CAMPAIGNS (HITL AGGREGATE ROOT)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(10) NOT NULL, -- 'hb', 'lt', 'pp'
    brief TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'menunggu', 'terjadwal', 'terbit', 'gagal'
    current_stage INT NOT NULL DEFAULT 0, -- 0..5
    duration_weeks INT NOT NULL DEFAULT 2,
    start_date DATE NOT NULL,
    target_channels JSONB NOT NULL DEFAULT '["li","ig","fb","th","x"]',
    strategy_data JSONB,
    content_plan_data JSONB,
    canonical_data JSONB,
    platform_variants JSONB,
    custom_captions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_hitl_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    stage_number INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    feedback_notes TEXT,
    actor_name VARCHAR(100) DEFAULT 'Xeron',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SCHEDULED POSTS & DRAFTS (PLANNER AGGREGATE)
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id SERIAL PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    day_of_month INT NOT NULL,
    scheduled_date DATE,
    scheduled_time VARCHAR(20) NOT NULL DEFAULT '07.00',
    title VARCHAR(255) NOT NULL,
    short_title VARCHAR(100) NOT NULL,
    content_type VARCHAR(150) NOT NULL DEFAULT 'Leadership Thought',
    format_badge VARCHAR(50) NOT NULL DEFAULT 'Single image',
    status VARCHAR(50) NOT NULL DEFAULT 'terjadwal', -- 'terbit', 'terjadwal', 'menunggu', 'draft', 'gagal'
    channels JSONB NOT NULL DEFAULT '["li"]',
    caption TEXT NOT NULL,
    stage_label VARCHAR(100),
    image_url TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    campaign_name VARCHAR(255),
    stage_number INT DEFAULT 4,
    when_str VARCHAR(100)
);

-- 5. NOTIFICATIONS & PREFERENCES
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    group_label VARCHAR(50) NOT NULL, -- 'Hari ini', 'Kemarin', 'Minggu ini'
    category_key VARCHAR(20) NOT NULL, -- 'act', 'ai', 'pub', 'err', 'sys'
    category_tags JSONB NOT NULL DEFAULT '["act"]',
    time_str VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    cta_label VARCHAR(100),
    cta_href VARCHAR(100),
    is_unread BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    category_key VARCHAR(20) UNIQUE NOT NULL, -- 'act', 'ai', 'pub', 'sys'
    label VARCHAR(100) NOT NULL,
    send_email BOOLEAN NOT NULL DEFAULT FALSE,
    send_telegram BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CLOSED-LOOP AI MEMORIES & ANALYTICS (STAGE 5)
CREATE TABLE IF NOT EXISTS ai_memory_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    evidence TEXT NOT NULL,
    impact_delta VARCHAR(50),
    target_stage VARCHAR(50) DEFAULT 'STAGE_1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    target_stage VARCHAR(50) NOT NULL,
    recommendation_text TEXT NOT NULL,
    is_applied BOOLEAN NOT NULL DEFAULT TRUE,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id INT REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    channel_key VARCHAR(10) NOT NULL,
    views_count INT NOT NULL DEFAULT 0,
    likes_count INT NOT NULL DEFAULT 0,
    shares_count INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. OBSERVABILITY & LATENCY LOGS
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    agent_name VARCHAR(50) NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    latency_ms INT NOT NULL,
    status_code INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
