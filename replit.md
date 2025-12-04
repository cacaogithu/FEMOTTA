# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. This platform allows users to upload marketing briefs (PDF, DOCX, or text prompt) and product images for instant AI-powered editing. Key capabilities include brand-specific theming, interactive before/after image comparisons, an AI chat assistant for selective re-editing, and the ability to download layered PSD files with editable text. The system enhances efficiency and reduces the time required for marketing image production, with a vision to become the leading AI-powered image editing solution for marketing teams globally. The platform is currently focused on perfecting the image editing experience for CORSAIR before expanding to multi-tenant architecture.

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

### UI/UX Decisions
The platform features a sleek, dark gaming aesthetic with brand-specific theming. It includes interactive elements like before/after comparison sliders and a floating AI chat assistant. Workflow visualization is provided through live display of processing steps and a results gallery. A `TimeMetricsPanel` shows "Time Saved" and "Efficiency Gain," and the interface includes Editor and History tabs for workflow switching.

### Technical Implementations
- **Multi-Tenant CRM-Style Platform**: Supports brand isolation with dedicated Google Drive folders, branding assets, and AI configurations per brand/subaccount. It includes a CRM for user and prompt management, and an admin dashboard for overall system control, secured by `verifyAdminToken` middleware.
- **Authentication**: A dual authentication system supports Replit Auth (SSO) via OpenID Connect and local registration. Brand-specific logins use JWT tokens for data isolation via `brandContextMiddleware`.
- **Processing Pipeline**: A multi-stage pipeline (Uploading, Extracting, Rendering, Exporting) offers visual feedback and parallel batch processing.
- **History & Archival System**: Jobs are automatically archived to local storage and PostgreSQL, with a UI for viewing and re-downloading results.
- **Marketplace-Specific Presets**: Pre-configured output settings with AI behavior modifications for platforms like Amazon and Alibaba, adjusting aspects like aspect ratio, dimensions, margins, and color vibrance.
- **Custom Google Drive Destinations**: Users can specify custom Google Drive folder URLs for output uploads.
- **PSD Export with Editable Text Layers**: Server-side generation of layered PSD files using `ag-psd`, featuring editable text layers (Saira-Bold for titles, Saira-Regular for subtitles) and signed URLs for secure downloads.
- **Smart Logo Detection & Overlay**: Automatically detects logo requests in briefs using AI and overlays them programmatically with Sharp, applying proportional sizing and proper margins. An intelligent partner logo matching system (`server/services/partnerLogos.js`) matches extracted logo names to a predefined registry.
- **Triple Input Modes**: Supports brief submission via PDF, DOCX (with intelligent image filtering), or structured text prompts. An AI-Powered Logo Placement Analyzer uses GPT-4o to determine logo requirements from DOCX briefs.
- **AI Chat with Vision**: A chat assistant with vision capabilities enables precise re-editing based on visual analysis and natural language commands.
- **Google Gemini Image API**: Utilizes the `@google/genai` SDK and `gemini-3-pro-image-preview` (Nano Banana Pro) for image editing, preserving original product images and generating up to 4K resolution images.
- **Job-based Architecture**: Isolates each job with a unique ID and dedicated storage.
- **Iterative Re-editing**: Re-edits build on previous AI work, allowing for sequential refinements while preserving and re-applying logos and parameters.
- **Typography System**: All text overlays use the Saira font family (Saira Bold for titles, Saira Regular for subtitles) based on canonical guidelines from `sairaReference.js`.
- **AI Prompt System**: A strict prompt structure, managed by `promptTemplates.js`, ensures precise text rendering. It includes a `RENDER_TEXT` section for literal text, a `GUIDANCE` section for styling instructions (marked as non-renderable), and a `FORBIDDEN` section to prevent technical terms from appearing. Instructions explicitly forbid modifying the original image, focusing only on text overlays and subtle gradients. Logo overlays are handled by post-processing, not AI prompts.

## External Dependencies
- **PostgreSQL Database (Neon)**: For multi-tenant data storage.
- **Google Drive API**: For file storage of briefs, product images, and results.
- **Google Gemini Image API**: Primary AI-powered image editing provider, using `@google/genai` SDK and Nano Banana Pro (`gemini-3-pro-image-preview`).
- **OpenAI API (GPT-4o)**: Powers the AI Chat Assistant, vision capabilities, and AI-Powered Logo Placement Analyzer.
- **ag-psd**: Used for server-side PSD generation with editable text layers.
- **Mammoth.js**: Extracts text and images from DOCX files.
- **pdfjs-dist**: Processes PDF files.
- **Drizzle ORM**: For PostgreSQL schema management and queries.
- **bcrypt**: For password hashing.
- **archiver**: Generates ZIP files for batch downloads.