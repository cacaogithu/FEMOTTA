# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. This platform allows users to upload marketing briefs (PDF, DOCX, or text prompt) and product images, which are then processed by the Wavespeed Nano Banana API for instant AI-powered image editing. Key capabilities include brand-specific theming, interactive before/after image comparisons, an AI chat assistant for selective re-editing, and the ability to download layered PSD files. The system delivers significant ROI by enhancing efficiency and reducing the time required for marketing image production.

## User Preferences
- I prefer clear and concise explanations.
- I value detailed workflow visualization.
- I expect robust error handling and validation.
- I want to see the ROI and efficiency metrics clearly presented.
- I need the AI chat to be able to edit specific images, not just all of them.
- Ensure that the AI chat can trigger actual re-edits based on natural language commands.
- I prefer the AI to make subtle, professional image edits rather than heavy manipulations.
- The system should prevent the processing of embedded logos from DOCX files and focus only on relevant product images.

## System Architecture
The application is a multi-tenant SaaS platform built with a React.js frontend (Vite), a Node.js/Express backend, and a PostgreSQL database (Neon). It utilizes Google Drive for file storage and integrates directly with the Wavespeed Nano Banana API for image processing.

### CRM-Style Subaccount Management (New!)
The platform has evolved from simple brand isolation to a comprehensive CRM system for managing subaccounts:

**Database Schema:**
- **Subaccount Tables**: `brands` (renamed conceptually to subaccounts), `subaccount_users`, `subaccount_prompts`, `prompt_versions`, `subaccount_usage_daily`, `feedback`, `edited_images`
- **CRM Columns**: `seats_purchased`, `seats_used`, `workflow_config`, `monthly_job_limit`, `monthly_image_limit`

**User Management:**
- Multi-user support per subaccount with role-based access control (owner, admin, member, viewer)
- Seat tracking and limits - enforce maximum users per subaccount
- User invitation system with tokens
- bcrypt-hashed passwords for each subaccount user

**Prompt Management:**
- Prompt template library per subaccount
- Version control for prompts with performance tracking
- Activate/deprecate prompt versions
- Link prompts to edited images for analytics

**Usage Analytics:**
- Daily usage tracking: jobs created/completed/failed, images uploaded/processed
- API call tracking (Wavespeed, OpenAI)
- Cost estimation per subaccount
- Time savings metrics (processing time vs. manual estimate)

**Output Quality Analytics:**
- Rating system (1-5 stars) with detailed metrics (goal alignment, creativity, technical quality)
- Feedback collection linked to specific edited images
- Rating trends over time
- Prompt performance analysis

**Workflow Customization:**
- JSON-based workflow configuration storage
- Visual workflow builder (UI placeholder ready)
- Per-subaccount workflow customization

**Admin CRM Dashboard:**
- **Overview Tab**: Key metrics (users, jobs, images, prompts), usage limits
- **Users Tab**: Add/remove users, role assignment, seat tracking, last login tracking
- **Prompts Tab**: Template library with versions, categories, default flags
- **Workflow Tab**: Workflow preview and customization (coming soon)
- **Analytics Tab**: Usage stats, cost tracking, time saved metrics

**Security:**
- All CRM endpoints protected by `verifyAdminToken` middleware
- Admin-only access to user management, prompt control, and analytics
- JWT-based admin authentication with token expiration

### Multi-Tenant Architecture
- **Brand Isolation**: Each brand operates with isolated Google Drive folders, branding assets, and AI configurations.
- **Dynamic Theming**: The frontend dynamically loads brand-specific logos, colors, and prompts from the database.
- **Secure Credential Management**: API keys are loaded securely per-request using a `brandLoader` utility without exposing them in job states.
- **Admin Security**: Brand management is protected by `X-Admin-Key` header authentication.

### Authentication & Authorization System
- **Brand-Specific Authentication**: Each brand/sub-account has its own login credentials with bcrypt-hashed passwords stored securely.
- **JWT Token-Based Auth**: Brand logins generate JWT tokens (role: 'brand') that include brandId, brandSlug, and brandName.
- **Automatic Token Inclusion**: Frontend uses `authenticatedFetch`, `postJSON`, and `postFormData` utilities that automatically attach brand tokens from localStorage to all API requests.
- **Middleware Enforcement**: `brandContextMiddleware` verifies JWT tokens and enforces brand data isolation - users can only access their own brand's jobs, images, and results.
- **Blob URL Strategy**: Image previews (BeforeAfterSlider, ImagePreview) load images via authenticatedFetch and convert to blob URLs, ensuring all image access is authenticated.
- **Parent-Child Brands**: Supports sub-accounts (e.g., LifeTrek Medical under Corsair) with isolated authentication and data.
- **Login Routes**: Brand-specific login pages available at `/:brandSlug/login` (e.g., `/lifetrek-medical/login`).
- **Backward Compatibility**: Unauthenticated requests default to 'corsair' brand for legacy support.

### UI/UX Decisions
- **Aesthetic**: Features a sleek, dark gaming aesthetic with brand-specific theming.
- **Interactive Elements**: Includes before/after comparison sliders for edited images and a floating AI chat assistant widget.
- **Workflow Visualization**: Provides live display of processing steps and a results gallery with download options.
- **Metrics Dashboard**: A `TimeMetricsPanel` displays "Time Saved," "Efficiency Gain," "Processing Time," and "Manual Estimate."

### Technical Implementations
- **Triple Input Modes**: Supports PDF, DOCX, or text prompts; DOCX includes intelligent image filtering to skip logos.
- **Parallel Processing**: Images are processed in parallel batches of 15 using `Promise.all` for efficiency, with real-time progress updates.
- **AI Chat with Function Calling**: Leverages GPT-4 for natural language re-editing of selected images.
- **ML Feedback System**: Incorporates a 5-star rating and text feedback mechanism, powered by GPT-4 for continuous prompt improvement.
- **Job-based Architecture**: Ensures concurrent user support by isolating each job with a unique ID and dedicated storage.
- **PSD Download**: Generates layered PSD files for each image (Original + AI Edited) using `ag-psd` and `node-canvas`.

### Feature Specifications
- **File Upload Interface**: Client-side validation, multi-image upload, and support for large files.
- **Results Gallery**: Offers individual image download, bulk ZIP download, and PSD download.
- **AI Chat Capabilities**: Provides context-aware responses and selective image re-editing.
- **Time Tracking**: Comprehensive backend tracking for processing time, estimated manual time, and time saved.

## Recent Changes (October 26, 2025)
**CRM System Implementation:**
- Transformed brand management into comprehensive subaccount CRM system
- Added 6 new database tables for CRM features (users, prompts, analytics, feedback)
- Built SubaccountDetail admin dashboard with 6-tab interface
- Implemented multi-user management with RBAC and seat limits
- Created prompt template library with versioning system
- Integrated usage analytics and output quality tracking
- Secured all CRM endpoints with admin authentication
- Updated terminology from "brands" to "subaccounts" in admin UI

**ML Phase 1: Smart Prompt Optimization (NEW!):**
- Created `MLAnalysisService` using GPT-4 for intelligent feedback analysis
- Analyzes prompt performance across rating metrics (overall, goal alignment, creativity, technical quality)
- Generates AI-powered prompt improvement suggestions based on low-rated feedback patterns
- Identifies what makes high-performing prompts successful
- Built API endpoints: `/api/ml/analyze/:subaccountId`, `/api/ml/insights/:subaccountId`, `/api/ml/suggest-improvement/:promptId/:versionId`
- Added **ML Insights** tab (🤖) to SubaccountDetail dashboard with:
  - One-click analysis button to run GPT-4 prompt optimization
  - Performance breakdown table showing ratings by prompt version
  - AI-generated improvement cards with problem analysis, improved prompts, key changes, and expected impact
  - Success rate tracking and feedback count metrics
- All ML endpoints secured with admin authentication
- Zero infrastructure requirements - uses existing OpenAI GPT-4 API integration

**Active Subaccounts:**
- **Corsair** (Primary): Login at `/corsair/login` (password: corsair2025)
- **LifeTrek Medical** (Sub-account): Login at `/lifetrek-medical/login` (password: lifetrek2025)

Both subaccounts have 5 seats purchased, 0 currently used.

## External Dependencies
- **PostgreSQL Database (Neon)**: Used for multi-tenant data storage (subaccounts, users, jobs, images, prompts, analytics).
- **Google Drive API**: Manages storage for briefs, product images, and edited results, with brand-specific folder isolation.
- **Wavespeed Nano Banana API**: Primary integration for AI-powered image editing.
- **OpenAI API (GPT-4)**: Powers the AI Chat Assistant, function calling, and the ML feedback system.
- **Mammoth.js**: Extracts text and images from DOCX files.
- **pdfjs-dist**: Processes PDF files for text extraction.
- **ag-psd** and **node-canvas**: Used for generating layered PSD files.
- **Drizzle ORM**: Facilitates PostgreSQL schema management and queries.
- **bcrypt**: Password hashing for admin and subaccount user authentication.