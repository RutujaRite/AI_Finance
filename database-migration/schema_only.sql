--
-- PostgreSQL database dump
--

\restrict Kc22nZSvDxiatWUZrdmpN2ODWyjsfcypiA6aO9q75z9yzkAfs7e57HZ9qXxpPUO

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_knowledge_bases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_knowledge_bases (
    id character varying(100) NOT NULL,
    agent_id character varying(100),
    knowledge_base_id character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.agent_knowledge_bases OWNER TO postgres;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agents (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying,
    response_style character varying(50) DEFAULT 'balanced'::character varying,
    modes jsonb DEFAULT '{"campaigns": false, "aiAgentMode": true, "conversations": true}'::jsonb,
    general_instructions jsonb DEFAULT '{}'::jsonb,
    allow_general_knowledge boolean DEFAULT true,
    global_guardrails jsonb DEFAULT '{}'::jsonb,
    welcome_message jsonb DEFAULT '{}'::jsonb,
    capabilities jsonb DEFAULT '{}'::jsonb,
    qualification jsonb DEFAULT '{}'::jsonb,
    usage jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    operational_mode character varying(50) DEFAULT 'standard'::character varying,
    goal text,
    guardrail_templates jsonb DEFAULT '[]'::jsonb,
    manual_guardrails text,
    user_id integer
);


ALTER TABLE public.agents OWNER TO postgres;

--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    category character varying(20) NOT NULL,
    model_name character varying(150) NOT NULL,
    provider character varying(100) NOT NULL,
    api_key text,
    base_url text,
    is_active boolean DEFAULT false,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 1024,
    display_name character varying(150),
    CONSTRAINT ai_models_category_check CHECK (((category)::text = ANY ((ARRAY['STT'::character varying, 'LLM'::character varying, 'TTS'::character varying])::text[])))
);


ALTER TABLE public.ai_models OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_models_id_seq OWNER TO postgres;

--
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- Name: ai_token_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_token_settings (
    id character varying(50) DEFAULT 'default'::character varying NOT NULL,
    monthly_budget_tokens bigint DEFAULT 1000000,
    alert_threshold_percent integer DEFAULT 80,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_token_settings OWNER TO postgres;

--
-- Name: ai_token_usage_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_token_usage_logs (
    id integer NOT NULL,
    agent_id character varying(100),
    agent_name character varying(255),
    model_name character varying(150),
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    source character varying(50) DEFAULT 'chat'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_token_usage_logs OWNER TO postgres;

--
-- Name: ai_token_usage_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_token_usage_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_token_usage_logs_id_seq OWNER TO postgres;

--
-- Name: ai_token_usage_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_token_usage_logs_id_seq OWNED BY public.ai_token_usage_logs.id;


--
-- Name: assistant_conversation_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assistant_conversation_states (
    conversation_id character varying(255) NOT NULL,
    state jsonb NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '02:00:00'::interval) NOT NULL
);


ALTER TABLE public.assistant_conversation_states OWNER TO postgres;

--
-- Name: assistant_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assistant_conversations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) DEFAULT 'Loan Assistant'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.assistant_conversations OWNER TO postgres;

--
-- Name: assistant_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assistant_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assistant_conversations_id_seq OWNER TO postgres;

--
-- Name: assistant_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assistant_conversations_id_seq OWNED BY public.assistant_conversations.id;


--
-- Name: assistant_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assistant_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT assistant_messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying])::text[])))
);


ALTER TABLE public.assistant_messages OWNER TO postgres;

--
-- Name: assistant_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assistant_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assistant_messages_id_seq OWNER TO postgres;

--
-- Name: assistant_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assistant_messages_id_seq OWNED BY public.assistant_messages.id;


--
-- Name: bank_company_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_company_data (
    id integer NOT NULL,
    file_id integer NOT NULL,
    company_name character varying(255) NOT NULL,
    bank_name character varying(255) NOT NULL,
    sr_no character varying(100),
    company_category character varying(100),
    other_info text
);


ALTER TABLE public.bank_company_data OWNER TO postgres;

--
-- Name: bank_company_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_company_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_company_data_id_seq OWNER TO postgres;

--
-- Name: bank_company_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_company_data_id_seq OWNED BY public.bank_company_data.id;


--
-- Name: bank_manager_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_manager_files (
    id integer NOT NULL,
    bank_name character varying(100) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size bigint DEFAULT 0,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bank_manager_files OWNER TO postgres;

--
-- Name: bank_manager_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_manager_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_manager_files_id_seq OWNER TO postgres;

--
-- Name: bank_manager_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_manager_files_id_seq OWNED BY public.bank_manager_files.id;


--
-- Name: bank_managers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_managers (
    id integer NOT NULL,
    bank_name character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(100) DEFAULT 'Sales Manager'::character varying,
    phone character varying(100),
    email character varying(255),
    location character varying(255) NOT NULL,
    city character varying(255),
    district character varying(255),
    state character varying(255),
    branch character varying(255),
    employee_code character varying(100),
    extra_info jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bank_managers OWNER TO postgres;

--
-- Name: bank_managers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_managers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_managers_id_seq OWNER TO postgres;

--
-- Name: bank_managers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_managers_id_seq OWNED BY public.bank_managers.id;


--
-- Name: bank_policy_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_policy_files (
    id integer NOT NULL,
    bank_id integer,
    policy_version_id integer,
    file_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_type character varying(50),
    file_size_bytes bigint DEFAULT 0,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT now(),
    description text,
    metadata jsonb,
    extracted_text text,
    extraction_status character varying(20) DEFAULT 'pending'::character varying,
    extraction_error text,
    extracted_at timestamp without time zone
);


ALTER TABLE public.bank_policy_files OWNER TO postgres;

--
-- Name: bank_policy_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_policy_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_policy_files_id_seq OWNER TO postgres;

--
-- Name: bank_policy_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_policy_files_id_seq OWNED BY public.bank_policy_files.id;


--
-- Name: bank_uploaded_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_uploaded_files (
    id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_path character varying(500),
    file_size bigint DEFAULT 0,
    uploaded_by integer
);


ALTER TABLE public.bank_uploaded_files OWNER TO postgres;

--
-- Name: bank_uploaded_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_uploaded_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_uploaded_files_id_seq OWNER TO postgres;

--
-- Name: bank_uploaded_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_uploaded_files_id_seq OWNED BY public.bank_uploaded_files.id;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.banks OWNER TO postgres;

--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.banks_id_seq OWNER TO postgres;

--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: conversation_knowledge_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_knowledge_usage (
    id character varying(100) NOT NULL,
    conversation_id character varying(100),
    agent_id character varying(100),
    knowledge_document_id character varying(100),
    retrieved_chunk_ids jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conversation_knowledge_usage OWNER TO postgres;

--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_messages (
    id character varying(100) NOT NULL,
    conversation_id character varying(100),
    agent_id character varying(100),
    role character varying(50) NOT NULL,
    content text NOT NULL,
    intent character varying(100),
    tools_used jsonb DEFAULT '[]'::jsonb,
    knowledge_documents_used jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conversation_messages OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id character varying(100) NOT NULL,
    agent_id character varying(100),
    user_id integer,
    title character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: custom_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_agents (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    tone character varying(50) DEFAULT 'friendly'::character varying,
    greeting text,
    knowledge_files jsonb DEFAULT '[]'::jsonb,
    knowledge_text text,
    knowledge_chunks jsonb DEFAULT '[]'::jsonb,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.custom_agents OWNER TO postgres;

--
-- Name: decision_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.decision_logs (
    id bigint NOT NULL,
    policy_document_id bigint,
    policy_version text,
    bank_id bigint,
    product_id bigint,
    input_facts jsonb NOT NULL,
    decision_state text NOT NULL,
    passed_rules jsonb DEFAULT '[]'::jsonb,
    failed_rules jsonb DEFAULT '[]'::jsonb,
    missing_fields jsonb DEFAULT '[]'::jsonb,
    checks jsonb DEFAULT '[]'::jsonb,
    rule_ids jsonb DEFAULT '[]'::jsonb,
    source_chunk_ids jsonb DEFAULT '[]'::jsonb,
    explanation text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.decision_logs OWNER TO postgres;

--
-- Name: decision_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.decision_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.decision_logs_id_seq OWNER TO postgres;

--
-- Name: decision_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.decision_logs_id_seq OWNED BY public.decision_logs.id;


--
-- Name: emi_calculations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emi_calculations (
    id integer NOT NULL,
    user_id integer,
    loan_type character varying(100),
    loan_amount numeric,
    annual_rate numeric,
    processing_fee_percent numeric,
    term_months integer,
    months_or_years character varying(10),
    monthly_emi numeric,
    total_interest numeric,
    total_payment numeric,
    processing_fee_amount numeric,
    schedule jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.emi_calculations OWNER TO postgres;

--
-- Name: emi_calculations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.emi_calculations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.emi_calculations_id_seq OWNER TO postgres;

--
-- Name: emi_calculations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.emi_calculations_id_seq OWNED BY public.emi_calculations.id;


--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_bases (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_bases OWNER TO postgres;

--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_chunks (
    id character varying(100) NOT NULL,
    document_id character varying(100),
    agent_id character varying(100),
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    char_count integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_chunks OWNER TO postgres;

--
-- Name: knowledge_document_guardrails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_document_guardrails (
    id character varying(100) NOT NULL,
    document_id character varying(100),
    agent_id character varying(100),
    guardrail_text text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_document_guardrails OWNER TO postgres;

--
-- Name: knowledge_document_instructions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_document_instructions (
    id character varying(100) NOT NULL,
    document_id character varying(100),
    agent_id character varying(100),
    instruction_text text NOT NULL,
    when_to_use text,
    when_not_to_use text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_document_instructions OWNER TO postgres;

--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_documents (
    id character varying(100) NOT NULL,
    agent_id character varying(100),
    knowledge_base_id character varying(100),
    name character varying(255) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size character varying(50),
    file_path text,
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    status_message text,
    chunk_count integer DEFAULT 0,
    vector_status character varying(50) DEFAULT 'Indexed'::character varying,
    is_active boolean DEFAULT true,
    raw_text text,
    metadata jsonb DEFAULT '{}'::jsonb,
    uploaded_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id integer
);


ALTER TABLE public.knowledge_documents OWNER TO postgres;

--
-- Name: loan_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loan_policies (
    id integer NOT NULL,
    loan_type character varying(50) NOT NULL,
    policy_name character varying(150) NOT NULL,
    min_amount numeric DEFAULT 0 NOT NULL,
    max_amount numeric DEFAULT 0 NOT NULL,
    interest_rate numeric DEFAULT 0 NOT NULL,
    processing_fee_percent numeric DEFAULT 0 NOT NULL,
    tenure_months integer DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.loan_policies OWNER TO postgres;

--
-- Name: loan_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.loan_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.loan_policies_id_seq OWNER TO postgres;

--
-- Name: loan_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.loan_policies_id_seq OWNED BY public.loan_policies.id;


--
-- Name: policy_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_attachments (
    id integer NOT NULL,
    policy_rule_id integer,
    file_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_type character varying(50),
    file_size_bytes bigint DEFAULT 0,
    extracted_text text,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.policy_attachments OWNER TO postgres;

--
-- Name: policy_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_attachments_id_seq OWNER TO postgres;

--
-- Name: policy_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_attachments_id_seq OWNED BY public.policy_attachments.id;


--
-- Name: policy_chunks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_chunks (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    bank_id bigint NOT NULL,
    product_id bigint,
    section text,
    subsection text,
    content text NOT NULL,
    page_number integer,
    chunk_index integer,
    embedding public.vector(1536),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.policy_chunks OWNER TO postgres;

--
-- Name: policy_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_chunks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_chunks_id_seq OWNER TO postgres;

--
-- Name: policy_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_chunks_id_seq OWNED BY public.policy_chunks.id;


--
-- Name: policy_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_documents (
    id bigint NOT NULL,
    bank_id bigint NOT NULL,
    product_id bigint,
    version_tag text NOT NULL,
    effective_from date DEFAULT CURRENT_DATE,
    effective_to date,
    status text DEFAULT 'ACTIVE'::text,
    file_name text,
    file_path text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.policy_documents OWNER TO postgres;

--
-- Name: policy_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_documents_id_seq OWNER TO postgres;

--
-- Name: policy_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_documents_id_seq OWNED BY public.policy_documents.id;


--
-- Name: policy_embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_embeddings (
    id bigint NOT NULL,
    policy_file_id bigint NOT NULL,
    bank_id bigint,
    file_name text,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.policy_embeddings OWNER TO postgres;

--
-- Name: policy_embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_embeddings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_embeddings_id_seq OWNER TO postgres;

--
-- Name: policy_embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_embeddings_id_seq OWNED BY public.policy_embeddings.id;


--
-- Name: policy_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_rules (
    id integer NOT NULL,
    policy_version_id integer,
    loan_type character varying(50) DEFAULT 'Personal Loan'::character varying,
    min_cibil integer,
    max_cibil integer,
    min_salary numeric,
    max_salary numeric,
    employment_type character varying(100),
    min_age integer,
    max_age integer,
    min_loan_amount numeric,
    max_loan_amount numeric,
    min_tenure_months integer,
    max_tenure_months integer,
    foir_percent numeric,
    roi numeric,
    processing_fee_percent numeric,
    processing_fee_flat numeric,
    company_rules jsonb,
    location_rules jsonb,
    other_rules jsonb,
    source_references jsonb,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    category character varying(255),
    roi_min numeric,
    roi_max numeric,
    policy_document_id bigint,
    rule_code text,
    field_name text,
    operator text,
    value_numeric numeric,
    value_text text,
    min_value numeric,
    max_value numeric,
    conditions jsonb,
    source_chunk_id bigint,
    source_page integer,
    priority integer DEFAULT 100,
    active boolean DEFAULT false
);


ALTER TABLE public.policy_rules OWNER TO postgres;

--
-- Name: policy_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_rules_id_seq OWNER TO postgres;

--
-- Name: policy_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_rules_id_seq OWNED BY public.policy_rules.id;


--
-- Name: policy_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_sources (
    id integer NOT NULL,
    bank_id integer,
    file_name character varying(500) NOT NULL,
    file_path character varying(1000),
    file_type character varying(50),
    file_size_bytes bigint DEFAULT 0,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT now(),
    description text,
    metadata jsonb
);


ALTER TABLE public.policy_sources OWNER TO postgres;

--
-- Name: policy_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_sources_id_seq OWNER TO postgres;

--
-- Name: policy_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_sources_id_seq OWNED BY public.policy_sources.id;


--
-- Name: policy_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policy_versions (
    id integer NOT NULL,
    bank_id integer,
    source_id integer,
    version character varying(100) NOT NULL,
    effective_from date,
    effective_to date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    loan_type character varying(50)
);


ALTER TABLE public.policy_versions OWNER TO postgres;

--
-- Name: policy_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.policy_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.policy_versions_id_seq OWNER TO postgres;

--
-- Name: policy_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.policy_versions_id_seq OWNED BY public.policy_versions.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    category text DEFAULT 'Personal Loan'::text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: system_api_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_api_configs (
    id integer NOT NULL,
    section_name character varying(100) NOT NULL,
    env_key_name character varying(100) NOT NULL,
    api_key_value text,
    model_name character varying(150),
    base_url text,
    description text,
    source character varying(50) DEFAULT 'manual'::character varying,
    is_active boolean DEFAULT true,
    last_tested_at timestamp without time zone,
    test_status character varying(50) DEFAULT 'untested'::character varying,
    test_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_api_configs OWNER TO postgres;

--
-- Name: system_api_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_api_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_api_configs_id_seq OWNER TO postgres;

--
-- Name: system_api_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_api_configs_id_seq OWNED BY public.system_api_configs.id;


--
-- Name: user_active_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_active_agents (
    user_id integer NOT NULL,
    agent_id character varying(100),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_active_agents OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(100),
    mobile character varying(30),
    dob date,
    gender character varying(20),
    address text,
    city character varying(100),
    pincode character varying(20),
    status character varying(20) DEFAULT 'active'::character varying,
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone,
    occupation character varying(100),
    employment_type character varying(50),
    monthly_income numeric,
    marital_status character varying(30),
    residence_type character varying(50),
    pan character varying(20),
    aadhar character varying(30),
    profile_photo_path character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- Name: ai_token_usage_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_token_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_token_usage_logs_id_seq'::regclass);


--
-- Name: assistant_conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_conversations ALTER COLUMN id SET DEFAULT nextval('public.assistant_conversations_id_seq'::regclass);


--
-- Name: assistant_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_messages ALTER COLUMN id SET DEFAULT nextval('public.assistant_messages_id_seq'::regclass);


--
-- Name: bank_company_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_company_data ALTER COLUMN id SET DEFAULT nextval('public.bank_company_data_id_seq'::regclass);


--
-- Name: bank_manager_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_manager_files ALTER COLUMN id SET DEFAULT nextval('public.bank_manager_files_id_seq'::regclass);


--
-- Name: bank_managers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_managers ALTER COLUMN id SET DEFAULT nextval('public.bank_managers_id_seq'::regclass);


--
-- Name: bank_policy_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_policy_files ALTER COLUMN id SET DEFAULT nextval('public.bank_policy_files_id_seq'::regclass);


--
-- Name: bank_uploaded_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_uploaded_files ALTER COLUMN id SET DEFAULT nextval('public.bank_uploaded_files_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: decision_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_logs ALTER COLUMN id SET DEFAULT nextval('public.decision_logs_id_seq'::regclass);


--
-- Name: emi_calculations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emi_calculations ALTER COLUMN id SET DEFAULT nextval('public.emi_calculations_id_seq'::regclass);


--
-- Name: loan_policies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_policies ALTER COLUMN id SET DEFAULT nextval('public.loan_policies_id_seq'::regclass);


--
-- Name: policy_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_attachments ALTER COLUMN id SET DEFAULT nextval('public.policy_attachments_id_seq'::regclass);


--
-- Name: policy_chunks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_chunks ALTER COLUMN id SET DEFAULT nextval('public.policy_chunks_id_seq'::regclass);


--
-- Name: policy_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_documents ALTER COLUMN id SET DEFAULT nextval('public.policy_documents_id_seq'::regclass);


--
-- Name: policy_embeddings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_embeddings ALTER COLUMN id SET DEFAULT nextval('public.policy_embeddings_id_seq'::regclass);


--
-- Name: policy_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_rules ALTER COLUMN id SET DEFAULT nextval('public.policy_rules_id_seq'::regclass);


--
-- Name: policy_sources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_sources ALTER COLUMN id SET DEFAULT nextval('public.policy_sources_id_seq'::regclass);


--
-- Name: policy_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_versions ALTER COLUMN id SET DEFAULT nextval('public.policy_versions_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: system_api_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_api_configs ALTER COLUMN id SET DEFAULT nextval('public.system_api_configs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: agent_knowledge_bases agent_knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_knowledge_bases
    ADD CONSTRAINT agent_knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_token_settings ai_token_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_token_settings
    ADD CONSTRAINT ai_token_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_token_usage_logs ai_token_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_token_usage_logs
    ADD CONSTRAINT ai_token_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: assistant_conversation_states assistant_conversation_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_conversation_states
    ADD CONSTRAINT assistant_conversation_states_pkey PRIMARY KEY (conversation_id);


--
-- Name: assistant_conversations assistant_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_conversations
    ADD CONSTRAINT assistant_conversations_pkey PRIMARY KEY (id);


--
-- Name: assistant_messages assistant_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_messages
    ADD CONSTRAINT assistant_messages_pkey PRIMARY KEY (id);


--
-- Name: bank_company_data bank_company_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_company_data
    ADD CONSTRAINT bank_company_data_pkey PRIMARY KEY (id);


--
-- Name: bank_manager_files bank_manager_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_manager_files
    ADD CONSTRAINT bank_manager_files_pkey PRIMARY KEY (id);


--
-- Name: bank_managers bank_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_managers
    ADD CONSTRAINT bank_managers_pkey PRIMARY KEY (id);


--
-- Name: bank_policy_files bank_policy_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_policy_files
    ADD CONSTRAINT bank_policy_files_pkey PRIMARY KEY (id);


--
-- Name: bank_uploaded_files bank_uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_uploaded_files
    ADD CONSTRAINT bank_uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: banks banks_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_code_key UNIQUE (code);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: conversation_knowledge_usage conversation_knowledge_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_knowledge_usage
    ADD CONSTRAINT conversation_knowledge_usage_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: custom_agents custom_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_agents
    ADD CONSTRAINT custom_agents_pkey PRIMARY KEY (id);


--
-- Name: decision_logs decision_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.decision_logs
    ADD CONSTRAINT decision_logs_pkey PRIMARY KEY (id);


--
-- Name: emi_calculations emi_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emi_calculations
    ADD CONSTRAINT emi_calculations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_document_guardrails knowledge_document_guardrails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_guardrails
    ADD CONSTRAINT knowledge_document_guardrails_pkey PRIMARY KEY (id);


--
-- Name: knowledge_document_instructions knowledge_document_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_instructions
    ADD CONSTRAINT knowledge_document_instructions_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: loan_policies loan_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_policies
    ADD CONSTRAINT loan_policies_pkey PRIMARY KEY (id);


--
-- Name: policy_attachments policy_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_attachments
    ADD CONSTRAINT policy_attachments_pkey PRIMARY KEY (id);


--
-- Name: policy_chunks policy_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_chunks
    ADD CONSTRAINT policy_chunks_pkey PRIMARY KEY (id);


--
-- Name: policy_documents policy_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_documents
    ADD CONSTRAINT policy_documents_pkey PRIMARY KEY (id);


--
-- Name: policy_embeddings policy_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_embeddings
    ADD CONSTRAINT policy_embeddings_pkey PRIMARY KEY (id);


--
-- Name: policy_rules policy_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_pkey PRIMARY KEY (id);


--
-- Name: policy_sources policy_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_sources
    ADD CONSTRAINT policy_sources_pkey PRIMARY KEY (id);


--
-- Name: policy_versions policy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_versions
    ADD CONSTRAINT policy_versions_pkey PRIMARY KEY (id);


--
-- Name: products products_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_code_key UNIQUE (code);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: system_api_configs system_api_configs_env_key_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_api_configs
    ADD CONSTRAINT system_api_configs_env_key_name_key UNIQUE (env_key_name);


--
-- Name: system_api_configs system_api_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_api_configs
    ADD CONSTRAINT system_api_configs_pkey PRIMARY KEY (id);


--
-- Name: user_active_agents user_active_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_agents
    ADD CONSTRAINT user_active_agents_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_models_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_models_active ON public.ai_models USING btree (category, is_active);


--
-- Name: idx_ai_models_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_models_category ON public.ai_models USING btree (category);


--
-- Name: idx_assistant_conversation_states_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assistant_conversation_states_expires_at ON public.assistant_conversation_states USING btree (expires_at);


--
-- Name: idx_assistant_conversations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assistant_conversations_user_id ON public.assistant_conversations USING btree (user_id);


--
-- Name: idx_assistant_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assistant_messages_conversation_id ON public.assistant_messages USING btree (conversation_id);


--
-- Name: idx_bank_company_bank_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_company_bank_name ON public.bank_company_data USING btree (bank_name);


--
-- Name: idx_bank_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_company_name ON public.bank_company_data USING btree (company_name);


--
-- Name: idx_bank_managers_bank_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_managers_bank_name ON public.bank_managers USING btree (lower((bank_name)::text));


--
-- Name: idx_bank_managers_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_managers_city ON public.bank_managers USING btree (lower((city)::text));


--
-- Name: idx_bank_managers_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_managers_location ON public.bank_managers USING btree (lower((location)::text));


--
-- Name: idx_bank_managers_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_managers_role ON public.bank_managers USING btree (lower((role)::text));


--
-- Name: idx_bank_managers_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_managers_state ON public.bank_managers USING btree (lower((state)::text));


--
-- Name: idx_bank_policy_files_bank_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_policy_files_bank_id ON public.bank_policy_files USING btree (bank_id);


--
-- Name: idx_banks_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_banks_code ON public.banks USING btree (code);


--
-- Name: idx_banks_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_banks_is_active ON public.banks USING btree (is_active);


--
-- Name: idx_decision_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decision_logs_created_at ON public.decision_logs USING btree (created_at DESC);


--
-- Name: idx_emi_calculations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emi_calculations_user_id ON public.emi_calculations USING btree (user_id);


--
-- Name: idx_policy_chunks_filter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_chunks_filter ON public.policy_chunks USING btree (bank_id, document_id);


--
-- Name: idx_policy_embeddings_bank_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_embeddings_bank_id ON public.policy_embeddings USING btree (bank_id);


--
-- Name: idx_policy_embeddings_chunk_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_embeddings_chunk_index ON public.policy_embeddings USING btree (policy_file_id, chunk_index);


--
-- Name: idx_policy_embeddings_file_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_embeddings_file_id ON public.policy_embeddings USING btree (policy_file_id);


--
-- Name: idx_policy_embeddings_vector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_embeddings_vector ON public.policy_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: idx_policy_rules_loan_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_rules_loan_type ON public.policy_rules USING btree (loan_type);


--
-- Name: idx_policy_rules_version_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_rules_version_id ON public.policy_rules USING btree (policy_version_id);


--
-- Name: idx_policy_sources_bank_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_sources_bank_id ON public.policy_sources USING btree (bank_id);


--
-- Name: idx_policy_versions_bank_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policy_versions_bank_id ON public.policy_versions USING btree (bank_id);


--
-- Name: idx_token_logs_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_token_logs_agent ON public.ai_token_usage_logs USING btree (agent_id);


--
-- Name: idx_token_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_token_logs_created ON public.ai_token_usage_logs USING btree (created_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: policy_chunks_embedding_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX policy_chunks_embedding_hnsw ON public.policy_chunks USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: uq_active_policy_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_active_policy_version ON public.policy_versions USING btree (bank_id, loan_type) WHERE ((status)::text = 'active'::text);


--
-- Name: agent_knowledge_bases agent_knowledge_bases_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_knowledge_bases
    ADD CONSTRAINT agent_knowledge_bases_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_knowledge_bases agent_knowledge_bases_knowledge_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_knowledge_bases
    ADD CONSTRAINT agent_knowledge_bases_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: assistant_conversations assistant_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_conversations
    ADD CONSTRAINT assistant_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assistant_messages assistant_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant_messages
    ADD CONSTRAINT assistant_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.assistant_conversations(id) ON DELETE CASCADE;


--
-- Name: bank_company_data bank_company_data_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_company_data
    ADD CONSTRAINT bank_company_data_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.bank_uploaded_files(id) ON DELETE CASCADE;


--
-- Name: bank_manager_files bank_manager_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_manager_files
    ADD CONSTRAINT bank_manager_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_policy_files bank_policy_files_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_policy_files
    ADD CONSTRAINT bank_policy_files_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: bank_policy_files bank_policy_files_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_policy_files
    ADD CONSTRAINT bank_policy_files_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.policy_versions(id) ON DELETE CASCADE;


--
-- Name: bank_policy_files bank_policy_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_policy_files
    ADD CONSTRAINT bank_policy_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: bank_uploaded_files bank_uploaded_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_uploaded_files
    ADD CONSTRAINT bank_uploaded_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversation_knowledge_usage conversation_knowledge_usage_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_knowledge_usage
    ADD CONSTRAINT conversation_knowledge_usage_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: conversation_knowledge_usage conversation_knowledge_usage_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_knowledge_usage
    ADD CONSTRAINT conversation_knowledge_usage_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_knowledge_usage conversation_knowledge_usage_knowledge_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_knowledge_usage
    ADD CONSTRAINT conversation_knowledge_usage_knowledge_document_id_fkey FOREIGN KEY (knowledge_document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: emi_calculations emi_calculations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emi_calculations
    ADD CONSTRAINT emi_calculations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_document_guardrails knowledge_document_guardrails_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_guardrails
    ADD CONSTRAINT knowledge_document_guardrails_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: knowledge_document_guardrails knowledge_document_guardrails_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_guardrails
    ADD CONSTRAINT knowledge_document_guardrails_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_document_instructions knowledge_document_instructions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_instructions
    ADD CONSTRAINT knowledge_document_instructions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: knowledge_document_instructions knowledge_document_instructions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_document_instructions
    ADD CONSTRAINT knowledge_document_instructions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_knowledge_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;


--
-- Name: policy_attachments policy_attachments_policy_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_attachments
    ADD CONSTRAINT policy_attachments_policy_rule_id_fkey FOREIGN KEY (policy_rule_id) REFERENCES public.policy_rules(id) ON DELETE CASCADE;


--
-- Name: policy_attachments policy_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_attachments
    ADD CONSTRAINT policy_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: policy_documents policy_documents_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_documents
    ADD CONSTRAINT policy_documents_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: policy_documents policy_documents_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_documents
    ADD CONSTRAINT policy_documents_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: policy_rules policy_rules_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.policy_versions(id) ON DELETE CASCADE;


--
-- Name: policy_sources policy_sources_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_sources
    ADD CONSTRAINT policy_sources_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: policy_sources policy_sources_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_sources
    ADD CONSTRAINT policy_sources_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: policy_versions policy_versions_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_versions
    ADD CONSTRAINT policy_versions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE CASCADE;


--
-- Name: policy_versions policy_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_versions
    ADD CONSTRAINT policy_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: policy_versions policy_versions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policy_versions
    ADD CONSTRAINT policy_versions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.policy_sources(id);


--
-- Name: user_active_agents user_active_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_agents
    ADD CONSTRAINT user_active_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Kc22nZSvDxiatWUZrdmpN2ODWyjsfcypiA6aO9q75z9yzkAfs7e57HZ9qXxpPUO

