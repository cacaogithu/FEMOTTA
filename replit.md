# CORSAIR AI Marketing Image Editor

## Overview
A professional full-stack web application for AI-powered marketing image editing with CORSAIR branding. Users upload marketing briefs (PDF, DOCX, or text prompt) and product images. The system processes these inputs via the Wavespeed Nano Banana API for instant AI-powered image editing. Key features include a dark gaming aesthetic, before/after comparison sliders, and an AI chat assistant capable of triggering real-time image re-editing. The project aims to provide a tool that significantly saves time in marketing image creation, offering a clear ROI through efficiency gains for executive presentations.

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
The application is built with a React.js frontend (Vite) and a Node.js/Express backend. It leverages Google Drive for file storage and directly integrates with the Wavespeed Nano Banana API for image processing, eliminating the need for n8n.

### UI/UX Decisions
- **Dark Gaming Aesthetic**: A sleek, dark theme with CORSAIR branding.
- **Interactive Before/After Comparison**: Sliders for edited images.
- **Workflow Visualization**: Live display of processing steps, including code and prompts.
- **Results Gallery**: Grid display of edited images with individual and bulk download options.
- **AI Chat Assistant**: Floating widget on the results page for interactive editing commands.
- **Metrics Dashboard**: A CEO-ready `TimeMetricsPanel` with a gold gradient matching CORSAIR branding, displaying "Time Saved," "Efficiency Gain," "Processing Time," and "Manual Estimate."

### Technical Implementations
- **Triple Input Modes**: Supports PDF, DOCX, or text prompts for briefs. DOCX includes automatic extraction of text and images, with intelligent filtering to skip logos.
- **Parallel Processing**: Images are processed in parallel batches of 5 using `Promise.all` for efficiency, with real-time progress updates.
- **AI Chat with Function Calling**: Utilizes GPT-4 with function calling to enable the AI to trigger image re-edits based on natural language queries, allowing for selective editing of individual or multiple images.
- **ML Feedback System**: A 5-star rating and text feedback mechanism, powered by GPT-4 for prompt analysis and improvement, creating a continuous learning loop.
- **Job-based Architecture**: Supports concurrent users by isolating each job with a unique ID and dedicated storage, ensuring no shared state.
- **Image Matching & Metadata**: Original and edited images are paired using stored Google Drive IDs, with each job maintaining metadata for original images, edited results, and prompt text.
- **Direct API Processing**: All image processing is handled via direct Wavespeed Nano Banana API calls, with public URLs generated for Google Drive-hosted images.

### Feature Specifications
- **File Upload Interface**: Client-side validation, multi-image upload, and support for large files (up to 50MB for briefs, 20MB for images).
- **Results Gallery**: Individual image download, bulk ZIP download, and a workflow step viewer.
- **AI Chat Capabilities**: Context-aware responses, selective image editing, and automatic re-editing via the `/api/re-edit` endpoint.
- **ML Feedback System**: User rating, optional text feedback, AI-powered prompt improvement, and feedback aggregation.
- **Time Tracking**: Comprehensive backend time tracking for `startTime`, `endTime`, `processingTimeSeconds`, `processingTimeMinutes`, `estimatedManualTimeMinutes`, `timeSavedMinutes`, and `timeSavedPercent`.

## External Dependencies
- **Google Drive API**: Used for storing PDF briefs, product images, and edited results. All uploaded images are made publicly accessible for the Nano Banana API.
  - PDF Briefs/Prompts: `1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697` (Instructions2 folder)
  - Product Images: `1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS` (Product Images folder)
  - Edited Results: `17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB` (Corsair folder)
- **Wavespeed Nano Banana API**: Direct integration for AI-powered image editing.
- **OpenAI API (GPT-4)**: Powers the AI Chat Assistant for intelligent image editing, function calling, and the ML feedback system for prompt analysis and improvement.
- **Mammoth.js**: Used for extracting text and embedded images from DOCX files.
- **pdfjs-dist**: Used for processing PDF files and extracting text.