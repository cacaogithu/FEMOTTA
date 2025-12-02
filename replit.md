# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. This platform allows users to upload marketing briefs (PDF, DOCX, or text prompt) and product images for instant AI-powered editing. Key capabilities include brand-specific theming, interactive before/after image comparisons, an AI chat assistant for selective re-editing, and the ability to download layered PSD files with editable text. The system enhances efficiency and reduces the time required for marketing image production, with a vision to become the leading AI-powered image editing solution for marketing teams globally.

## Recent Changes
- **December 2025**: Migrated from raw REST API to `@google/genai` SDK for improved reliability
- **December 2025**: Added configurable model selection via `GEMINI_IMAGE_MODEL` environment variable
- **December 2025**: Default model updated to `gemini-2.5-flash-image` with support for `gemini-3-pro-image-preview`
- **December 2025**: Added CANVAS_TEST_ENABLED feature flag for canvas test route security
- **December 2025**: Enhanced prompt templates with explicit character-for-character text accuracy instructions

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
The application is a multi-tenant SaaS platform built with a React.js frontend (Vite), a Node.js/Express backend, and a PostgreSQL database (Neon). It utilizes Google Drive for file storage and integrates with Google Gemini for AI-powered image editing.

### Multi-Tenant CRM-Style Platform
- **Brand Isolation**: Isolated Google Drive folders, branding assets, and AI configurations per brand/subaccount.
- **Dynamic Theming**: Frontend dynamically loads brand-specific assets.
- **CRM System**: Manages subaccounts with user management (role-based access, seat tracking), per-subaccount prompt template library with version control, and usage/output quality analytics.
- **Admin Dashboard**: Comprehensive dashboard for managing users, prompts, workflows, and analytics, secured with `verifyAdminToken` middleware.
- **Authentication**: Dual authentication system supporting:
  - **Replit Auth (SSO)**: OpenID Connect integration via `server/replitAuth.js` supporting Google, GitHub, X, Apple, and email/password login. Sessions stored in PostgreSQL via connect-pg-simple.
  - **Local Registration**: Self-signup via `/register` page with bcrypt-hashed passwords (`client/src/pages/UserRegister.jsx`).
  - **Brand-specific logins**: `/:brandSlug/login` with JWT tokens containing `brandId`, `brandSlug`, and `brandName`. `brandContextMiddleware` enforces data isolation.
  - **Key files**: `server/replitAuth.js` (OIDC setup), `server/storage.js` (user operations), `client/src/hooks/useAuth.js` (frontend hook).
  - **Required env vars for production**: SESSION_SECRET, REPL_ID, ISSUER_URL.

### UI/UX Decisions
- **Aesthetic**: Sleek, dark gaming aesthetic with brand-specific theming.
- **Interactive Elements**: Before/after comparison sliders and a floating AI chat assistant.
- **Workflow Visualization**: Live display of processing steps and results gallery.
- **Metrics Dashboard**: `TimeMetricsPanel` showing "Time Saved," "Efficiency Gain," etc.
- **Navigation**: Editor and History tabs for workflow switching.

### Core Technical Implementations
- **Processing Pipeline**: Multi-stage (Uploading, Extracting, Rendering, Exporting) with visual feedback and parallel batch processing.
- **History & Archival System**: Automatic archival of jobs to local storage and PostgreSQL, with a dedicated UI tab for viewing past batches and re-downloading (ZIP, individual images, PSDs).
- **Marketplace-Specific Presets**: Pre-configured output settings with AI behavior modifications for platforms like Amazon (Strict Compliance), Alibaba (Creative Marketing), and a general Website preset. These include AI prompt modifiers, aspect ratio, dimension limits, margins, padding, background, and color vibrance adjustments.
- **Custom Google Drive Destinations**: Users can specify a custom Google Drive folder URL for output uploads with validation and folder ID extraction.
- **PSD Export with Editable Text Layers**: Server-side PSD generation using ag-psd library. Creates true layered PSDs with fully editable text layers that work natively in Adobe Photoshop. Text layers reference Saira font family (Saira-Bold for titles, Saira-Regular for subtitles). The PSD download uses signed URLs via `/api/psd/signed-url/:jobId/:imageIndex` endpoint for reliable file delivery.
- **Smart Logo Detection & Overlay**: Automatically detects logo requests in brief text using OpenAI extraction (`logo_requested: true/false`, `logo_name`). Small embedded images (<50KB) in DOCX are classified as logos. When a spec requests a logo, the system overlays it programmatically using Sharp with proportional sizing (15% of image width) and proper margins.
- **Triple Input Modes**: Supports PDF, DOCX (with intelligent image filtering), or text prompts.
- **AI Chat with Vision**: GPT-4o with vision capabilities for precise re-editing based on visual analysis and natural language commands. Automatically detects image references.
- **Google Gemini Image API**: Uses `@google/genai` SDK via `server/services/nanoBananaService.js` for true image editing that preserves original product images. Supports multiple models:
  - `gemini-2.5-flash-image` (Nano Banana) - Default, fast image generation
  - `gemini-3-pro-image-preview` (Nano Banana Pro) - Advanced image editing with 2K/4K resolution
  - Model selection via `GEMINI_IMAGE_MODEL` environment variable
- **ML Feedback System**: GPT-4 powered 5-star rating and text feedback for continuous prompt improvement and prompt optimization.
- **Job-based Architecture**: Isolates each job with a unique ID and dedicated storage (in-memory cache and PostgreSQL persistence).
- **Iterative Re-editing**: Re-edits download the previously edited image to build on prior AI work, allowing for sequential refinements.

## External Dependencies
- **PostgreSQL Database (Neon)**: Multi-tenant data storage.
- **Google Drive API**: File storage for briefs, product images, and results.
- **Google Gemini Image API**: Primary AI-powered image editing provider using `@google/genai` SDK. Supports both Nano Banana (gemini-2.5-flash-image) and Nano Banana Pro (gemini-3-pro-image-preview) models with up to 4K resolution output in PNG format.
- **OpenAI API (GPT-4o)**: AI Chat Assistant with vision, function calling, ML feedback system.
- **ag-psd**: Server-side PSD generation with editable text layers.
- **Mammoth.js**: Extracts text and images from DOCX.
- **pdfjs-dist**: Processes PDF files.
- **Drizzle ORM**: PostgreSQL schema management and queries.
- **bcrypt**: Password hashing.
- **archiver**: ZIP file generation for batch downloads.

## Environment Variables
### Required
- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Google Gemini API key for image editing
- `OPENAI_API_KEY` - OpenAI API key for chat and analysis
- `JWT_SECRET` - JWT token signing secret
- `SESSION_SECRET` - Session encryption secret

### Optional
- `GEMINI_IMAGE_MODEL` - Gemini model for image editing (default: `gemini-2.5-flash-image`, options: `gemini-3-pro-image-preview`)
- `CANVAS_TEST_ENABLED` - Enable canvas test route (default: false)

## Typography System
- **Saira Font Family**: All text overlays use the Saira geometric sans-serif font exclusively
  - Saira Bold for titles (uppercase, white, top-left positioning)
  - Saira Regular for subtitles (sentence case, white, below title)
- **Curated Reference System**: `server/services/sairaReference.js` provides canonical typography guidelines that are automatically injected into all Gemini prompts
- **Image Preservation**: Prompts explicitly forbid modifying the original image - only text overlays and subtle gradients are added
- **Character-for-Character Accuracy**: Prompts include explicit instructions to copy text exactly as provided, preventing AI spelling modifications

## AI Prompt System
The prompt system (`server/services/promptTemplates.js`) uses a strict structure to prevent unwanted text from appearing in generated images:

- **RENDER_TEXT Section**: Contains ONLY the literal title and subtitle strings in key=value format (TITLE="...", SUBTITLE="...")
- **GUIDANCE Section**: Styling instructions explicitly marked as non-renderable with "(do NOT draw any of this)" disclaimer
- **FORBIDDEN Section**: Explicit list of terms that should never appear (numbers, percentages, technical terms like "gradient", "opacity", "px", etc.)
- **PRESERVE IMAGE Section**: Instructions to keep original product image unchanged
- **TEXT ACCURACY Section**: Explicit instructions to copy text character-for-character without modifications

**Important**: Logo overlays are handled by post-processing (`overlayLogoOnImage` using Sharp library), NOT by the AI prompt. This prevents duplication and ensures consistent logo placement.

## File Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── services/       # API service layer
│   └── vite.config.js
├── server/                 # Node.js/Express backend
│   ├── controllers/        # Route controllers
│   ├── routes/             # API routes
│   ├── services/           # Business logic services
│   │   ├── nanoBananaService.js    # Google Gemini image editing
│   │   ├── promptTemplates.js      # AI prompt generation
│   │   └── sairaReference.js       # Typography guidelines
│   ├── middleware/         # Express middleware
│   └── utils/              # Utility functions
├── docs/                   # Strategy documentation
│   ├── PRD.md              # Product Requirements
│   ├── EERD.md             # Entity Relationship Diagram
│   ├── RELATIONAL_SCHEMA.md # Database schema
│   └── DATABASE_VERIFICATION.md
├── fonts/                  # Saira font files
│   ├── Saira-Bold.ttf
│   └── Saira-Regular.ttf
└── storage/                # Local file storage
```
