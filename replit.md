# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. This platform allows users to upload marketing briefs (PDF, DOCX, or text prompt) and product images for instant AI-powered editing. Key capabilities include brand-specific theming, interactive before/after image comparisons, an AI chat assistant for selective re-editing, and the ability to download layered PSD files. The system enhances efficiency and reduces the time required for marketing image production.

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

### CRM-Style Subaccount Management
The platform includes a CRM system for managing subaccounts with features like:
- **Database Schema**: Tables for `brands` (subaccounts), `subaccount_users`, `subaccount_prompts`, `prompt_versions`, `subaccount_usage_daily`, `feedback`, `edited_images`. Includes CRM-specific columns for `seats_purchased`, `workflow_config`, `monthly_job_limit`, etc.
- **User Management**: Multi-user support per subaccount with role-based access control, seat tracking, and an invitation system.
- **Prompt Management**: Per-subaccount prompt template library with version control and performance tracking.
- **Usage Analytics**: Daily tracking of jobs, images, API calls, and cost/time savings per subaccount.
- **Output Quality Analytics**: Rating system (1-5 stars) and feedback collection linked to edited images for trend and prompt performance analysis.
- **Workflow Customization**: JSON-based workflow configuration with future visual builder.
- **Admin CRM Dashboard**: Comprehensive dashboard for managing users, prompts, workflows, and analytics, secured with `verifyAdminToken` middleware.

### Multi-Tenant Architecture
- **Brand Isolation**: Isolated Google Drive folders, branding assets, and AI configurations per brand/subaccount.
- **Dynamic Theming**: Frontend dynamically loads brand-specific assets.
- **Secure Credential Management**: API keys loaded securely per-request.
- **Admin Security**: Brand management protected by `X-Admin-Key` header.

### Authentication & Authorization System
- **User Authentication**: JWT-based authentication for main editor application with protected routes. User tokens stored in localStorage.
- **Login UI**: Premium design with animated gradients and Corsair brand colors.
- **Brand-Specific Authentication**: Each brand/sub-account has its own login with bcrypt-hashed passwords. Brand JWT tokens include `brandId`, `brandSlug`, and `brandName`.
- **Automatic Token Inclusion**: Frontend utilities automatically attach brand tokens to API requests.
- **Middleware Enforcement**: `brandContextMiddleware` enforces data isolation based on brand tokens.
- **Blob URL Strategy**: Images loaded via authenticated fetch and converted to blob URLs for secure access.
- **Parent-Child Brands**: Supports sub-accounts with isolated authentication and data.
- **Login Routes**: Brand-specific login pages at `/:brandSlug/login`.

### UI/UX Decisions
- **Aesthetic**: Sleek, dark gaming aesthetic with brand-specific theming.
- **Interactive Elements**: Before/after comparison sliders and a floating AI chat assistant.
- **Workflow Visualization**: Live display of processing steps and results gallery.
- **Metrics Dashboard**: `TimeMetricsPanel` showing "Time Saved," "Efficiency Gain," etc.

### Technical Implementations
- **Triple Input Modes**: Supports PDF, DOCX, or text prompts; DOCX includes intelligent image filtering.
- **Parallel Processing**: Images processed in parallel batches with real-time progress updates.
- **AI Chat with Function Calling**: GPT-4 based for natural language re-editing of selected images.
- **ML Feedback System**: GPT-4 powered 5-star rating and text feedback for continuous prompt improvement. Includes `MLAnalysisService` for intelligent feedback analysis and prompt optimization suggestions.
- **Job-based Architecture**: Isolates each job with a unique ID and dedicated storage, ensuring concurrent user support. Implemented a hybrid job storage system using in-memory cache and PostgreSQL persistence for reliability.
- **PSD Download**: Generates layered PSD files (Original + AI Edited) using `ag-psd` and `node-canvas`.

### Feature Specifications
- **File Upload Interface**: Client-side validation, multi-image upload, large file support.
- **Results Gallery**: Individual, bulk ZIP, and PSD downloads.
- **AI Chat Capabilities**: Context-aware responses and selective image re-editing.
- **Time Tracking**: Comprehensive backend tracking for processing, manual, and saved time.

## External Dependencies
- **PostgreSQL Database (Neon)**: Multi-tenant data storage.
- **Google Drive API**: File storage for briefs, product images, and results.
- **Wavespeed Nano Banana API**: Primary AI-powered image editing.
- **OpenAI API (GPT-4)**: AI Chat Assistant, function calling, ML feedback system.
- **Mammoth.js**: Extracts text and images from DOCX.
- **pdfjs-dist**: Processes PDF files.
- **ag-psd** and **node-canvas**: Generates layered PSD files.
- **Drizzle ORM**: PostgreSQL schema management and queries.
- **bcrypt**: Password hashing.