
# CORSAIR AI IMAGE EDITOR - COMPLETE PLATFORM DOCUMENTATION

## OVERVIEW
This is an AI-powered image editing platform built specifically for CORSAIR's marketing team. It automates the process of adding text overlays and enhancements to product images using AI, replacing manual Photoshop work.

**Last Updated:** December 2025

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
   - Pontential Logos or Icons to add to the main image. 
   - Custom AI prompts for each image.

### 3. PROCESSING IMAGES
Once the brief is analyzed:

**Step 1: Find Product Images**
- System looks in Google Drive's "Product Images" folder
- Matches the asset names from the brief to actual image files

**Step 2: AI Image Editing**
For each image:
- Original image URL is generated from Google Drive
- Image + AI prompt sent to Google Gemini Image API
- Gemini adds:
  - Dark gradient overlay at top
  - Title text (large, bold, white, Saira font)
  - Subtitle text (smaller, regular, white, Saira font)
  - Text shadows for readability
- Gemini processes the image (takes ~15-30 seconds)

**Step 3: Save Results**
- Edited images are downloaded from Gemini (base64 encoded)
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
- System sends to Gemini again with new prompt
- New version saved, old version kept for comparison

---

## BACKEND ARCHITECTURE

### DATABASE STRUCTURE (PostgreSQL via Drizzle ORM)

**Tables:**

1. **brands** - Stores brand configurations
   - id, name, slug (e.g., "corsair")
   - logoUrl, primaryColor, secondaryColor
   - Google Drive folder IDs (briefFolderId, productImagesFolderId, editedResultsFolderId)
   - API keys (geminiApiKey, openaiApiKey)
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
  - Sends to Google Gemini Image API
  - Receives base64-encoded edited image
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
  - Layer 3: Editable text layers (Saira font)
- Returns downloadable PSD file

**server/routes/reEdit.js** - Re-editing existing images
- `/api/re-edit/:imageId` - Re-edits a specific image
- Takes custom prompt
- Sends to Gemini again
- Saves as new version

**server/services/nanoBananaService.js** - Google Gemini Integration
- Uses `@google/genai` SDK
- Supports multiple models:
  - `gemini-2.5-flash-image` (Nano Banana) - Default, fast
  - `gemini-3-pro-image-preview` (Nano Banana Pro) - Advanced, higher quality
- Model configurable via `GEMINI_IMAGE_MODEL` environment variable
- Handles image editing with text overlay prompts

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

**Google Gemini Image API - Nano Banana / Nano Banana Pro**
- SDK: `@google/genai`
- Models:
  - `gemini-2.5-flash-image` - Fast image generation (default)
  - `gemini-3-pro-image-preview` - Advanced image editing
- Request format:
```javascript
const contents = [
  { text: prompt },
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64ImageData,
    },
  },
];

const response = await ai.models.generateContent({
  model: "gemini-3-pro-image-preview",
  contents: contents,
});
```
- Returns:
  - Base64-encoded image data
  - Optional text response

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
   
   a. **Fetch Image**
      - Download image from Google Drive
      - Convert to base64
   
   b. **Send to Google Gemini**
      - POST using @google/genai SDK
      - Body: `{contents: [{text: prompt}, {inlineData: {mimeType, data: base64}}]}`
      - Response: base64-encoded edited image
   
   c. **Save Edited Image**
      - Decode base64 to buffer
      - Upload to Google Drive "New Images" folder
      - Get public URL
   
   d. **Update Database**
      - INSERT into `images` table
      - Store URLs, metadata, processing time
      - UPDATE job: `processedImages = 1`
   
   e. **Send Progress to Frontend (SSE)**
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
  geminiApiKey: "AIza...",
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
- Prevents overwhelming Gemini API
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
- Gemini API timeout → Retry with exponential backoff
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
- AI processing time: ~15-30 seconds per image
- Time saved = (15 min × images) - (30 sec × images)
- Example: 20 images = 300 min manual vs. 10 min AI = **290 minutes saved**

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
GEMINI_API_KEY=AIza...
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview  # Optional, defaults to gemini-2.5-flash-image
OPENAI_API_KEY=sk-...
JWT_SECRET=...
SESSION_SECRET=...
CANVAS_TEST_ENABLED=false  # Set to true to enable canvas test route
```

---

## TYPOGRAPHY SYSTEM

### Saira Font Family
All text overlays use the Saira geometric sans-serif font exclusively:
- **Saira Bold** for titles (uppercase, white, top-left positioning)
- **Saira Regular** for subtitles (sentence case, white, below title)

### Font Files Location
```
fonts/
├── Saira-Bold.ttf
└── Saira-Regular.ttf
```

### Text Rendering
- Text is rendered by Google Gemini as part of the image editing
- Prompts include specific Saira font instructions
- Character-for-character text accuracy enforced in prompts

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
