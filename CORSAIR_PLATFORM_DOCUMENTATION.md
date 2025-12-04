
# CORSAIR AI IMAGE EDITOR - COMPLETE PLATFORM DOCUMENTATION

## OVERVIEW
This is an AI-powered image editing platform built specifically for CORSAIR's marketing team. It automates the process of adding text overlays and enhancements to product images using AI, replacing manual Photoshop work.

---

## HOW THE PLATFORM WORKS (USER PERSPECTIVE)

### 1. LOGIN & AUTHENTICATION
- User visits the platform and logs in with email/password
- The system uses JWT (JSON Web Tokens) for secure authentication
- Corsair users are linked to the "corsair" brand in the database
- After login, a token is stored in the browser that proves who you are

### 2. UPLOADING A BRIEF
Users can upload either:
- **PDF Brief**: Contains instructions for what text to add to images
- **DOCX Brief**: Same as PDF, but in Word format

**What happens when you upload:**
1. File is sent to the server
2. Server uploads it to Google Drive (in the "Instructions2" folder)
3. AI (Google Gemini) reads the document and extracts:
   - Image titles (headlines)
   - Image subtitles (copy text)
   - Which product images to use
   - Custom AI prompts for each image

### 3. PROCESSING IMAGES
Once the brief is analyzed:

**Step 1: Find Product Images**
- System looks in Google Drive's "Product Images" folder
- Matches the asset names from the brief to actual image files

**Step 2: AI Image Editing**
For each image:
- Original image URL is generated from Google Drive
- Image + AI prompt sent to Wavespeed AI's "Nano Banana" model
- Nano Banana adds:
  - Dark gradient overlay at top
  - Title text (large, bold, white)
  - Subtitle text (smaller, regular, white)
  - Text shadows for readability
- Wavespeed processes the image (takes ~15 seconds)

**Step 3: Save Results**
- Edited images are downloaded from Wavespeed
- Uploaded back to Google Drive in "New Images" folder
- All results tracked in database

### 4. VIEWING RESULTS
Users see a results page showing:
- Original image vs. AI-edited image (side-by-side comparison slider)
- Image metadata (title, subtitle, asset name)
- Download options (individual or bulk ZIP)
- PSD download (layered Photoshop file)
- Re-edit option (if not happy with result)

### 5. RE-EDITING IMAGES
If user doesn't like an edit:
- Click "Re-edit" button
- Write custom prompt describing what to change
- System sends to Wavespeed again with new prompt
- New version saved, old version kept for comparison

---

## BACKEND ARCHITECTURE

### DATABASE STRUCTURE (PostgreSQL via Drizzle ORM)

**Tables:**

1. **brands** - Stores brand configurations
   - id, name, slug (e.g., "corsair")
   - logoUrl, primaryColor, secondaryColor
   - Google Drive folder IDs (briefFolderId, productImagesFolderId, editedResultsFolderId)
   - API keys (wavespeedApiKey, openaiApiKey)
   - defaultPromptTemplate
   - aiSettings (batchSize, etc.)

2. **users** - Platform users
   - id, email, username, passwordHash
   - brandId (links to brands table)
   - role (user/admin)
   - active status

3. **jobs** - Processing jobs
   - id, jobId (unique identifier)
   - brandId
   - briefFileId (Google Drive file ID)
   - status (pending/processing/completed/failed)
   - totalImages, processedImages
   - timestamps

4. **images** - Individual image edits
   - id, jobId
   - originalImageUrl, editedImageUrl
   - driveFileId (Google Drive ID of edited image)
   - title, subtitle, asset
   - aiPrompt
   - status, errorMessage
   - processingTimeMs

5. **feedback** - User feedback on edits
   - id, imageId
   - rating (1-5)
   - comment
   - useful (boolean)

### KEY BACKEND FILES

**server/index.js** - Main Express server
- Sets up routes
- Connects to database
- Handles middleware (authentication, brand context)
- Centralized error handling and logging

**server/utils/logger.js** - Centralized Logging
- Structured JSON logging for production
- Log levels (info, error, warn, debug)
- Replaces console.log for better observability

**server/utils/jobStore.js** - Job State Management
- Fully database-backed (PostgreSQL)
- Async operations for reliability
- Removes in-memory state risks
- Manages job lifecycle and status updates

**server/routes/upload.js** - Brief upload handling
- `/api/upload/pdf` - Accepts PDF/DOCX briefs
- Uploads to Google Drive
- Extracts text using pdf-parse or mammoth (for DOCX)
- Sends to OpenAI GPT-4 to parse image specifications
- Returns structured JSON array of image specs

**server/routes/process.js** - Main image processing
- `/api/process/start` - Starts processing job
- Creates job in database
- For each image:
  - Fetches from Google Drive
  - Sends to Wavespeed Nano Banana API
  - Polls for completion
  - Downloads edited image
  - Uploads to Google Drive
  - Updates database
- Sends progress updates via Server-Sent Events (SSE)

**server/routes/results.js** - Results retrieval
- `/api/results/:jobId` - Gets all images for a job
- Returns URLs, metadata, processing stats

**server/routes/psd.js** - PSD file generation
- Uses `ag-psd` library
- Creates layered PSD with:
  - Layer 1: Original image
  - Layer 2: AI-edited image
- Returns downloadable PSD file

**server/routes/reEdit.js** - Re-editing existing images
- `/api/re-edit/:imageId` - Re-edits a specific image
- Takes custom prompt
- Sends to Wavespeed again
- Saves as new version

**server/services/brandService.js** - Brand management
- CRUD operations for brands
- Gets brand by slug or ID
- Manages brand-specific settings

**server/middleware/brandContext.js** - Brand isolation
- Loads brand from JWT token or header
- Enforces data isolation (users can only see their brand's data)
- Security: prevents cross-brand data access

**server/utils/googleDrive.js** - Google Drive integration
- Authenticates with Google Drive API
- Uploads files
- Lists folder contents
- Downloads files
- Uses service account credentials

### EXTERNAL API INTEGRATIONS

**Wavespeed AI - Nano Banana Model**
- Endpoint: `https://api.wavespeed.ai/api/v3/google/nano-banana/edit`
- Authentication: Bearer token
- Request format:
```json
{
  "enable_base64_output": false,
  "enable_sync_mode": true,
  "images": ["https://drive.google.com/..."],
  "output_format": "jpeg",
  "prompt": "Add dark gradient overlay..."
}
```
- Returns:
  - Job ID
  - Status URL
  - Output image URLs when complete

**OpenAI GPT-4** - Brief parsing
- Used to extract image specifications from PDF/DOCX text
- Prompt tells it to extract: title, subtitle, asset name, variant
- Returns structured JSON array

**Google Drive API**
- OAuth2 service account authentication
- Used for:
  - Uploading brief files
  - Reading product images
  - Saving edited images
  - Organizing in folders per brand

---

## FRONTEND ARCHITECTURE

### KEY FRONTEND FILES

**client/src/App.jsx** - Main React app
- Sets up routing (React Router)
- Routes:
  - `/login` - User login
  - `/` - Main app (protected route)
  - `/admin` - Admin dashboard
  - `/brand/:slug/login` - Brand-specific login

**client/src/pages/UserLogin.jsx** - Login page
- Form with email/password
- Calls `/api/users/login`
- Stores JWT token in localStorage
- Redirects to main app on success

**client/src/components/UploadPage.jsx** - Brief upload
- Drag & drop or click to upload
- Shows upload progress
- Triggers brief analysis
- Displays extracted image specs

**client/src/components/ProcessingPage.jsx** - Processing view
- Shows workflow steps:
  1. Uploading brief
  2. Analyzing brief
  3. Finding product images
  4. AI editing images
  5. Saving results
- Progress bar
- Live status updates via SSE

**client/src/components/ResultsPage.jsx** - Results display
- Grid of before/after images
- Before/After slider component
- Download buttons
- Re-edit buttons
- Metrics dashboard (time saved, efficiency)

**client/src/components/BeforeAfterSlider.jsx** - Image comparison
- Interactive slider to compare original vs edited
- Draggable divider
- Smooth animations

**client/src/components/ChatWidget.jsx** - AI assistant
- Floating chat bubble
- Talks to OpenAI for help with platform
- Provides guidance on features

**client/src/services/brandService.js** - Brand configuration
- Loads brand settings from `/api/brand/config`
- Applies brand theming (colors, logo)
- Manages brand switching (if multiple brands)

**client/src/utils/api.js** - API utilities
- `authenticatedFetch()` - Automatically adds JWT token to requests
- `getJSON()` - Fetches and parses JSON
- Handles token expiration
- Converts responses to blob URLs for secure image display

---

## DATA FLOW EXAMPLE (COMPLETE WORKFLOW)

### Scenario: User uploads a brief for 5 product images

1. **Upload Brief (User → Frontend → Backend)**
   - User drags DOCX file to upload area
   - Frontend: POST `/api/upload/pdf` with file
   - Backend: Receives file, saves to temp storage

2. **Upload to Google Drive (Backend → Google Drive)**
   - Backend uploads DOCX to "Instructions2" folder
   - Gets back Drive file ID: `1XhCDZaxwS7...`

3. **Extract Text (Backend)**
   - Uses `mammoth` library to extract text from DOCX
   - Text: "IMAGE 1: CORSAIR ONE i600, Headline: POWER UNLEASHED..."

4. **Parse with AI (Backend → OpenAI)**
   - Sends extracted text to GPT-4
   - Prompt: "Extract image specifications as JSON..."
   - OpenAI returns:
```json
[
  {
    "image_number": 1,
    "title": "POWER UNLEASHED",
    "subtitle": "Next-gen performance...",
    "asset": "corsair_one_i600_metal_dark_12",
    "ai_prompt": "Add dark gradient overlay..."
  },
  // ... 4 more images
]
```

5. **Create Job (Backend → Database)**
   - INSERT into `jobs` table
   - jobId: `job_abc123`
   - status: `pending`
   - totalImages: 5

6. **Find Product Images (Backend → Google Drive)**
   - List files in "Product Images" folder
   - Match asset names: `corsair_one_i600_metal_dark_12.jpg`
   - Generate direct download URLs

7. **Process Each Image (Loop)**
   For image 1:
   
   a. **Send to Wavespeed**
      - POST to Nano Banana API
      - Body: `{images: ["https://drive.google.com/..."], prompt: "Add dark gradient..."}`
      - Response: `{id: "ws_xyz", urls: {get: "https://api.wavespeed.ai/..."}}`
   
   b. **Wait for Processing**
      - Poll Wavespeed status URL every 5 seconds
      - Status: `pending` → `processing` → `completed`
      - Takes ~15 seconds
   
   c. **Download Edited Image**
      - GET edited image URL
      - Download to server memory
   
   d. **Upload to Google Drive**
      - Upload to "New Images" folder
      - Filename: `corsair_one_i600_metal_dark_12_edited.jpg`
      - Get Drive file ID: `1ABC...`
   
   e. **Update Database**
      - INSERT into `images` table
      - Store URLs, metadata, processing time
      - UPDATE job: `processedImages = 1`
   
   f. **Send Progress to Frontend (SSE)**
      - Event: `{type: 'progress', completed: 1, total: 5}`

8. **Repeat for Images 2-5**
   - Same process for each image
   - Processed in batches of 15 (configurable)

9. **Complete Job**
   - UPDATE job: `status = 'completed'`
   - Send final event to frontend: `{type: 'complete', jobId: 'job_abc123'}`

10. **Display Results (Frontend)**
    - GET `/api/results/job_abc123`
    - Receives array of all 5 images
    - Fetches images using authenticated requests
    - Converts to blob URLs for display
    - Shows in results gallery

---

## SECURITY & AUTHENTICATION

### User Authentication Flow
1. User enters email/password
2. Server hashes password with bcrypt, compares to database
3. If valid, generates JWT token:
```javascript
{
  userId: 123,
  email: "user@corsair.com",
  brandId: 1,
  role: "user",
  exp: 1234567890 // expires in 24 hours
}
```
4. Token stored in localStorage
5. Every API request includes: `Authorization: Bearer <token>`

### Brand Isolation
- `brandContextMiddleware` runs on every API request
- Extracts brand from JWT token
- Enforces: users can ONLY access data for their brand
- Prevents cross-contamination between brands

### Image Security
- Images not served directly to browser
- Frontend uses `authenticatedFetch()` to get images
- Server validates JWT before returning image
- Images converted to blob URLs (temporary, in-memory URLs)
- Blob URLs expire when user closes tab

---

## MULTI-TENANT BRAND SYSTEM

### How Brands Work
- Each brand has isolated:
  - Google Drive folders
  - API keys
  - User accounts
  - Jobs/images
  - Branding (colors, logo)

### Corsair Brand Configuration
```javascript
{
  id: 1,
  name: "corsair",
  displayName: "CORSAIR",
  slug: "corsair",
  logoUrl: "/attached_assets/image_1760917218883.png",
  primaryColor: "#FFC107",
  secondaryColor: "#FF6F00",
  briefFolderId: "1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697",
  productImagesFolderId: "1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS",
  editedResultsFolderId: "17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB",
  wavespeedApiKey: "ws_...",
  openaiApiKey: "sk-...",
  defaultPromptTemplate: "Add a VERY SUBTLE enhancement...",
  aiSettings: {
    batchSize: 15
  }
}
```

### Adding New Brands
Admin can create new brands via:
- POST `/api/admin/brand/create`
- Requires admin JWT token
- Sets up isolated environment
- Can create sub-accounts (e.g., Corsair → LifeTrek Medical)

---

## PERFORMANCE OPTIMIZATIONS

### Batch Processing
- Images processed in batches of 15 (configurable)
- Prevents overwhelming Wavespeed API
- Parallel processing within batches

### Caching
- Brand configurations cached in frontend
- Image blob URLs cached during session
- Database queries optimized with indexes

### Progress Updates
- Server-Sent Events (SSE) for real-time updates
- No polling needed from frontend
- Efficient one-way communication

---

## ERROR HANDLING

### Common Errors & Solutions

**Upload Fails**
- Check: File size limit (50MB)
- Check: File type (PDF/DOCX only)
- Check: Google Drive quota

**Processing Fails**
- Wavespeed API timeout → Retry with exponential backoff
- Invalid image URL → Skip image, log error
- AI parsing fails → Fallback to default template

**Authentication Fails**
- Token expired → Redirect to login
- Invalid credentials → Show error message
- Brand not found → Redirect to brand selection

---

## METRICS & ANALYTICS

### Time Savings Calculation
- Manual time per image: 15 minutes (configurable)
- AI processing time: ~15 seconds per image
- Time saved = (15 min × images) - (15 sec × images)
- Example: 20 images = 300 min manual vs. 5 min AI = **295 minutes saved**

### Tracked Metrics
- Total jobs processed
- Total images edited
- Average processing time
- Success rate
- User feedback ratings
- Time saved per brand

---

## DEPLOYMENT

### Current Setup (Replit)
- Frontend: Vite dev server on port 5000
- Backend: Node.js Express on port 3000
- Database: PostgreSQL (Neon)
- Environment variables in Replit Secrets

### Environment Variables Needed
```
DATABASE_URL=postgresql://...
GOOGLE_DRIVE_CLIENT_EMAIL=...
GOOGLE_DRIVE_PRIVATE_KEY=...
WAVESPEED_API_KEY=ws_...
OPENAI_API_KEY=sk-...
JWT_SECRET=...
```

---

## FUTURE ENHANCEMENTS (MENTIONED IN CODE)

1. **Batch API Integration**
   - Google Gemini Batch API for cost savings
   - Process multiple images in single request

2. **ML Learning**
   - Track which prompts work best
   - Learn from user feedback
   - Auto-improve prompt templates

3. **Website Scraping**
   - Analyze brand websites for style guidelines
   - Extract color palettes, typography

4. **Brandbook Analysis**
   - Parse PDF brandbooks
   - Extract design rules
   - Apply to image generation

---

This is the complete architecture for the Corsair AI Image Editor platform. Every component is designed to automate marketing image creation while maintaining brand consistency and security.
