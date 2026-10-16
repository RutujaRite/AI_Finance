-- Migration: create_registered_models.sql
-- Enables UUID extension if needed and creates tables for registered models and provider API keys

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS registered_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  purpose VARCHAR(100) NOT NULL DEFAULT 'General Chat',
  is_assistant_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_api_keys (
  provider VARCHAR(50) PRIMARY KEY,
  api_key TEXT NOT NULL,
  base_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
