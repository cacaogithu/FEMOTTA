# AI Marketing Image Editor

## Overview
A professional full-stack web application for AI-powered marketing image editing. This app allows users to upload marketing briefs (PDF) and product images, which are then automatically processed by an existing n8n automation workflow.

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
   - Drag-and-drop PDF brief upload (max 50MB)
   - Multiple product image upload (JPG, PNG, max 20MB each)
   - Client-side validation and error handling

2. **Processing Flow**
   - Real-time progress tracking with 5-step indicator
   - Polls Google Drive for results every 5 seconds
   - Automatic completion detection

3. **Results Gallery**
   - Grid display of edited images
   - Individual image download
   - Bulk download as ZIP file
   - Reset functionality for new projects

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
- `POST /api/upload/images` - Upload product images
- `GET /api/upload/job/:jobId` - Get job details
- `GET /api/results/poll/:jobId` - Poll for processing status
- `GET /api/results/download/:folderId` - Download all images as ZIP

## Environment Setup
- Frontend runs on port 5000
- Backend runs on port 3000
- Google Drive authentication managed by Replit integration

## Recent Changes
- **October 16, 2025**: Initial project setup
  - Created full-stack application structure with React + Express
  - Integrated Google Drive API for file operations
  - Built responsive UI with three-page flow (Upload → Processing → Results)
  - Added before/after image comparison slider
  - Implemented backend image proxy for secure downloads
  - Configured shared job store for cross-controller state management
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
