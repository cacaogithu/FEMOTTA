# Relational Schema Documentation
## Multi-Brand AI Marketing Image Editor Database

**Document Version:** 2.0  
**Last Updated:** December 2, 2025  
**Database:** PostgreSQL 15+  
**ORM:** Drizzle ORM  
**Purpose:** Complete relational schema specification with DDL, constraints, and indexes

**Note (December 2025):** The AI provider has been migrated from Wavespeed to Google Gemini. Database column names (`wavespeed_api_key`, `wavespeed_api_calls`) remain unchanged for backward compatibility, but now store Gemini API credentials and usage metrics.

---

## Table of Contents
1. [Schema Overview](#1-schema-overview)
2. [Table Specifications](#2-table-specifications)
3. [Relationships & Foreign Keys](#3-relationships--foreign-keys)
4. [Indexes](#4-indexes)
5. [Constraints & Business Rules](#5-constraints--business-rules)
6. [Sample DDL Statements](#6-sample-ddl-statements)
7. [Query Patterns](#7-query-patterns)
8. [Performance Optimization](#8-performance-optimization)

---

## 1. Schema Overview

### 1.1 Database Metadata
- **Database Name:** `multi_brand_ai_editor`
- **Character Set:** UTF-8
- **Collation:** en_US.UTF-8
- **Timezone:** UTC
- **Connection Pooling:** Enabled (Neon Serverless)

### 1.2 Table Summary

| Table Name | Rows (Est. Year 1) | Primary Purpose |
|------------|-------------------|-----------------|
| brands | 600 | Multi-tenant brand/subaccount management |
| users | 5,000 | System-level user accounts |
| subaccount_users | 10,000 | Brand-level users with RBAC |
| jobs | 50,000 | Image processing jobs |
| images | 500,000 | Original product images |
| edited_images | 500,000 | AI-edited image versions |
| feedback | 100,000 | User ratings and feedback |
| subaccount_prompts | 1,000 | Prompt template library |
| prompt_versions | 5,000 | Prompt version history |
| subaccount_usage_daily | 219,000 | Daily usage analytics |

---

## 2. Table Specifications

### 2.1 BRANDS

**Purpose:** Multi-tenant subaccount management with parent-child hierarchies

**Table Definition:**
```sql
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Hierarchy
  parent_brand_id INTEGER REFERENCES brands(id) ON DELETE RESTRICT,
  brand_type TEXT DEFAULT 'primary' CHECK (brand_type IN ('primary', 'sub_account')),
  
  -- Branding
  logo_url TEXT,
  brandbook_url TEXT,
  website_url TEXT,
  primary_color TEXT DEFAULT '#FFC107',
  secondary_color TEXT DEFAULT '#FF6F00',
  
  -- Google Drive Integration
  brief_folder_id TEXT,
  product_images_folder_id TEXT,
  edited_results_folder_id TEXT,
  
  -- AI Configuration
  default_prompt_template TEXT,
  ai_settings JSONB,
  
  -- API Keys (encrypted)
  wavespeed_api_key TEXT,
  openai_api_key TEXT,
  
  -- Authentication
  auth_password TEXT NOT NULL,
  
  -- CRM Features
  seats_purchased INTEGER DEFAULT 1 NOT NULL,
  seats_used INTEGER DEFAULT 0 NOT NULL,
  workflow_config JSONB,
  monthly_job_limit INTEGER DEFAULT 100 NOT NULL,
  monthly_image_limit INTEGER DEFAULT 1000 NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  CONSTRAINT seats_check CHECK (seats_used <= seats_purchased),
  CONSTRAINT monthly_limits_check CHECK (monthly_job_limit >= 0 AND monthly_image_limit >= 0)
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| name | TEXT | NO | - | Unique internal identifier |
| display_name | TEXT | NO | - | User-facing brand name |
| slug | TEXT | NO | - | URL-safe identifier (e.g., "corsair") |
| parent_brand_id | INTEGER | YES | NULL | Self-reference for sub-accounts |
| brand_type | TEXT | YES | 'primary' | Enum: primary \| sub_account |
| logo_url | TEXT | YES | NULL | Brand logo URL |
| brandbook_url | TEXT | YES | NULL | Brand guidelines PDF URL |
| website_url | TEXT | YES | NULL | Reference website |
| primary_color | TEXT | YES | #FFC107 | Hex color code |
| secondary_color | TEXT | YES | #FF6F00 | Hex color code |
| brief_folder_id | TEXT | YES | NULL | Google Drive folder ID |
| product_images_folder_id | TEXT | YES | NULL | Google Drive folder ID |
| edited_results_folder_id | TEXT | YES | NULL | Google Drive folder ID |
| default_prompt_template | TEXT | YES | NULL | Default AI prompt |
| ai_settings | JSONB | YES | NULL | AI configuration JSON |
| wavespeed_api_key | TEXT | YES | NULL | Encrypted API key (now stores Gemini API key) |
| openai_api_key | TEXT | YES | NULL | Encrypted API key |
| auth_password | TEXT | NO | - | bcrypt hashed password |
| seats_purchased | INTEGER | NO | 1 | Maximum users allowed |
| seats_used | INTEGER | NO | 0 | Current active users |
| workflow_config | JSONB | YES | NULL | UI customization schema |
| monthly_job_limit | INTEGER | NO | 100 | Job quota per month |
| monthly_image_limit | INTEGER | NO | 1000 | Image quota per month |
| active | BOOLEAN | NO | TRUE | Account status |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NO | NOW() | Last update timestamp |

---

### 2.2 USERS

**Purpose:** System-level user accounts

**Table Definition:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'brand_admin', 'user')),
  brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| email | TEXT | NO | - | Unique email address |
| username | TEXT | NO | - | Unique username |
| password_hash | TEXT | YES | NULL | bcrypt hashed password |
| role | TEXT | NO | 'user' | Enum: admin \| brand_admin \| user |
| brand_id | INTEGER | YES | NULL | FK to brands |
| active | BOOLEAN | NO | TRUE | Account status |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| last_login_at | TIMESTAMP | YES | NULL | Last login time |

---

### 2.3 SUBACCOUNT_USERS

**Purpose:** Brand-level users with role-based access control

**Table Definition:**
```sql
CREATE TABLE subaccount_users (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  invitation_token TEXT,
  invited_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP,
  
  CONSTRAINT unique_brand_email UNIQUE (brand_id, email)
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| brand_id | INTEGER | NO | - | FK to brands |
| email | TEXT | NO | - | User email (unique per brand) |
| username | TEXT | NO | - | Username |
| password_hash | TEXT | NO | - | bcrypt hashed password |
| role | TEXT | NO | 'member' | Enum: owner \| admin \| member \| viewer |
| invitation_token | TEXT | YES | NULL | Unique invitation token |
| invited_by | INTEGER | YES | NULL | FK to subaccount_users (inviter) |
| invited_at | TIMESTAMP | YES | NULL | Invitation sent timestamp |
| accepted_at | TIMESTAMP | YES | NULL | Invitation accepted timestamp |
| active | BOOLEAN | NO | TRUE | Account status |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| last_login_at | TIMESTAMP | YES | NULL | Last login time |

---

### 2.4 JOBS

**Purpose:** Image processing jobs with stateful workflow tracking

**Table Definition:**
```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  brief_text TEXT,
  brief_file_id TEXT,
  prompt_text TEXT,
  processing_step TEXT,
  
  image_specs JSONB,
  workflow_steps JSONB,
  images_data JSONB,
  edited_images_data JSONB,
  image_progress JSONB,
  
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  processing_time_seconds INTEGER,
  estimated_manual_time_minutes INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| job_id | TEXT | NO | - | Unique job identifier (UUID) |
| brand_id | INTEGER | NO | - | FK to brands |
| user_id | INTEGER | YES | NULL | FK to users |
| status | TEXT | NO | 'pending' | Enum: pending \| processing \| completed \| failed |
| brief_text | TEXT | YES | NULL | Extracted campaign requirements |
| brief_file_id | TEXT | YES | NULL | Google Drive file ID |
| prompt_text | TEXT | YES | NULL | Current editing prompt |
| processing_step | TEXT | YES | NULL | Current step description |
| image_specs | JSONB | YES | NULL | Image specifications |
| workflow_steps | JSONB | YES | NULL | Processing workflow steps |
| images_data | JSONB | YES | NULL | Original images metadata array |
| edited_images_data | JSONB | YES | NULL | Edited images metadata array |
| image_progress | JSONB | YES | NULL | Real-time progress tracking |
| start_time | TIMESTAMP | YES | NULL | Processing start time |
| end_time | TIMESTAMP | YES | NULL | Processing end time |
| processing_time_seconds | INTEGER | YES | NULL | Actual processing time |
| estimated_manual_time_minutes | INTEGER | YES | NULL | Estimated manual time |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NO | NOW() | Last update timestamp |

---

### 2.5 IMAGES

**Purpose:** Original product images uploaded by users

**Table Definition:**
```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  original_name TEXT NOT NULL,
  original_drive_id TEXT NOT NULL,
  original_public_url TEXT,
  
  edited_name TEXT,
  edited_drive_id TEXT,
  edited_public_url TEXT,
  
  prompt_used TEXT,
  title TEXT,
  subtitle TEXT,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| job_id | INTEGER | NO | - | FK to jobs |
| brand_id | INTEGER | NO | - | FK to brands |
| original_name | TEXT | NO | - | Original filename |
| original_drive_id | TEXT | NO | - | Google Drive file ID |
| original_public_url | TEXT | YES | NULL | Shareable URL |
| edited_name | TEXT | YES | NULL | Edited filename |
| edited_drive_id | TEXT | YES | NULL | Google Drive file ID |
| edited_public_url | TEXT | YES | NULL | Shareable URL |
| prompt_used | TEXT | YES | NULL | Prompt used for editing |
| title | TEXT | YES | NULL | Image title |
| subtitle | TEXT | YES | NULL | Image subtitle |
| created_at | TIMESTAMP | NO | NOW() | Upload timestamp |

---

### 2.6 EDITED_IMAGES

**Purpose:** AI-edited image versions with prompt tracking

**Table Definition:**
```sql
CREATE TABLE edited_images (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  edited_drive_id TEXT NOT NULL,
  edited_public_url TEXT,
  prompt_used TEXT,
  prompt_version_id INTEGER REFERENCES prompt_versions(id) ON DELETE SET NULL,
  
  processing_time_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| job_id | INTEGER | NO | - | FK to jobs |
| image_id | INTEGER | NO | - | FK to images |
| brand_id | INTEGER | NO | - | FK to brands |
| edited_drive_id | TEXT | NO | - | Google Drive file ID |
| edited_public_url | TEXT | YES | NULL | Shareable URL |
| prompt_used | TEXT | YES | NULL | Actual prompt sent to API |
| prompt_version_id | INTEGER | YES | NULL | FK to prompt_versions |
| processing_time_ms | INTEGER | YES | NULL | API response time (milliseconds) |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |

---

### 2.7 FEEDBACK

**Purpose:** User ratings and feedback on edited images

**Table Definition:**
```sql
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  edited_image_id INTEGER REFERENCES edited_images(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  improvement_suggestions TEXT,
  
  goal_alignment INTEGER CHECK (goal_alignment >= 1 AND goal_alignment <= 5),
  creativity_score INTEGER CHECK (creativity_score >= 1 AND creativity_score <= 5),
  technical_quality INTEGER CHECK (technical_quality >= 1 AND technical_quality <= 5),
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| job_id | INTEGER | NO | - | FK to jobs |
| brand_id | INTEGER | NO | - | FK to brands |
| edited_image_id | INTEGER | YES | NULL | FK to edited_images |
| rating | INTEGER | NO | - | Overall rating (1-5) |
| feedback_text | TEXT | YES | NULL | Detailed comments |
| improvement_suggestions | TEXT | YES | NULL | Improvement ideas |
| goal_alignment | INTEGER | YES | NULL | Goal alignment rating (1-5) |
| creativity_score | INTEGER | YES | NULL | Creativity rating (1-5) |
| technical_quality | INTEGER | YES | NULL | Technical quality rating (1-5) |
| created_at | TIMESTAMP | NO | NOW() | Submission timestamp |

---

### 2.8 SUBACCOUNT_PROMPTS

**Purpose:** Prompt template library per subaccount

**Table Definition:**
```sql
CREATE TABLE subaccount_prompts (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  active_version_id INTEGER,
  
  created_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| brand_id | INTEGER | NO | - | FK to brands |
| name | TEXT | NO | - | Template name |
| description | TEXT | YES | NULL | Template purpose |
| category | TEXT | YES | NULL | Category (e.g., "Product", "Social") |
| active_version_id | INTEGER | YES | NULL | FK to prompt_versions |
| created_by | INTEGER | YES | NULL | FK to subaccount_users |
| is_default | BOOLEAN | NO | FALSE | Auto-select for new jobs |
| active | BOOLEAN | NO | TRUE | Template availability |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NO | NOW() | Last update timestamp |

---

### 2.9 PROMPT_VERSIONS

**Purpose:** Version history for prompt templates with performance tracking

**Table Definition:**
```sql
CREATE TABLE prompt_versions (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES subaccount_prompts(id) ON DELETE CASCADE,
  
  version_number INTEGER NOT NULL,
  prompt_template TEXT NOT NULL,
  ai_settings JSONB,
  
  usage_count INTEGER DEFAULT 0 NOT NULL,
  average_rating INTEGER,
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  
  created_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  activated_at TIMESTAMP,
  
  CONSTRAINT unique_prompt_version UNIQUE (prompt_id, version_number),
  CONSTRAINT avg_rating_check CHECK (average_rating IS NULL OR (average_rating >= 1 AND average_rating <= 5))
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| prompt_id | INTEGER | NO | - | FK to subaccount_prompts |
| version_number | INTEGER | NO | - | Sequential version number |
| prompt_template | TEXT | NO | - | Actual prompt text |
| ai_settings | JSONB | YES | NULL | Model, temperature, etc. |
| usage_count | INTEGER | NO | 0 | Usage counter |
| average_rating | INTEGER | YES | NULL | Average user rating (1-5) |
| status | TEXT | NO | 'draft' | Enum: draft \| active \| deprecated |
| created_by | INTEGER | YES | NULL | FK to subaccount_users |
| created_at | TIMESTAMP | NO | NOW() | Creation timestamp |
| activated_at | TIMESTAMP | YES | NULL | Activation timestamp |

---

### 2.10 SUBACCOUNT_USAGE_DAILY

**Purpose:** Daily aggregated usage metrics per brand

**Table Definition:**
```sql
CREATE TABLE subaccount_usage_daily (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  
  jobs_created INTEGER DEFAULT 0 NOT NULL,
  jobs_completed INTEGER DEFAULT 0 NOT NULL,
  jobs_failed INTEGER DEFAULT 0 NOT NULL,
  
  images_uploaded INTEGER DEFAULT 0 NOT NULL,
  images_processed INTEGER DEFAULT 0 NOT NULL,
  
  wavespeed_api_calls INTEGER DEFAULT 0 NOT NULL,
  openai_api_calls INTEGER DEFAULT 0 NOT NULL,
  
  estimated_cost_cents INTEGER DEFAULT 0 NOT NULL,
  
  total_processing_seconds INTEGER DEFAULT 0 NOT NULL,
  total_time_saved_seconds INTEGER DEFAULT 0 NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  CONSTRAINT unique_brand_date UNIQUE (brand_id, date),
  CONSTRAINT positive_metrics CHECK (
    jobs_created >= 0 AND 
    jobs_completed >= 0 AND 
    jobs_failed >= 0 AND
    images_uploaded >= 0 AND
    images_processed >= 0 AND
    wavespeed_api_calls >= 0 AND
    openai_api_calls >= 0 AND
    estimated_cost_cents >= 0 AND
    total_processing_seconds >= 0 AND
    total_time_saved_seconds >= 0
  )
);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | AUTO | Primary key |
| brand_id | INTEGER | NO | - | FK to brands |
| date | TIMESTAMP | NO | - | Tracking date |
| jobs_created | INTEGER | NO | 0 | Daily job count |
| jobs_completed | INTEGER | NO | 0 | Successful jobs |
| jobs_failed | INTEGER | NO | 0 | Failed jobs |
| images_uploaded | INTEGER | NO | 0 | Original images |
| images_processed | INTEGER | NO | 0 | Edited images |
| wavespeed_api_calls | INTEGER | NO | 0 | API usage |
| openai_api_calls | INTEGER | NO | 0 | API usage |
| estimated_cost_cents | INTEGER | NO | 0 | Daily cost (cents) |
| total_processing_seconds | INTEGER | NO | 0 | Compute time |
| total_time_saved_seconds | INTEGER | NO | 0 | Efficiency metric |
| created_at | TIMESTAMP | NO | NOW() | Record creation time |

---

## 3. Relationships & Foreign Keys

### 3.1 Relationship Matrix

| Parent Table | Child Table | Relationship | Cardinality | ON DELETE |
|--------------|-------------|--------------|-------------|-----------|
| brands | brands | Self-reference (hierarchy) | 1:N | RESTRICT |
| brands | users | Brand → Users | 1:N | CASCADE |
| brands | subaccount_users | Brand → Users | 1:N | CASCADE |
| brands | jobs | Brand → Jobs | 1:N | CASCADE |
| brands | images | Brand → Images | 1:N | CASCADE |
| brands | edited_images | Brand → Edited Images | 1:N | CASCADE |
| brands | feedback | Brand → Feedback | 1:N | CASCADE |
| brands | subaccount_prompts | Brand → Prompts | 1:N | CASCADE |
| brands | subaccount_usage_daily | Brand → Usage | 1:N | CASCADE |
| users | jobs | User → Jobs | 1:N | SET NULL |
| users | subaccount_users | User → Brand Users | 1:N | CASCADE |
| subaccount_users | subaccount_users | Self-reference (invitation) | 1:N | SET NULL |
| subaccount_users | subaccount_prompts | User → Prompts | 1:N | SET NULL |
| subaccount_users | prompt_versions | User → Versions | 1:N | SET NULL |
| jobs | images | Job → Images | 1:N | CASCADE |
| jobs | edited_images | Job → Edited Images | 1:N | CASCADE |
| jobs | feedback | Job → Feedback | 1:N | CASCADE |
| images | edited_images | Image → Edits | 1:N | CASCADE |
| edited_images | feedback | Edited Image → Feedback | 1:N | CASCADE |
| subaccount_prompts | prompt_versions | Prompt → Versions | 1:N | CASCADE |
| subaccount_prompts | edited_images | Prompt → Edits | 1:N | SET NULL |
| prompt_versions | edited_images | Version → Edits | 1:N | SET NULL |

### 3.2 Foreign Key Constraints

```sql
-- brands table
ALTER TABLE brands ADD CONSTRAINT fk_brands_parent 
  FOREIGN KEY (parent_brand_id) REFERENCES brands(id) ON DELETE RESTRICT;

-- users table
ALTER TABLE users ADD CONSTRAINT fk_users_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- subaccount_users table
ALTER TABLE subaccount_users ADD CONSTRAINT fk_subaccount_users_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE subaccount_users ADD CONSTRAINT fk_subaccount_users_inviter 
  FOREIGN KEY (invited_by) REFERENCES subaccount_users(id) ON DELETE SET NULL;

-- jobs table
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- images table
ALTER TABLE images ADD CONSTRAINT fk_images_job 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE images ADD CONSTRAINT fk_images_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- edited_images table
ALTER TABLE edited_images ADD CONSTRAINT fk_edited_images_job 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE edited_images ADD CONSTRAINT fk_edited_images_image 
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE;
ALTER TABLE edited_images ADD CONSTRAINT fk_edited_images_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE edited_images ADD CONSTRAINT fk_edited_images_prompt_version 
  FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;

-- feedback table
ALTER TABLE feedback ADD CONSTRAINT fk_feedback_job 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE feedback ADD CONSTRAINT fk_feedback_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE feedback ADD CONSTRAINT fk_feedback_edited_image 
  FOREIGN KEY (edited_image_id) REFERENCES edited_images(id) ON DELETE CASCADE;

-- subaccount_prompts table
ALTER TABLE subaccount_prompts ADD CONSTRAINT fk_prompts_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE subaccount_prompts ADD CONSTRAINT fk_prompts_creator 
  FOREIGN KEY (created_by) REFERENCES subaccount_users(id) ON DELETE SET NULL;

-- prompt_versions table
ALTER TABLE prompt_versions ADD CONSTRAINT fk_versions_prompt 
  FOREIGN KEY (prompt_id) REFERENCES subaccount_prompts(id) ON DELETE CASCADE;
ALTER TABLE prompt_versions ADD CONSTRAINT fk_versions_creator 
  FOREIGN KEY (created_by) REFERENCES subaccount_users(id) ON DELETE SET NULL;

-- subaccount_usage_daily table
ALTER TABLE subaccount_usage_daily ADD CONSTRAINT fk_usage_brand 
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
```

---

## 4. Indexes

### 4.1 Primary Key Indexes (Automatic)

All `SERIAL PRIMARY KEY` columns automatically create B-tree indexes.

### 4.2 Unique Constraint Indexes (Automatic)

```sql
-- Automatically created by UNIQUE constraints
CREATE UNIQUE INDEX brands_name_key ON brands(name);
CREATE UNIQUE INDEX brands_slug_key ON brands(slug);
CREATE UNIQUE INDEX users_email_key ON users(email);
CREATE UNIQUE INDEX users_username_key ON users(username);
CREATE UNIQUE INDEX jobs_job_id_key ON jobs(job_id);
CREATE UNIQUE INDEX subaccount_users_brand_email_key ON subaccount_users(brand_id, email);
CREATE UNIQUE INDEX prompt_versions_prompt_version_key ON prompt_versions(prompt_id, version_number);
CREATE UNIQUE INDEX usage_daily_brand_date_key ON subaccount_usage_daily(brand_id, date);
```

### 4.3 Foreign Key Indexes (Required for Performance)

```sql
-- brands
CREATE INDEX idx_brands_parent_brand_id ON brands(parent_brand_id) WHERE parent_brand_id IS NOT NULL;

-- users
CREATE INDEX idx_users_brand_id ON users(brand_id) WHERE brand_id IS NOT NULL;

-- subaccount_users
CREATE INDEX idx_subaccount_users_brand_id ON subaccount_users(brand_id);
CREATE INDEX idx_subaccount_users_invited_by ON subaccount_users(invited_by) WHERE invited_by IS NOT NULL;

-- jobs
CREATE INDEX idx_jobs_brand_id ON jobs(brand_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id) WHERE user_id IS NOT NULL;

-- images
CREATE INDEX idx_images_job_id ON images(job_id);
CREATE INDEX idx_images_brand_id ON images(brand_id);

-- edited_images
CREATE INDEX idx_edited_images_job_id ON edited_images(job_id);
CREATE INDEX idx_edited_images_image_id ON edited_images(image_id);
CREATE INDEX idx_edited_images_brand_id ON edited_images(brand_id);
CREATE INDEX idx_edited_images_prompt_version_id ON edited_images(prompt_version_id) WHERE prompt_version_id IS NOT NULL;

-- feedback
CREATE INDEX idx_feedback_job_id ON feedback(job_id);
CREATE INDEX idx_feedback_brand_id ON feedback(brand_id);
CREATE INDEX idx_feedback_edited_image_id ON feedback(edited_image_id) WHERE edited_image_id IS NOT NULL;

-- subaccount_prompts
CREATE INDEX idx_prompts_brand_id ON subaccount_prompts(brand_id);
CREATE INDEX idx_prompts_created_by ON subaccount_prompts(created_by) WHERE created_by IS NOT NULL;

-- prompt_versions
CREATE INDEX idx_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX idx_versions_created_by ON prompt_versions(created_by) WHERE created_by IS NOT NULL;

-- subaccount_usage_daily
CREATE INDEX idx_usage_daily_brand_id ON subaccount_usage_daily(brand_id);
```

### 4.4 Query Optimization Indexes

```sql
-- Frequently queried status fields
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;
CREATE INDEX idx_subaccount_users_active ON subaccount_users(active) WHERE active = TRUE;

-- Timestamp-based queries (DESC for recent-first sorting)
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_usage_daily_date ON subaccount_usage_daily(date DESC);

-- Email lookup for authentication
CREATE INDEX idx_subaccount_users_email ON subaccount_users(email);

-- Rating analysis
CREATE INDEX idx_feedback_rating ON feedback(rating);
CREATE INDEX idx_feedback_goal_alignment ON feedback(goal_alignment) WHERE goal_alignment IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_jobs_brand_status ON jobs(brand_id, status);
CREATE INDEX idx_jobs_brand_created ON jobs(brand_id, created_at DESC);
CREATE INDEX idx_images_job_created ON images(job_id, created_at DESC);
```

---

## 5. Constraints & Business Rules

### 5.1 Check Constraints

```sql
-- brands
ALTER TABLE brands ADD CONSTRAINT chk_brand_type 
  CHECK (brand_type IN ('primary', 'sub_account'));
ALTER TABLE brands ADD CONSTRAINT chk_seats 
  CHECK (seats_used <= seats_purchased AND seats_used >= 0);
ALTER TABLE brands ADD CONSTRAINT chk_limits 
  CHECK (monthly_job_limit >= 0 AND monthly_image_limit >= 0);

-- users
ALTER TABLE users ADD CONSTRAINT chk_user_role 
  CHECK (role IN ('admin', 'brand_admin', 'user'));

-- subaccount_users
ALTER TABLE subaccount_users ADD CONSTRAINT chk_subaccount_role 
  CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

-- jobs
ALTER TABLE jobs ADD CONSTRAINT chk_job_status 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE jobs ADD CONSTRAINT chk_processing_time 
  CHECK (processing_time_seconds IS NULL OR processing_time_seconds >= 0);

-- feedback
ALTER TABLE feedback ADD CONSTRAINT chk_rating 
  CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE feedback ADD CONSTRAINT chk_goal_alignment 
  CHECK (goal_alignment IS NULL OR (goal_alignment >= 1 AND goal_alignment <= 5));
ALTER TABLE feedback ADD CONSTRAINT chk_creativity 
  CHECK (creativity_score IS NULL OR (creativity_score >= 1 AND creativity_score <= 5));
ALTER TABLE feedback ADD CONSTRAINT chk_technical_quality 
  CHECK (technical_quality IS NULL OR (technical_quality >= 1 AND technical_quality <= 5));

-- prompt_versions
ALTER TABLE prompt_versions ADD CONSTRAINT chk_version_status 
  CHECK (status IN ('draft', 'active', 'deprecated'));
ALTER TABLE prompt_versions ADD CONSTRAINT chk_version_number 
  CHECK (version_number > 0);
ALTER TABLE prompt_versions ADD CONSTRAINT chk_average_rating 
  CHECK (average_rating IS NULL OR (average_rating >= 1 AND average_rating <= 5));

-- subaccount_usage_daily
ALTER TABLE subaccount_usage_daily ADD CONSTRAINT chk_positive_metrics 
  CHECK (
    jobs_created >= 0 AND jobs_completed >= 0 AND jobs_failed >= 0 AND
    images_uploaded >= 0 AND images_processed >= 0 AND
    wavespeed_api_calls >= 0 AND openai_api_calls >= 0 AND
    estimated_cost_cents >= 0 AND
    total_processing_seconds >= 0 AND total_time_saved_seconds >= 0
  );
```

### 5.2 Unique Constraints

```sql
ALTER TABLE brands ADD CONSTRAINT uq_brands_name UNIQUE (name);
ALTER TABLE brands ADD CONSTRAINT uq_brands_slug UNIQUE (slug);
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
ALTER TABLE jobs ADD CONSTRAINT uq_jobs_job_id UNIQUE (job_id);
ALTER TABLE subaccount_users ADD CONSTRAINT uq_subaccount_users_brand_email UNIQUE (brand_id, email);
ALTER TABLE prompt_versions ADD CONSTRAINT uq_prompt_versions_prompt_version UNIQUE (prompt_id, version_number);
ALTER TABLE subaccount_usage_daily ADD CONSTRAINT uq_usage_daily_brand_date UNIQUE (brand_id, date);
```

### 5.3 Not Null Constraints

All `NOT NULL` constraints are specified in the table definitions above.

---

## 6. Sample DDL Statements

### 6.1 Complete Database Creation Script

```sql
-- Create database
CREATE DATABASE multi_brand_ai_editor
  WITH ENCODING='UTF8'
  LC_COLLATE='en_US.UTF-8'
  LC_CTYPE='en_US.UTF-8'
  TEMPLATE=template0;

-- Connect to database
\c multi_brand_ai_editor;

-- Create tables (in dependency order)
-- 1. brands (no dependencies)
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_brand_id INTEGER REFERENCES brands(id) ON DELETE RESTRICT,
  brand_type TEXT DEFAULT 'primary' CHECK (brand_type IN ('primary', 'sub_account')),
  logo_url TEXT,
  brandbook_url TEXT,
  website_url TEXT,
  primary_color TEXT DEFAULT '#FFC107',
  secondary_color TEXT DEFAULT '#FF6F00',
  brief_folder_id TEXT,
  product_images_folder_id TEXT,
  edited_results_folder_id TEXT,
  default_prompt_template TEXT,
  ai_settings JSONB,
  wavespeed_api_key TEXT,
  openai_api_key TEXT,
  auth_password TEXT NOT NULL,
  seats_purchased INTEGER DEFAULT 1 NOT NULL CHECK (seats_purchased >= 1),
  seats_used INTEGER DEFAULT 0 NOT NULL CHECK (seats_used >= 0),
  workflow_config JSONB,
  monthly_job_limit INTEGER DEFAULT 100 NOT NULL CHECK (monthly_job_limit >= 0),
  monthly_image_limit INTEGER DEFAULT 1000 NOT NULL CHECK (monthly_image_limit >= 0),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_seats CHECK (seats_used <= seats_purchased)
);

-- 2. users (depends on brands)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'brand_admin', 'user')),
  brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP
);

-- 3. subaccount_users (depends on brands, self-references)
CREATE TABLE subaccount_users (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invitation_token TEXT,
  invited_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP,
  CONSTRAINT uq_subaccount_users_brand_email UNIQUE (brand_id, email)
);

-- 4. jobs (depends on brands, users)
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  brief_text TEXT,
  brief_file_id TEXT,
  prompt_text TEXT,
  processing_step TEXT,
  image_specs JSONB,
  workflow_steps JSONB,
  images_data JSONB,
  edited_images_data JSONB,
  image_progress JSONB,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  processing_time_seconds INTEGER CHECK (processing_time_seconds IS NULL OR processing_time_seconds >= 0),
  estimated_manual_time_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. images (depends on jobs, brands)
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  original_drive_id TEXT NOT NULL,
  original_public_url TEXT,
  edited_name TEXT,
  edited_drive_id TEXT,
  edited_public_url TEXT,
  prompt_used TEXT,
  title TEXT,
  subtitle TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. subaccount_prompts (depends on brands, subaccount_users)
CREATE TABLE subaccount_prompts (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  active_version_id INTEGER,
  created_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. prompt_versions (depends on subaccount_prompts, subaccount_users)
CREATE TABLE prompt_versions (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES subaccount_prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  prompt_template TEXT NOT NULL,
  ai_settings JSONB,
  usage_count INTEGER DEFAULT 0 NOT NULL CHECK (usage_count >= 0),
  average_rating INTEGER CHECK (average_rating IS NULL OR (average_rating >= 1 AND average_rating <= 5)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  created_by INTEGER REFERENCES subaccount_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  activated_at TIMESTAMP,
  CONSTRAINT uq_prompt_versions_prompt_version UNIQUE (prompt_id, version_number)
);

-- 8. edited_images (depends on jobs, images, brands, prompt_versions)
CREATE TABLE edited_images (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  edited_drive_id TEXT NOT NULL,
  edited_public_url TEXT,
  prompt_used TEXT,
  prompt_version_id INTEGER REFERENCES prompt_versions(id) ON DELETE SET NULL,
  processing_time_ms INTEGER CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 9. feedback (depends on jobs, brands, edited_images)
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  edited_image_id INTEGER REFERENCES edited_images(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  improvement_suggestions TEXT,
  goal_alignment INTEGER CHECK (goal_alignment IS NULL OR (goal_alignment >= 1 AND goal_alignment <= 5)),
  creativity_score INTEGER CHECK (creativity_score IS NULL OR (creativity_score >= 1 AND creativity_score <= 5)),
  technical_quality INTEGER CHECK (technical_quality IS NULL OR (technical_quality >= 1 AND technical_quality <= 5)),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 10. subaccount_usage_daily (depends on brands)
CREATE TABLE subaccount_usage_daily (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  jobs_created INTEGER DEFAULT 0 NOT NULL CHECK (jobs_created >= 0),
  jobs_completed INTEGER DEFAULT 0 NOT NULL CHECK (jobs_completed >= 0),
  jobs_failed INTEGER DEFAULT 0 NOT NULL CHECK (jobs_failed >= 0),
  images_uploaded INTEGER DEFAULT 0 NOT NULL CHECK (images_uploaded >= 0),
  images_processed INTEGER DEFAULT 0 NOT NULL CHECK (images_processed >= 0),
  wavespeed_api_calls INTEGER DEFAULT 0 NOT NULL CHECK (wavespeed_api_calls >= 0),
  openai_api_calls INTEGER DEFAULT 0 NOT NULL CHECK (openai_api_calls >= 0),
  estimated_cost_cents INTEGER DEFAULT 0 NOT NULL CHECK (estimated_cost_cents >= 0),
  total_processing_seconds INTEGER DEFAULT 0 NOT NULL CHECK (total_processing_seconds >= 0),
  total_time_saved_seconds INTEGER DEFAULT 0 NOT NULL CHECK (total_time_saved_seconds >= 0),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_usage_daily_brand_date UNIQUE (brand_id, date)
);

-- Create all indexes
CREATE INDEX idx_brands_parent_brand_id ON brands(parent_brand_id) WHERE parent_brand_id IS NOT NULL;
CREATE INDEX idx_users_brand_id ON users(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;
CREATE INDEX idx_subaccount_users_brand_id ON subaccount_users(brand_id);
CREATE INDEX idx_subaccount_users_email ON subaccount_users(email);
CREATE INDEX idx_subaccount_users_invited_by ON subaccount_users(invited_by) WHERE invited_by IS NOT NULL;
CREATE INDEX idx_subaccount_users_active ON subaccount_users(active) WHERE active = TRUE;
CREATE INDEX idx_jobs_brand_id ON jobs(brand_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_brand_status ON jobs(brand_id, status);
CREATE INDEX idx_jobs_brand_created ON jobs(brand_id, created_at DESC);
CREATE INDEX idx_images_job_id ON images(job_id);
CREATE INDEX idx_images_brand_id ON images(brand_id);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_job_created ON images(job_id, created_at DESC);
CREATE INDEX idx_edited_images_job_id ON edited_images(job_id);
CREATE INDEX idx_edited_images_image_id ON edited_images(image_id);
CREATE INDEX idx_edited_images_brand_id ON edited_images(brand_id);
CREATE INDEX idx_edited_images_prompt_version_id ON edited_images(prompt_version_id) WHERE prompt_version_id IS NOT NULL;
CREATE INDEX idx_feedback_job_id ON feedback(job_id);
CREATE INDEX idx_feedback_brand_id ON feedback(brand_id);
CREATE INDEX idx_feedback_edited_image_id ON feedback(edited_image_id) WHERE edited_image_id IS NOT NULL;
CREATE INDEX idx_feedback_rating ON feedback(rating);
CREATE INDEX idx_feedback_goal_alignment ON feedback(goal_alignment) WHERE goal_alignment IS NOT NULL;
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_prompts_brand_id ON subaccount_prompts(brand_id);
CREATE INDEX idx_prompts_created_by ON subaccount_prompts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX idx_versions_created_by ON prompt_versions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_usage_daily_brand_id ON subaccount_usage_daily(brand_id);
CREATE INDEX idx_usage_daily_date ON subaccount_usage_daily(date DESC);
```

---

## 7. Query Patterns

### 7.1 Common SELECT Queries

**Get brand with sub-accounts:**
```sql
SELECT 
  b.*,
  COUNT(DISTINCT sb.id) as subaccount_count,
  COUNT(DISTINCT u.id) as user_count
FROM brands b
LEFT JOIN brands sb ON sb.parent_brand_id = b.id
LEFT JOIN users u ON u.brand_id = b.id
WHERE b.slug = 'corsair'
GROUP BY b.id;
```

**Get jobs for a brand with progress:**
```sql
SELECT 
  j.*,
  COUNT(i.id) as total_images,
  COUNT(ei.id) as completed_images
FROM jobs j
LEFT JOIN images i ON i.job_id = j.id
LEFT JOIN edited_images ei ON ei.job_id = j.id
WHERE j.brand_id = 1
GROUP BY j.id
ORDER BY j.created_at DESC
LIMIT 20;
```

**Get prompt performance analytics:**
```sql
SELECT 
  sp.name,
  pv.version_number,
  pv.usage_count,
  pv.average_rating,
  COUNT(DISTINCT f.id) as feedback_count,
  AVG(f.rating) as avg_feedback_rating
FROM subaccount_prompts sp
JOIN prompt_versions pv ON pv.prompt_id = sp.id
LEFT JOIN edited_images ei ON ei.prompt_version_id = pv.id
LEFT JOIN feedback f ON f.edited_image_id = ei.id
WHERE sp.brand_id = 1
GROUP BY sp.id, pv.id
ORDER BY pv.average_rating DESC NULLS LAST;
```

**Get usage analytics for date range:**
```sql
SELECT 
  date,
  SUM(jobs_created) as total_jobs,
  SUM(jobs_completed) as completed_jobs,
  SUM(images_processed) as total_images,
  SUM(estimated_cost_cents) / 100.0 as total_cost_usd,
  SUM(total_time_saved_seconds) / 3600.0 as hours_saved
FROM subaccount_usage_daily
WHERE brand_id = 1
  AND date >= '2025-10-01'
  AND date < '2025-11-01'
GROUP BY date
ORDER BY date DESC;
```

---

## 8. Performance Optimization

### 8.1 VACUUM and ANALYZE

```sql
-- Regular maintenance (automated in Neon)
VACUUM ANALYZE brands;
VACUUM ANALYZE jobs;
VACUUM ANALYZE images;
VACUUM ANALYZE edited_images;
VACUUM ANALYZE feedback;
```

### 8.2 Query Optimization Tips

1. **Use partial indexes for filtered queries:**
   ```sql
   CREATE INDEX idx_jobs_active_status ON jobs(brand_id, status) WHERE status IN ('pending', 'processing');
   ```

2. **Add covering indexes for common queries:**
   ```sql
   CREATE INDEX idx_jobs_brand_status_created ON jobs(brand_id, status, created_at DESC) 
     INCLUDE (job_id, processing_step);
   ```

3. **Use JSONB indexes for frequent JSONB queries:**
   ```sql
   CREATE INDEX idx_jobs_images_data ON jobs USING GIN (images_data);
   ```

4. **Partition large tables by date (if needed):**
   ```sql
   -- Example for subaccount_usage_daily if it grows very large
   CREATE TABLE subaccount_usage_daily_2025_10 PARTITION OF subaccount_usage_daily
     FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
   ```

---

## Appendix: Database Statistics

### Expected Growth Rates

| Table | Growth Rate | Retention Policy |
|-------|-------------|------------------|
| brands | +50/year | Permanent |
| users | +500/month | Permanent |
| jobs | +4,000/month | 2 years |
| images | +40,000/month | 2 years |
| edited_images | +40,000/month | 2 years |
| feedback | +8,000/month | Permanent |
| usage_daily | +600/day | Permanent |

---

**Document Status:** Ready for implementation  
**Reviewed By:** Engineering Team  
**Approved Date:** November 3, 2025
