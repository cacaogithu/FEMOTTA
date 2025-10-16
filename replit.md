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
   - **Dual input modes**: PDF brief upload OR text prompt
   - Toggle between PDF (max 50MB) and text prompt input
   - Multiple product image upload (JPG, PNG, max 20MB each)
   - Client-side validation and error handling

2. **Processing Flow**
   - Real-time progress tracking with 5-step indicator
   - Polls Google Drive for results every 5 seconds
   - Automatic completion detection

3. **Results Gallery**
   - Interactive before/after image comparison slider
   - Grid display of edited images
   - Individual image download
   - Bulk download as ZIP file
   - Reset functionality for new projects

4. **AI Chat Assistant**
   - Floating chat widget on results page
   - OpenAI-powered image editing assistance
   - Context-aware responses based on original prompt/brief
   - Help users refine and iterate on edits

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
- `GET /api/upload/job/:jobId` - Get job details
- `GET /api/results/poll/:jobId` - Poll for processing status
- `GET /api/results/download/:jobId` - Download all edited images as ZIP
- `GET /api/images/:imageId` - Proxy endpoint for secure image downloads
- `POST /api/chat` - OpenAI chat completions for image editing assistance
- `POST /api/re-edit` - Re-edit images with new prompt (triggered by chat)

## Environment Setup
- Frontend runs on port 5000
- Backend runs on port 3000
- Google Drive authentication managed by Replit integration

## Recent Changes
- **October 16, 2025**: Complete Nano Banana API Integration
  - **Replaced n8n workflow with direct Wavespeed API integration**
  - Created `nanoBanana.js` service with sync mode processing
  - Updated upload flow to make images public and auto-trigger processing
  - Implemented automatic image editing after upload completion
  - Added `/api/re-edit` endpoint for chat-triggered re-editing
  - Fixed image matching logic using stored metadata
  - Updated results polling to use job status instead of Drive folder monitoring
  - Enhanced chat widget to trigger actual image re-editing, not just guidance
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
