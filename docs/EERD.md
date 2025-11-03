# Enhanced Entity Relationship Diagram (EERD)
## Multi-Brand AI Marketing Image Editor

**Document Version:** 1.0  
**Last Updated:** November 3, 2025  
**Purpose:** Comprehensive data model showing entities, relationships, inheritance, and constraints

---

## 1. Overview

This EERD represents the complete data model for a multi-tenant SaaS platform supporting AI-powered marketing image editing. The model incorporates:

- **Multi-tenancy:** Brand isolation with parent-child hierarchies
- **User Management:** Role-based access control with seat limits
- **Job Processing:** Stateful workflow tracking with metrics
- **Asset Management:** Images and edited versions with versioning
- **Prompt Engineering:** Template library with version control
- **Analytics:** Usage tracking and performance metrics
- **Feedback System:** Quality ratings with ML-powered analysis

---

## 2. Entity Definitions

### 2.1 Core Entities

#### **BRANDS (Subaccounts)**
Primary entity representing client organizations with multi-tenant isolation.

**Attributes:**
- `id` (PK) - Serial primary key
- `name` - Unique internal identifier
- `display_name` - User-facing brand name
- `slug` - URL-safe identifier (e.g., "corsair", "lifetrek-medical")
- `parent_brand_id` (FK) - Self-referencing for sub-accounts
- `brand_type` - Enum: 'primary' | 'sub_account'
- `logo_url` - Brand logo asset URL
- `brandbook_url` - Brand guidelines PDF URL
- `website_url` - Reference website
- `primary_color` - Hex color code
- `secondary_color` - Hex color code
- `brief_folder_id` - Google Drive folder ID
- `product_images_folder_id` - Google Drive folder ID
- `edited_results_folder_id` - Google Drive folder ID
- `default_prompt_template` - Default AI prompt text
- `ai_settings` - JSONB: AI configuration parameters
- `wavespeed_api_key` - Encrypted API key
- `openai_api_key` - Encrypted API key
- `auth_password` - bcrypt hashed password
- `seats_purchased` - Integer: maximum users allowed
- `seats_used` - Integer: current active users
- `workflow_config` - JSONB: UI customization schema
- `monthly_job_limit` - Integer: job quota
- `monthly_image_limit` - Integer: image quota
- `active` - Boolean: account status
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Constraints:**
- UNIQUE(name)
- UNIQUE(slug)
- CHECK(seats_used <= seats_purchased)
- CHECK(brand_type IN ('primary', 'sub_account'))

---

#### **USERS**
System-level users who access the platform.

**Attributes:**
- `id` (PK) - Serial primary key
- `email` - Unique email address
- `username` - Unique username
- `password_hash` - bcrypt hashed password
- `role` - Enum: 'admin' | 'brand_admin' | 'user'
- `brand_id` (FK → brands.id) - Associated brand
- `active` - Boolean: account status
- `created_at` - Timestamp
- `last_login_at` - Timestamp

**Constraints:**
- UNIQUE(email)
- UNIQUE(username)
- CHECK(role IN ('admin', 'brand_admin', 'user'))

---

#### **SUBACCOUNT_USERS**
Brand-level users with role-based access control.

**Attributes:**
- `id` (PK) - Serial primary key
- `subaccount_id` (FK → brands.id) - Associated brand
- `user_id` (FK → users.id) - Associated system user
- `email` - User email address
- `password_hash` - bcrypt hashed password
- `role` - Enum: 'owner' | 'admin' | 'member' | 'viewer'
- `invitation_token` - Unique token for invitations
- `invitation_sent_at` - Timestamp
- `invitation_accepted_at` - Timestamp
- `active` - Boolean: account status
- `created_at` - Timestamp
- `last_login_at` - Timestamp

**Constraints:**
- UNIQUE(subaccount_id, email)
- CHECK(role IN ('owner', 'admin', 'member', 'viewer'))

---

#### **JOBS**
Processing sessions linking briefs, images, and results.

**Attributes:**
- `id` (PK) - Serial primary key
- `brand_id` (FK → brands.id) - Brand isolation
- `user_id` (FK → users.id) - Job creator
- `status` - Enum: 'pending' | 'processing' | 'completed' | 'failed'
- `brief_type` - Enum: 'pdf' | 'docx' | 'text'
- `brief_text` - Extracted campaign requirements
- `brief_drive_id` - Google Drive file ID
- `processing_step` - Current step description
- `progress_percentage` - Integer (0-100)
- `total_images` - Integer: images to process
- `images_completed` - Integer: images finished
- `images_data` - JSONB: original image metadata
- `edited_images_data` - JSONB: edited image metadata
- `image_progress` - JSONB: per-image status tracking
- `processing_time_seconds` - Integer: actual processing time
- `manual_estimate_seconds` - Integer: estimated manual time
- `time_saved_seconds` - Integer: calculated savings
- `error_message` - Error details if failed
- `created_at` - Timestamp
- `updated_at` - Timestamp
- `completed_at` - Timestamp

**Constraints:**
- CHECK(status IN ('pending', 'processing', 'completed', 'failed'))
- CHECK(brief_type IN ('pdf', 'docx', 'text'))
- CHECK(progress_percentage >= 0 AND progress_percentage <= 100)

---

#### **IMAGES**
Original product images uploaded by users.

**Attributes:**
- `id` (PK) - Serial primary key
- `job_id` (FK → jobs.id) - Associated job
- `brand_id` (FK → brands.id) - Brand isolation
- `filename` - Original filename
- `drive_id` - Google Drive file ID
- `public_url` - Shareable URL
- `file_size_bytes` - Integer: file size
- `mime_type` - Content type
- `width` - Integer: image width (pixels)
- `height` - Integer: image height (pixels)
- `uploaded_at` - Timestamp

**Constraints:**
- CHECK(file_size_bytes > 0)
- CHECK(mime_type IN ('image/png', 'image/jpeg', 'image/jpg'))

---

#### **EDITED_IMAGES**
AI-edited image versions with prompt tracking.

**Attributes:**
- `id` (PK) - Serial primary key
- `job_id` (FK → jobs.id) - Associated job
- `original_image_id` (FK → images.id) - Source image
- `brand_id` (FK → brands.id) - Brand isolation
- `prompt_id` (FK → subaccount_prompts.id) - Template used
- `prompt_version_id` (FK → prompt_versions.id) - Specific version
- `filename` - Generated filename
- `drive_id` - Google Drive file ID
- `public_url` - Shareable URL
- `prompt_used` - Actual prompt sent to API
- `ai_model` - Model name (e.g., "wavespeed-nano-banana")
- `processing_time_seconds` - Integer: API response time
- `created_at` - Timestamp

**Constraints:**
- CHECK(processing_time_seconds >= 0)

---

#### **SUBACCOUNT_PROMPTS**
Template library for reusable AI prompts.

**Attributes:**
- `id` (PK) - Serial primary key
- `subaccount_id` (FK → brands.id) - Brand isolation
- `name` - Template name
- `description` - Template purpose
- `category` - Grouping (e.g., "Product Photography", "Social Media")
- `is_default` - Boolean: auto-select for new jobs
- `total_uses` - Integer: usage counter
- `active` - Boolean: template availability
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Constraints:**
- CHECK(total_uses >= 0)

---

#### **PROMPT_VERSIONS**
Version history for prompt templates with performance tracking.

**Attributes:**
- `id` (PK) - Serial primary key
- `prompt_id` (FK → subaccount_prompts.id) - Parent template
- `version_number` - Integer: sequential version
- `prompt_template` - Actual prompt text
- `ai_settings` - JSONB: temperature, max_tokens, etc.
- `change_notes` - Description of changes
- `is_active` - Boolean: current active version
- `created_by` - Creator identifier
- `times_used` - Integer: usage counter
- `avg_rating` - Numeric: average user rating
- `created_at` - Timestamp

**Constraints:**
- UNIQUE(prompt_id, version_number)
- CHECK(version_number > 0)
- CHECK(avg_rating >= 1.0 AND avg_rating <= 5.0)

---

#### **FEEDBACK**
User ratings and feedback on edited images.

**Attributes:**
- `id` (PK) - Serial primary key
- `edited_image_id` (FK → edited_images.id) - Rated image
- `job_id` (FK → jobs.id) - Associated job
- `subaccount_id` (FK → brands.id) - Brand isolation
- `user_id` (FK → users.id) - Reviewer
- `overall_rating` - Integer (1-5): overall quality
- `goal_alignment_rating` - Integer (1-5): meets brief requirements
- `creativity_rating` - Integer (1-5): creative quality
- `technical_quality_rating` - Integer (1-5): technical execution
- `feedback_text` - Detailed comments
- `created_at` - Timestamp

**Constraints:**
- CHECK(overall_rating >= 1 AND overall_rating <= 5)
- CHECK(goal_alignment_rating >= 1 AND goal_alignment_rating <= 5)
- CHECK(creativity_rating >= 1 AND creativity_rating <= 5)
- CHECK(technical_quality_rating >= 1 AND technical_quality_rating <= 5)

---

#### **SUBACCOUNT_USAGE_DAILY**
Daily aggregated usage metrics per brand.

**Attributes:**
- `id` (PK) - Serial primary key
- `subaccount_id` (FK → brands.id) - Brand isolation
- `date` - Date: tracking day
- `jobs_created` - Integer: daily job count
- `jobs_completed` - Integer: successful jobs
- `jobs_failed` - Integer: failed jobs
- `images_uploaded` - Integer: original images
- `images_processed` - Integer: edited images
- `wavespeed_api_calls` - Integer: API usage
- `openai_api_calls` - Integer: API usage
- `estimated_cost_usd` - Numeric: daily cost
- `total_processing_time_seconds` - Integer: compute time
- `total_time_saved_seconds` - Integer: efficiency metric
- `created_at` - Timestamp

**Constraints:**
- UNIQUE(subaccount_id, date)
- CHECK(jobs_created >= 0)
- CHECK(estimated_cost_usd >= 0)

---

## 3. Relationships

### 3.1 One-to-Many Relationships

```
BRANDS ||--o{ BRANDS
  (parent_brand_id) - Parent-child sub-account hierarchy

BRANDS ||--o{ USERS
  (brand_id) - Brand owns multiple users

BRANDS ||--o{ SUBACCOUNT_USERS
  (subaccount_id) - Brand has multiple brand-level users

BRANDS ||--o{ JOBS
  (brand_id) - Brand has multiple processing jobs

BRANDS ||--o{ IMAGES
  (brand_id) - Brand owns original images

BRANDS ||--o{ EDITED_IMAGES
  (brand_id) - Brand owns edited images

BRANDS ||--o{ SUBACCOUNT_PROMPTS
  (subaccount_id) - Brand has prompt library

BRANDS ||--o{ SUBACCOUNT_USAGE_DAILY
  (subaccount_id) - Brand has daily usage records

USERS ||--o{ JOBS
  (user_id) - User creates multiple jobs

USERS ||--o{ SUBACCOUNT_USERS
  (user_id) - User can be in multiple brands

USERS ||--o{ FEEDBACK
  (user_id) - User submits multiple ratings

JOBS ||--o{ IMAGES
  (job_id) - Job has multiple original images

JOBS ||--o{ EDITED_IMAGES
  (job_id) - Job produces multiple edited images

JOBS ||--o{ FEEDBACK
  (job_id) - Job receives multiple ratings

IMAGES ||--o{ EDITED_IMAGES
  (original_image_id) - Original image has multiple edits

SUBACCOUNT_PROMPTS ||--o{ PROMPT_VERSIONS
  (prompt_id) - Prompt has multiple versions

SUBACCOUNT_PROMPTS ||--o{ EDITED_IMAGES
  (prompt_id) - Prompt used in multiple edits

PROMPT_VERSIONS ||--o{ EDITED_IMAGES
  (prompt_version_id) - Version used in multiple edits

EDITED_IMAGES ||--o{ FEEDBACK
  (edited_image_id) - Edited image receives multiple ratings
```

---

## 4. Cardinality Notation

```
Relationship Symbols:
||--o{  = One-to-Many (1:N)
||--||  = One-to-One (1:1)
}o--o{  = Many-to-Many (M:N)
```

---

## 5. Enhanced Features

### 5.1 Specialization/Generalization

**BRANDS Entity Specialization:**

```
BRANDS (Superclass)
├── PRIMARY_BRANDS (parent_brand_id IS NULL)
│   └── Additional constraint: Can have child brands
│   └── Attributes: All standard brand attributes
│
└── SUB_ACCOUNTS (parent_brand_id IS NOT NULL)
    └── Additional constraint: Inherits from parent
    └── Attributes: All standard + parent reference
```

**Constraints:**
- **Disjoint:** A brand is EITHER primary OR sub-account
- **Total:** Every brand must be one of these types
- **Inheritance:** Sub-accounts inherit parent's default settings

---

**USERS Entity Specialization:**

```
USERS (Superclass)
├── SYSTEM_ADMINS (role = 'admin')
│   └── Access: Platform-wide administration
│   └── Capabilities: Create/manage brands
│
├── BRAND_ADMINS (role = 'brand_admin')
│   └── Access: Single brand management
│   └── Capabilities: User management, settings
│
└── STANDARD_USERS (role = 'user')
    └── Access: Job creation and management
    └── Capabilities: Create jobs, rate images
```

**Constraints:**
- **Disjoint:** A user has exactly ONE role
- **Total:** Every user must have a role
- **Inheritance:** All roles inherit base user attributes

---

### 5.2 Union Types (Categories)

**IMAGE_OWNER Category:**

```
IMAGE_OWNER = UNION of:
├── JOBS (via job_id)
└── BRANDS (via brand_id)

Meaning: An image belongs to EITHER a specific job OR directly to a brand
```

---

### 5.3 Aggregation

**JOB_PROCESSING_CONTEXT (Aggregation):**

Treats the entire job processing workflow as a higher-level entity:

```
JOB_PROCESSING_CONTEXT
├── Contains: JOB + IMAGES + EDITED_IMAGES + FEEDBACK
└── Represents: Complete processing session
```

This aggregation is useful for:
- Calculating job-level metrics
- Managing transaction boundaries
- Implementing job archival/cleanup

---

## 6. Constraints Summary

### 6.1 Entity Constraints

| Entity | Constraint Type | Description |
|--------|----------------|-------------|
| BRANDS | UNIQUE | name, slug |
| BRANDS | CHECK | seats_used <= seats_purchased |
| BRANDS | CHECK | brand_type IN ('primary', 'sub_account') |
| USERS | UNIQUE | email, username |
| USERS | CHECK | role IN ('admin', 'brand_admin', 'user') |
| SUBACCOUNT_USERS | UNIQUE | (subaccount_id, email) |
| SUBACCOUNT_USERS | CHECK | role IN ('owner', 'admin', 'member', 'viewer') |
| JOBS | CHECK | status IN ('pending', 'processing', 'completed', 'failed') |
| JOBS | CHECK | progress_percentage BETWEEN 0 AND 100 |
| IMAGES | CHECK | file_size_bytes > 0 |
| FEEDBACK | CHECK | all ratings BETWEEN 1 AND 5 |
| PROMPT_VERSIONS | UNIQUE | (prompt_id, version_number) |
| SUBACCOUNT_USAGE_DAILY | UNIQUE | (subaccount_id, date) |

### 6.2 Referential Integrity

All foreign keys enforce `ON DELETE` behavior:

- **CASCADE:** Delete dependent records (e.g., deleting job deletes images)
- **RESTRICT:** Prevent deletion if dependencies exist (e.g., can't delete brand with active jobs)
- **SET NULL:** Null out reference (e.g., deleting user nulls last_edited_by)

---

## 7. Indexes

### 7.1 Primary Indexes (Automatic)

All `id` primary keys have automatic B-tree indexes.

### 7.2 Foreign Key Indexes (Required)

```sql
CREATE INDEX idx_brands_parent ON brands(parent_brand_id);
CREATE INDEX idx_users_brand ON users(brand_id);
CREATE INDEX idx_subaccount_users_subaccount ON subaccount_users(subaccount_id);
CREATE INDEX idx_subaccount_users_user ON subaccount_users(user_id);
CREATE INDEX idx_jobs_brand ON jobs(brand_id);
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_images_job ON images(job_id);
CREATE INDEX idx_images_brand ON images(brand_id);
CREATE INDEX idx_edited_images_job ON edited_images(job_id);
CREATE INDEX idx_edited_images_original ON edited_images(original_image_id);
CREATE INDEX idx_edited_images_brand ON edited_images(brand_id);
CREATE INDEX idx_feedback_edited_image ON feedback(edited_image_id);
CREATE INDEX idx_feedback_job ON feedback(job_id);
CREATE INDEX idx_prompt_versions_prompt ON prompt_versions(prompt_id);
CREATE INDEX idx_usage_daily_subaccount ON subaccount_usage_daily(subaccount_id);
```

### 7.3 Query Optimization Indexes

```sql
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_subaccount_users_email ON subaccount_users(email);
CREATE INDEX idx_feedback_rating ON feedback(overall_rating);
CREATE INDEX idx_usage_daily_date ON subaccount_usage_daily(date DESC);
```

---

## 8. Visual EERD Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BRANDS (Superclass)                           │
│  PK: id                                                                 │
│  UK: name, slug                                                         │
│  Specialization: PRIMARY_BRANDS ⊻ SUB_ACCOUNTS (disjoint, total)       │
│                                                                         │
│  Attributes: name, display_name, slug, parent_brand_id (FK → self),    │
│              logo_url, primary_color, secondary_color, api_keys,       │
│              seats_purchased, seats_used, workflow_config, active       │
└──────┬──────────────────────────────────────────────────────────────────┘
       │ (1)
       │
       ├─────────(N)─────┐
       │                 │
       ▼ (N)             ▼ (N)
┌──────────────┐   ┌─────────────────────────────────┐
│    USERS     │   │      SUBACCOUNT_USERS           │
│  PK: id      │   │  PK: id                         │
│  UK: email   │   │  UK: (subaccount_id, email)     │
│  FK: brand_id├───┤  FK: subaccount_id, user_id     │
│              │   │  Role: owner|admin|member|viewer│
│  Specialization: │                                  │
│  ADMIN ⊻         │                                  │
│  BRAND_ADMIN ⊻   │                                  │
│  USER            │                                  │
└────┬─────────┘   └─────────────────────────────────┘
     │ (1)
     │
     ▼ (N)
┌──────────────────────────────────────────────────────────────────────┐
│                              JOBS                                    │
│  PK: id                                                              │
│  FK: brand_id, user_id                                               │
│                                                                      │
│  Attributes: status, brief_type, brief_text, processing_step,       │
│              progress_percentage, images_data, edited_images_data,  │
│              processing_time_seconds, manual_estimate_seconds       │
└──────┬───────────────────────────────────────────────────────────────┘
       │ (1)
       │
       ├────────────(N)────────┐
       │                       │
       ▼ (N)                   ▼ (N)
┌─────────────┐         ┌──────────────────────────────────┐
│   IMAGES    │         │        EDITED_IMAGES             │
│  PK: id     │         │  PK: id                          │
│  FK: job_id,├────(1)──┤  FK: job_id, original_image_id,  │
│      brand_id│  (N)    │      brand_id, prompt_id,        │
│             │         │      prompt_version_id           │
│  Attributes:│         │                                  │
│  filename,  │         │  Attributes: filename, drive_id, │
│  drive_id,  │         │  prompt_used, ai_model,          │
│  public_url │         │  processing_time_seconds         │
└─────────────┘         └──────┬───────────────────────────┘
                               │ (1)
                               │
                               ▼ (N)
                        ┌────────────────────────────────┐
                        │          FEEDBACK              │
                        │  PK: id                        │
                        │  FK: edited_image_id, job_id,  │
                        │      subaccount_id, user_id    │
                        │                                │
                        │  Ratings (1-5):                │
                        │  - overall_rating              │
                        │  - goal_alignment_rating       │
                        │  - creativity_rating           │
                        │  - technical_quality_rating    │
                        │  - feedback_text               │
                        └────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      SUBACCOUNT_PROMPTS                              │
│  PK: id                                                              │
│  FK: subaccount_id                                                   │
│                                                                      │
│  Attributes: name, description, category, is_default, total_uses    │
└──────┬───────────────────────────────────────────────────────────────┘
       │ (1)
       │
       ▼ (N)
┌──────────────────────────────────────────────────────────────────────┐
│                      PROMPT_VERSIONS                                 │
│  PK: id                                                              │
│  UK: (prompt_id, version_number)                                     │
│  FK: prompt_id                                                       │
│                                                                      │
│  Attributes: version_number, prompt_template, ai_settings,          │
│              is_active, times_used, avg_rating                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   SUBACCOUNT_USAGE_DAILY                             │
│  PK: id                                                              │
│  UK: (subaccount_id, date)                                           │
│  FK: subaccount_id                                                   │
│                                                                      │
│  Attributes: date, jobs_created, jobs_completed, images_processed,  │
│              api_calls, estimated_cost_usd, total_time_saved         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Integrity Rules

### 9.1 Business Rules Enforced by Constraints

1. **Seat Management:**
   - `brands.seats_used` ≤ `brands.seats_purchased`
   - Trigger to increment/decrement on user add/remove

2. **Job Progress Validation:**
   - `jobs.progress_percentage` BETWEEN 0 AND 100
   - `jobs.images_completed` ≤ `jobs.total_images`

3. **Rating Validation:**
   - All `feedback` ratings BETWEEN 1 AND 5
   - `prompt_versions.avg_rating` calculated from feedback

4. **Active Version Control:**
   - Only ONE `prompt_versions.is_active = true` per prompt_id
   - Trigger to deactivate previous versions

5. **Brand Hierarchy:**
   - PRIMARY brands: `parent_brand_id IS NULL`
   - SUB_ACCOUNTS: `parent_brand_id IS NOT NULL`
   - Cannot delete parent if children exist (RESTRICT)

### 9.2 Cascading Delete Rules

```
DELETE BRAND → CASCADE delete:
  ├── Users
  ├── Subaccount_Users
  ├── Jobs
  ├── Images
  ├── Edited_Images
  ├── Prompts
  ├── Prompt_Versions
  ├── Feedback
  └── Usage_Daily

DELETE JOB → CASCADE delete:
  ├── Images
  ├── Edited_Images
  └── Feedback

DELETE PROMPT → CASCADE delete:
  └── Prompt_Versions
```

---

## 10. Normalization Analysis

### 10.1 Normal Forms Achieved

**1NF (First Normal Form):** ✅
- All attributes are atomic (no multi-valued attributes)
- Each table has a primary key
- No repeating groups

**2NF (Second Normal Form):** ✅
- All non-key attributes fully dependent on primary key
- No partial dependencies

**3NF (Third Normal Form):** ✅
- No transitive dependencies
- All non-key attributes directly depend on primary key

**BCNF (Boyce-Codd Normal Form):** ✅
- Every determinant is a candidate key
- No anomalies from functional dependencies

### 10.2 Denormalization Decisions

Intentional denormalization for performance:

1. **jobs.images_data (JSONB):**
   - Stores full image metadata for fast job retrieval
   - Avoids N+1 queries when loading job details

2. **jobs.edited_images_data (JSONB):**
   - Caches edited image URLs for instant results display
   - Reduces joins during job status polling

3. **subaccount_prompts.total_uses:**
   - Cached count to avoid expensive COUNT() queries
   - Updated via triggers on edited_images insert

4. **prompt_versions.avg_rating:**
   - Pre-calculated average from feedback table
   - Updated via trigger on feedback insert/update

---

## 11. Transaction Boundaries

### 11.1 Critical Transactions

**Job Creation Transaction:**
```sql
BEGIN;
  INSERT INTO jobs (...) RETURNING id;
  INSERT INTO images (...);
  UPDATE brands SET monthly_job_limit = monthly_job_limit - 1;
COMMIT;
```

**User Invitation Transaction:**
```sql
BEGIN;
  INSERT INTO subaccount_users (...);
  UPDATE brands SET seats_used = seats_used + 1;
COMMIT;
```

**Feedback Submission Transaction:**
```sql
BEGIN;
  INSERT INTO feedback (...);
  UPDATE prompt_versions SET avg_rating = (new_avg);
  UPDATE edited_images SET feedback_count = feedback_count + 1;
COMMIT;
```

---

## 12. Appendix

### 12.1 Entity Count Estimates (Year 1)

| Entity | Estimated Count |
|--------|----------------|
| Brands | 100 primary + 500 sub-accounts |
| Users | 5,000 system users |
| Subaccount_Users | 10,000 brand users |
| Jobs | 50,000 jobs/year |
| Images | 500,000 images/year |
| Edited_Images | 500,000 edits/year |
| Feedback | 100,000 ratings/year |
| Prompts | 1,000 templates |
| Prompt_Versions | 5,000 versions |
| Usage_Daily | 219,000 records (600 brands × 365 days) |

### 12.2 Storage Estimates

| Data Type | Size | Notes |
|-----------|------|-------|
| Database | 50 GB | Year 1 estimate |
| Google Drive | 5 TB | Original + edited images |
| Logs | 10 GB | Application and API logs |

---

**Document Status:** Approved for implementation  
**Next Steps:** Generate relational schema SQL from this EERD
