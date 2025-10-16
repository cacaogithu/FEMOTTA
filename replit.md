# CORSAIR AI Marketing Image Editor

## Overview
A professional full-stack web application for AI-powered marketing image editing with CORSAIR branding. This app allows users to upload marketing briefs (PDF or text prompt) and product images, which can be processed either through an existing n8n automation workflow or directly via the Wavespeed Nano Banana API.

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
The app uploads files to specific Google Drive folders:
- **PDF Briefs**: `1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697` (Instructions2 folder)
- **Product Images**: `1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS` (Product Images folder)
- **Results**: Polls `17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB` (Corsair folder) for "New Images" subfolder

## n8n Workflow Integration
The n8n workflow:
1. Monitors the Instructions2 folder for new PDFs
2. Monitors the Product Images folder for new images
3. Processes images using AI (Wavespeed Nano Banana API)
4. Creates a "New Images" folder with edited results
5. Sends email notification when complete

## API Endpoints
- `POST /api/upload/pdf` - Upload PDF brief
- `POST /api/upload/text-prompt` - Upload text prompt as alternative to PDF
- `POST /api/upload/images` - Upload product images
- `GET /api/upload/job/:jobId` - Get job details
- `GET /api/results/poll/:jobId` - Poll for processing status
- `GET /api/results/download/:folderId` - Download all images as ZIP
- `GET /api/images/:imageId` - Proxy endpoint for secure image downloads
- `POST /api/chat` - OpenAI chat completions for image editing assistance

## Environment Setup
- Frontend runs on port 5000
- Backend runs on port 3000
- Google Drive authentication managed by Replit integration

## Recent Changes
- **October 16, 2025**: Initial project setup and feature enhancements
  - Created full-stack application structure with React + Express
  - Integrated Google Drive API for file operations
  - Built responsive UI with three-page flow (Upload → Processing → Results)
  - Added before/after image comparison slider
  - Implemented backend image proxy for secure downloads
  - Configured shared job store for cross-controller state management
  - **Added dual input mode**: Toggle between PDF brief and text prompt
  - **Integrated OpenAI chat widget** for real-time image editing assistance
  - Increased file size limits: PDF (50MB), Images (20MB each)
  - **Applied CORSAIR branding**: Dark theme (#0A0A0A background), yellow accents (#FFC107), premium gaming aesthetic
  - **Created Nano Banana API service**: Direct integration with Wavespeed API for bypassing n8n workflow
  - Updated chat system prompts to reference CORSAIR brand guidelines
  - Set up workflows for development (Frontend: port 5000, Backend: port 3000)

## Current Limitations & Production Considerations

### Sequential Processing Design
This application is designed to work with your existing n8n workflow which:
- Monitors shared folders (Instructions2, Product Images)
- Creates a single "New Images" folder for results
- Processes files sequentially

**For Sequential Use (Current Setup):**
- Works perfectly for one user/job at a time
- Simple workflow integration
- No modifications needed to n8n

**For Concurrent Users (Production Enhancement):**
To support multiple simultaneous users, you would need to modify the n8n workflow to:
1. Create job-specific result folders (e.g., "New Images_{jobId}")
2. Include job metadata in folder names or file metadata
3. Filter results by job ID in the polling logic

### Image Matching
- Original and edited images are matched by filename similarity
- Works reliably when n8n workflow maintains consistent naming (e.g., `image.jpg` → `image_edited.jpg`)
- For guaranteed matching, consider storing Drive file IDs during n8n processing

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
