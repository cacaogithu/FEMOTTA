# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. This platform allows users to upload marketing briefs (PDF, DOCX, or text prompt) and product images for instant AI-powered editing. Key capabilities include brand-specific theming, interactive before/after image comparisons, an AI chat assistant for selective re-editing, and the ability to download layered PSD files with editable text. The system enhances efficiency and reduces the time required for marketing image production.

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
- **Tab Navigation**: Editor and History tabs in main navigation for easy workflow switching.

## Core Features

### Processing Pipeline
The platform uses a multi-stage processing pipeline with clear visual feedback:
1. **Uploading** - Files uploaded to Google Drive cloud storage
2. **Extracting** - AI parses creative brief (PDF/DOCX/text) to extract image specifications
3. **Rendering** - AI edits product images with extracted prompts (parallel batch processing)
4. **Exporting** - Results saved to storage with concurrent download/upload operations

### History & Batch Archival System
- **Automatic Archival**: Jobs automatically archived upon completion to both local storage (`storage/history/`) and PostgreSQL database
- **History Tab**: Dedicated UI tab for viewing all past batches with thumbnails and metadata
- **Re-download Capability**: Full re-download support for any historical batch (ZIP, individual images, PSD files)
- **Batch Metadata**: Stores image counts, processing times, time saved metrics, and completion timestamps
- **API Endpoints**:
  - `GET /api/history` - Paginated list of completed batches
  - `GET /api/history/:batchId` - Detailed batch information
  - `GET /api/history/:batchId/download` - Download options (type=zip, type=edited, type=original)
  - `GET /api/history/:batchId/psd/:imageIndex` - Download PSD for specific image

### Marketplace-Specific Presets
Pre-configured output settings for different e-commerce platforms:
- **Default**: Standard output settings
- **Amazon**: Optimized for Amazon product listings (aspect ratios, dimensions)
- **Alibaba**: Configured for Alibaba marketplace requirements
- **Website**: General web-optimized settings

Each preset includes:
- Aspect ratio specifications
- Maximum dimension limits
- Margin and padding rules
- Background padding options
- Accepted output formats

### Custom Google Drive Destinations
- **Drive URL Input**: Users can specify a custom Google Drive folder URL for output uploads
- **URL Validation**: Validates Google Drive folder URL patterns before processing
- **Folder ID Extraction**: Automatically extracts folder ID from various Google Drive URL formats
- **Fallback Behavior**: Uses default brand folder if no custom destination specified

### PSD Export with Editable Text Layers
**Critical Feature**: Generates layered PSD files with fully editable text that can be modified in Adobe Photoshop.

**Text Layer Specifications**:
- **Font**: Montserrat ExtraBold (titles) and Montserrat Regular (subtitles)
- **Positioning**: Exact XY positioning calculated from actual image dimensions
- **Responsive Sizing**: Title font size 36-72px, subtitle 16-32px based on image dimensions
- **Layer Structure**: Original image layer + AI-edited layer + editable text layers

**PSD API Endpoints**:
- `GET /api/psd/capabilities` - Returns PSD generation capabilities including `supportsTextLayers: true`
- `GET /api/psd/info/:jobId/:imageIndex` - Returns JSON metadata with text positions, sizes, fonts, and colors
- `GET /api/psd/:jobId/:imageIndex` - Downloads the layered PSD file

### Technical Implementations
- **Triple Input Modes**: Supports PDF, DOCX, or text prompts; DOCX includes intelligent image filtering.
- **Parallel Processing**: Images processed in parallel batches (batch size: 15) with real-time progress updates.
- **Parallel Export**: Image saving uses Promise.all for concurrent download/upload operations.
- **AI Chat with Vision**: GPT-4o with vision capabilities - can SEE referenced images and generate precise edit prompts based on visual analysis. Automatically detects image references (e.g., "image 13") and attaches them to the conversation.
- **Hybrid AI Strategy**: Gemini Batch API for 50% cost savings on non-urgent analysis (brief parsing, quality checks, prompt optimization) with 24-hour turnaround. Wavespeed Nano Banana for all actual image editing (instant results).
- **ML Feedback System**: GPT-4 powered 5-star rating and text feedback for continuous prompt improvement. Includes `MLAnalysisService` for intelligent feedback analysis and prompt optimization suggestions.
- **Job-based Architecture**: Isolates each job with a unique ID and dedicated storage, ensuring concurrent user support. Implemented a hybrid job storage system using in-memory cache and PostgreSQL persistence for reliability.
- **Iterative Re-editing**: Re-edits download the edited image (not original) to build on previous AI work, enabling commands like "remove title from image 12" to preserve all previous branding/overlays.

### Feature Specifications
- **File Upload Interface**: Client-side validation, multi-image upload, large file support.
- **Results Gallery**: Individual, bulk ZIP, and PSD downloads.
- **AI Chat Capabilities**: Context-aware responses and selective image re-editing.
- **Time Tracking**: Comprehensive backend tracking for processing, manual, and saved time.

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── ProcessingPage.jsx    # Processing UI with step indicators
│   │   ├── ProcessingPage.css    # Polished processing styles
│   │   ├── HistoryPanel.jsx      # Batch history viewer
│   │   ├── ResultsPage.jsx       # Results gallery with downloads
│   │   ├── UploadPage.jsx        # File upload interface
│   │   └── WorkflowViewer.jsx    # Live workflow visualization
│   ├── config/
│   │   └── marketplacePresets.js # Marketplace preset definitions
│   ├── services/
│   │   └── brandService.js       # Brand configuration loader
│   └── App.jsx                   # Main app with tab navigation

server/
├── controllers/
│   ├── processController.js      # Image processing orchestration
│   ├── uploadController.js       # File upload & processing pipeline
│   └── psdController.js          # PSD generation with text layers
├── services/
│   ├── historyService.js         # Batch archival & retrieval
│   ├── nanoBanana.js             # Wavespeed API integration
│   ├── geminiService.js          # Gemini Batch API
│   └── mlLearning.js             # Quality analysis & feedback
├── routes/
│   ├── history.js                # History API endpoints
│   └── psd.js                    # PSD API endpoints
├── utils/
│   ├── googleDrive.js            # Google Drive operations
│   └── jobStore.js               # Job state management
└── middleware/
    └── brandContext.js           # Brand isolation middleware

storage/
└── history/                      # Local batch archive storage
```

## External Dependencies
- **PostgreSQL Database (Neon)**: Multi-tenant data storage.
- **Google Drive API**: File storage for briefs, product images, and results.
- **Wavespeed Nano Banana API**: Primary AI-powered image editing (all real-time edits).
- **OpenAI API (GPT-4o)**: AI Chat Assistant with vision, function calling, ML feedback system.
- **Google Gemini Batch API**: Cost-optimized bulk analysis (50% savings, 24hr turnaround) for brief parsing, quality checks, prompt optimization.
- **Mammoth.js**: Extracts text and images from DOCX.
- **pdfjs-dist**: Processes PDF files.
- **ag-psd** and **node-canvas**: Generates layered PSD files with editable text.
- **Drizzle ORM**: PostgreSQL schema management and queries.
- **bcrypt**: Password hashing.
- **archiver**: ZIP file generation for batch downloads.

## Recent Changes (November 2025)
- **Nov 26**: Performance optimizations - Parallelized image saving with Promise.all for concurrent download/upload operations. Updated ProcessingPage UI with clear step labels (Uploading, Extracting, Rendering, Exporting) and polished styling with consistent spacing.
- **Nov 26**: Added History tab with batch archival system - Jobs automatically archived on completion with full re-download capability. HistoryService manages both local storage and database persistence.
- **Nov 26**: Added marketplace-specific presets (Default, Amazon, Alibaba, Website) with aspect ratio, max dimensions, margin rules, background padding, and accepted formats. Added custom Google Drive destination URL field with validation for output uploads.
- **Nov 26**: Implemented PSD text layers with real editable text (Montserrat fonts), exact XY positioning based on actual image dimensions, and JSON metadata API endpoints (/api/psd/capabilities, /api/psd/info/:jobId/:imageIndex).
- **Nov 10**: Fixed re-edit workflow to enable true iterative refinement. Re-edits now download the edited image (not original) to build on previous AI work instead of resetting to the source. This enables commands like "remove title from image 12" to preserve all previous branding/overlays while applying the new change.
- **Nov 9**: Integrated Gemini Batch API for 50% cost savings on bulk operations. Brand-aware API key resolution with global fallback. Production-ready batch endpoints for brief analysis, quality checks, and prompt optimization.
- **Nov 9**: Enhanced AI chat with GPT-4o vision capabilities - AI can now see referenced images and generate precise prompts based on visual analysis (e.g., "copy title from image 12" now works perfectly).

## Development Notes
- Frontend runs on port 5000 (Vite dev server)
- Backend API runs on port 3000
- All hosts allowed for development proxy
- Brand tokens required for all API requests (handled automatically by frontend utilities)
