# Multi-Brand AI Marketing Image Editor

## Overview
A professional, multi-tenant SaaS platform for AI-powered marketing image editing. Originally built for CORSAIR, the system now supports multiple brands with isolated configurations, branding, and storage. Users upload marketing briefs (PDF, DOCX, or text prompt) and product images. The system processes these inputs via the Wavespeed Nano Banana API for instant AI-powered image editing. Key features include brand-specific theming, before/after comparison sliders, AI chat assistant for selective re-editing, and PSD download capability. The platform offers clear ROI through efficiency gains and time savings in marketing image production.

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
The application is built as a multi-tenant SaaS platform with a React.js frontend (Vite), Node.js/Express backend, and PostgreSQL database (Neon). It leverages Google Drive for file storage and directly integrates with the Wavespeed Nano Banana API for image processing.

### Multi-Tenant Architecture
- **Brand Isolation**: Each brand (Corsair, future clients) has isolated Google Drive folders, branding assets, and AI configurations
- **Database Schema**: PostgreSQL with tables for brands, users, jobs, and images
- **Brand Context**: Middleware system that loads brand configuration per request
- **Dynamic Theming**: Frontend loads brand-specific logos, colors, and prompts from database

### UI/UX Decisions
- **Dark Gaming Aesthetic**: A sleek, dark theme with CORSAIR branding.
- **Interactive Before/After Comparison**: Sliders for edited images.
- **Workflow Visualization**: Live display of processing steps, including code and prompts.
- **Results Gallery**: Grid display of edited images with individual and bulk download options.
- **AI Chat Assistant**: Floating widget on the results page for interactive editing commands.
- **Metrics Dashboard**: A CEO-ready `TimeMetricsPanel` with a gold gradient matching CORSAIR branding, displaying "Time Saved," "Efficiency Gain," "Processing Time," and "Manual Estimate."

### Technical Implementations
- **Triple Input Modes**: Supports PDF, DOCX, or text prompts for briefs. DOCX includes automatic extraction of text and images, with intelligent filtering to skip logos.
- **Parallel Processing**: Images are processed in parallel batches of 15 using `Promise.all` for efficiency, with real-time progress updates.
- **AI Chat with Function Calling**: Utilizes GPT-4 with function calling to enable the AI to trigger image re-edits based on natural language queries, allowing for selective editing of individual or multiple images.
- **ML Feedback System**: A 5-star rating and text feedback mechanism, powered by GPT-4 for prompt analysis and improvement, creating a continuous learning loop.
- **Job-based Architecture**: Supports concurrent users by isolating each job with a unique ID and dedicated storage, ensuring no shared state.
- **Image Matching & Metadata**: Original and edited images are paired using stored Google Drive IDs, with each job maintaining metadata for original images, edited results, and prompt text.
- **Direct API Processing**: All image processing is handled via direct Wavespeed Nano Banana API calls, with public URLs generated for Google Drive-hosted images.

### Feature Specifications
- **File Upload Interface**: Client-side validation, multi-image upload, and support for large files (up to 50MB for briefs, 20MB for images).
- **Results Gallery**: Individual image download, bulk ZIP download, PSD download with layered files, and a workflow step viewer.
- **PSD Download**: Each image can be downloaded as a layered PSD file with two layers (Original Image + AI Edited), enabling further editing in Photoshop or other design tools. Uses ag-psd and node-canvas for PSD generation.
- **AI Chat Capabilities**: Context-aware responses, selective image editing, and automatic re-editing via the `/api/re-edit` endpoint.
- **ML Feedback System**: User rating, optional text feedback, AI-powered prompt improvement, and feedback aggregation.
- **Time Tracking**: Comprehensive backend time tracking for `startTime`, `endTime`, `processingTimeSeconds`, `processingTimeMinutes`, `estimatedManualTimeMinutes`, `timeSavedMinutes`, and `timeSavedPercent`.

## External Dependencies
- **PostgreSQL Database (Neon)**: Stores brands, users, jobs, and images with full multi-tenant isolation
- **Google Drive API**: Used for storing PDF briefs, product images, and edited results. Each brand has isolated folder configuration.
  - Corsair Brief Folder: `1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697`
  - Corsair Product Images: `1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS`
  - Corsair Edited Results: `17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB`
- **Wavespeed Nano Banana API**: Direct integration for AI-powered image editing.
- **OpenAI API (GPT-4)**: Powers the AI Chat Assistant for intelligent image editing, function calling, and the ML feedback system for prompt analysis and improvement.
- **Mammoth.js**: Used for extracting text and embedded images from DOCX files.
- **pdfjs-dist**: Used for processing PDF files and extracting text.
- **ag-psd**: Used for creating layered PSD files with original and edited image layers.
- **node-canvas**: Provides canvas implementation for PSD generation with proper image rendering.
- **Drizzle ORM**: Database ORM for PostgreSQL schema management and queries.

## Multi-Brand Features
- **Brand Management API**: `/api/brand/list` and `/api/brand/config` endpoints for brand discovery
- **Brand Selector UI**: Dropdown component for switching between brands (shows only when multiple brands exist)
- **Dynamic Theming**: CSS custom properties updated per brand (`--brand-primary`, `--brand-secondary`)
- **Isolated Storage**: Each brand has dedicated Google Drive folders for briefs, images, and results
- **Custom Prompts**: Brands can define default prompt templates for AI image editing
- **Admin Capabilities**: Brand creation and management endpoints (authentication to be added)

## Deployment Configuration
For each new brand, configure:
1. Brand record in database (name, display name, slug, colors, logo)
2. Google Drive folder IDs (brief, product images, edited results)
3. API keys (Wavespeed, OpenAI) - can be brand-specific or shared
4. Default prompt template and AI settings (batch size, manual time estimate)

## Recent Changes
- **October 25, 2025**: Multi-Brand Platform Architecture
  - **Database Migration**: Added PostgreSQL with Drizzle ORM for multi-tenant data management
  - **Brand System**: Created brands, users, jobs, and images tables with full isolation
  - **Brand API**: `/api/brand/list` and `/api/brand/config` endpoints for brand discovery and configuration
  - **Frontend Integration**: Brand selector component with dynamic theming support
  - **Corsair Seeded**: CORSAIR configured as first tenant (brand ID: 1)
  - **Backwards Compatible**: Defaults to 'corsair' brand for existing functionality
- **October 21, 2025**: PSD Download Feature & Desktop Layout Improvements
  - **PSD Download Capability**:
    - Added `/api/psd/:jobId/:imageIndex` endpoint for generating layered PSD files
    - Each image downloadable as PSD with 2 layers: "Original Image" (bottom) and "AI Edited" (top)
    - Uses ag-psd + node-canvas for production-ready Photoshop-compatible file generation
    - Enables further editing and refinement in Photoshop or other design tools
    - Download PSD button added to each image card in results gallery
  - **Desktop-First Layout Optimization**:
    - Fixed horizontal centering issues for true viewport symmetry
    - Adjusted container max-width to 90% for better screen utilization
    - Removed conflicting padding from App wrapper
    - Professional desktop layout fills screen properly without wasted space
- **October 23, 2025**: Performance & PSD Generation Improvements
  - **Increased parallel processing to 15 images** - Tripled batch size from 5 to 15 for significantly faster processing
  - **Fixed PSD generation** - Added critical `'ag-psd/initialize-canvas.js'` import for proper node-canvas compatibility, resolving black PSD layer issue
- **October 18, 2025**: Premium UI Polish & Performance Improvements
  - **Added CORSAIR logo branding**:
    - Animated SVG logo at top of upload page with gold gradient
    - Pulsing glow effect for premium feel
    - Clear brand identity from first interaction
  - **Enhanced loading animations**:
    - Dual-ring spinner with counter-rotating layers
    - Shimmer effect on processing title
    - Pulsing active step indicators
    - Glowing shadows on all animated elements
  - **Removed clutter for cleaner UX**:
    - Removed ML stats panel from results page
    - Removed emojis from feedback widget for professional appearance
    - Removed lightning emoji from "Your Images Are Ready" title
    - Streamlined interface focuses on core functionality
  - **Professional polish**:
    - Cleaner, more business-appropriate aesthetic
    - Consistent branding throughout
    - Enhanced visual feedback during processing
    - Executive-ready presentation quality
