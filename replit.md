# CORSAIR AI Marketing Image Editor

## Overview
A professional full-stack web application for AI-powered marketing image editing with CORSAIR branding. Users upload marketing briefs (PDF or text prompt) and product images, which are processed directly via the Wavespeed Nano Banana API for instant AI-powered image editing. The app features a sleek dark gaming aesthetic with before/after comparison sliders and an AI chat assistant that can trigger real-time image re-editing.

## Project Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── UploadPage.jsx      # File upload interface
│   │   │   ├── ProcessingPage.jsx  # Progress tracking
│   │   │   └── ResultsPage.jsx     # Results gallery
│   │   ├── App.jsx        # Main app component
│   │   └── App.css        # Global styles
│   └── package.json
│
├── server/                # Node.js/Express backend
│   ├── controllers/       # Request handlers
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions (Google Drive)
│   └── index.js          # Server entry point
│
└── attached_assets/      # Project assets and documentation
```

## Tech Stack
- **Frontend**: React.js with Vite
- **Backend**: Node.js with Express
- **File Storage**: Google Drive API
- **Integration**: n8n workflow automation
- **Package Manager**: npm

## Features
1. **File Upload Interface**
   - **Triple input modes**: PDF brief upload, DOCX brief upload, OR text prompt
   - Toggle between PDF/DOCX (max 50MB) and text prompt input
   - **DOCX Support**: Upload DOCX files with embedded images - system extracts both text and images automatically
   - Multiple product image upload (JPG, PNG, max 20MB each) - optional for DOCX
   - Client-side validation and error handling

2. **Parallel Processing Flow**
   - **Real-time parallel batch processing** (5 images at a time using Promise.all)
   - **Live workflow visualization** showing each processing step with code/prompts
   - Real-time progress tracking with detailed per-image status
   - Polls for results every 2 seconds with workflow step updates
   - Automatic completion detection

3. **Results Gallery**
   - Interactive before/after image comparison slider
   - Grid display of edited images
   - Individual image download
   - Bulk download as ZIP file
   - **Workflow step viewer** showing complete processing history
   - Reset functionality for new projects

4. **AI Chat Assistant**
   - Floating chat widget on results page
   - **GPT-4 with function calling** for intelligent image editing
   - **Selective image editing**: Edit individual images or all images
   - Understands natural language: "fix image 3", "edit the first one", "change all images"
   - AI extracts image IDs from numbered list and triggers actual re-edits
   - Context-aware responses based on original prompt/brief
   - Trigger actual image re-editing via `/api/re-edit` endpoint with optional `imageIds` parameter

5. **ML Feedback System**
   - **5-star rating system** for result quality
   - Optional text feedback for detailed user input
   - **AI-powered prompt improvement** using GPT-4
   - **Machine learning feedback loop** that analyzes patterns and auto-improves prompts
   - Feedback aggregation and analysis for continuous quality improvement

## Google Drive Integration
The app uses Google Drive for file storage:
- **PDF Briefs/Prompts**: Uploaded to `1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697` (Instructions2 folder)
- **Product Images**: Uploaded to `1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS` (Product Images folder)
- **Edited Results**: Saved to `17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB` (Corsair folder)
- All uploaded images are made publicly accessible to work with the Nano Banana API

## Wavespeed Nano Banana API Integration
Direct API integration (no n8n dependency):
1. Images are uploaded to Google Drive and made public
2. Public URLs are sent to Wavespeed Nano Banana API with the editing prompt
3. API processes images in sync mode and returns edited results
4. Edited images are downloaded and saved back to Google Drive
5. Results are displayed instantly in the UI with before/after comparison
6. AI chat can trigger re-editing with new prompts via `/api/re-edit` endpoint

## API Endpoints
- `POST /api/upload/pdf` - Upload PDF brief
- `POST /api/upload/text-prompt` - Upload text prompt as alternative to PDF
- `POST /api/upload/images` - Upload product images (auto-triggers Nano Banana processing)
- `GET /api/upload/job/:jobId` - Get job details with workflow steps
- `GET /api/results/poll/:jobId` - Poll for processing status with workflow steps
- `GET /api/results/download/:jobId` - Download all edited images as ZIP
- `GET /api/images/:imageId` - Proxy endpoint for secure image downloads
- `POST /api/chat` - OpenAI chat completions for image editing assistance
- `POST /api/re-edit` - Re-edit images with new prompt (triggered by chat)
- `POST /api/feedback` - Submit user feedback for ML learning
- `GET /api/feedback/stats` - Get feedback statistics and trends

## Environment Setup
- Frontend runs on port 5000
- Backend runs on port 3000
- Google Drive authentication managed by Replit integration

## Recent Changes
- **October 18, 2025**: Selective Image Editing via AI Chat
  - **Enhanced AI chat to support individual image editing**:
    - AI can now edit SPECIFIC images: "fix image 3", "edit the first one"
    - AI can edit MULTIPLE images: "change images 1, 3, and 5"
    - AI can still edit ALL images: "fix all images", "change everything"
    - System provides numbered image list with IDs to AI for context
  - **Backend validation and error handling**:
    - Validates imageIds and reports invalid ones with debugging info
    - Logs "Editing X of Y requested images" for transparency
    - Returns detailed errors with available IDs when no matches found
  - **Fixed critical duplicate images bug**:
    - When editing all images: replaces entire array (prevents duplicates)
    - When editing specific images: preserves unchanged images, replaces only edited ones
    - Proper conditional logic based on imageIds presence
  - **Production-ready selective editing**:
    - Full architect review and approval
    - Prevents regressions with clear branching logic
    - Ready for automated test coverage

- **October 18, 2025**: AI Chat Function Calling + Subtle Image Editing
  - **Upgraded chat assistant to GPT-4 with function calling**:
    - AI can now ACTUALLY trigger image re-edits when user asks to "fix", "change", "edit", etc.
    - Uses OpenAI function calling with `editImages(newPrompt)` tool
    - Automatically calls `/api/re-edit` endpoint with AI-generated prompts
    - Returns clear confirmation when edit is triggered
  - **Added robust error handling**:
    - Validates job exists before attempting re-edit
    - Safe JSON parsing with try-catch for tool call arguments
    - Returns `success: false` with proper status codes on failures
    - Prevents silent failures and vague error messages
  - **Refined AI prompt template for subtle edits**:
    - Changed gradient from 50% coverage to only 20-25% at very top
    - Reduced opacity from heavy dark overlay to 30-40% subtle blend
    - Explicitly instructs to preserve ALL original details, colors, textures
    - Smaller text shadows (1-2px instead of 2-4px)
    - Emphasizes "minimal professional overlay, not heavy editing"
    - Results look like simple professional touch-ups, not heavy manipulation
  
- **October 18, 2025**: DOCX Image Extraction Fix + JSON Parsing Fix
  - **Fixed critical DOCX embedded image extraction**:
    - Corrected mammoth.js API usage with proper `convertImage` option placement
    - Implemented `mammoth.images.imgElement()` with `image.read("base64")` promise handling
    - Images now properly extracted from DOCX and uploaded to Drive automatically
    - Added detailed logging for image extraction debugging
  - **Fixed JSON parsing from OpenAI responses**:
    - Fixed markdown code fence removal (```json blocks)
    - Updated substring extraction to properly skip opening ```
    - Both PDF and DOCX workflows now handle wrapped JSON responses
  
- **October 18, 2025**: PDF Upload Fix + Parallel Processing, Workflow Visualization & ML Feedback System
  - **Fixed critical PDF upload issue**:
    - Converted Buffer to Uint8Array for pdfjs-dist compatibility
    - Added comprehensive error handling for corrupted/empty/encrypted PDFs
    - Enhanced text extraction with better spacing and filtering
    - Added detailed logging at every step for debugging
    - Improved user-friendly error messages
    - PDF workflow now production-ready for deployment
    
- **October 18, 2025**: Parallel Processing, Workflow Visualization & ML Feedback System
  - **Implemented parallel batch processing** (5 images at a time) with real-time progress callbacks
  - **Created comprehensive workflow step tracking** showing:
    - PDF parsing with extracted prompts
    - AI prompt creation with API parameters
    - Parallel batch processing with live status
    - Image saving with code snippets
  - **Built WorkflowViewer component** with expandable step details showing code and prompts
  - **Implemented ML feedback system**:
    - User rating (1-5 stars) and text feedback
    - GPT-4 powered prompt analysis and improvement
    - Automatic learning from feedback patterns
    - Feedback aggregation for quality trends
  - **Added FeedbackWidget component** with gamified UI
  - Enhanced job store with `workflowSteps[]` and feedback storage
  - Updated polling to include workflow steps in real-time
  - Created `/api/feedback` endpoints for submission and stats
  - All features integrated and working together

- **October 16, 2025**: Complete Nano Banana API Integration
  - Replaced n8n workflow with direct Wavespeed API integration
  - Created `nanoBanana.js` service with sync mode processing
  - Updated upload flow to make images public and auto-trigger processing
  - Implemented automatic image editing after upload completion
  - Added `/api/re-edit` endpoint for chat-triggered re-editing
  - Fixed image matching logic using stored metadata
  - Updated results polling to use job status instead of Drive folder monitoring
  - Enhanced chat widget to trigger actual image re-editing
  - Applied full CORSAIR branding across all components
  - Increased body size limits to 50MB for large file handling
  - All workflows running successfully (Frontend: port 5000, Backend: port 3000)

## Architecture Highlights

### Direct API Processing
- **No n8n dependency**: All image processing happens via direct Wavespeed API calls
- **Automatic flow**: Upload images → Make public → Call Nano Banana API → Save results
- **Background processing**: Async processing with real-time status updates
- **Job-based architecture**: Each job stores original and edited image metadata

### Image Matching & Metadata
- Original and edited images are paired using stored Drive IDs
- Each job maintains:
  - `images[]` - Original uploaded images with public URLs
  - `editedImages[]` - Processed results with before/after pairing
  - `promptText` - The editing instructions used
- Re-editing preserves original image references for comparison sliders

### Concurrent User Support
- Job-based architecture supports multiple simultaneous users
- Each job has unique ID and isolated file storage
- No shared state between jobs
- All processing tracked via in-memory job store

### Parallel Processing Strategy
- **Batch processing**: Images processed in parallel batches of 5
- **Promise.all**: Each batch uses Promise.all for concurrent API calls
- **Progress callbacks**: Real-time updates for each image completion
- **Workflow tracking**: Detailed step-by-step logging with timestamps
- **Performance**: 5x faster than sequential processing for large batches

### ML Feedback Loop
- **User feedback collection**: 5-star ratings + text comments
- **Pattern analysis**: GPT-4 analyzes low vs high-rated results
- **Prompt evolution**: Automatically suggests improved prompts
- **Continuous learning**: System improves over time with more feedback
- **Feedback storage**: In-memory feedback store with job correlation

## Development
```bash
# Frontend
cd client && npm run dev

# Backend
cd server && npm start
```

## Deployment
The application is configured for deployment with:
- Frontend served on port 5000 (webview)
- Backend API on port 3000 (console)
- Automatic Google Drive authentication via Replit
- Static file serving for image proxy
