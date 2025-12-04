# Product Requirements Document (PRD)
## CORSAIR AI Marketing Image Editor

**Document Status:** Draft  
**Version:** 1.0  
**Last Updated:** December 3, 2025  
**Product Owner:** Platform Team  
**Client:** CORSAIR  

---

## 1. Executive Summary

### 1.1 Product Overview
The CORSAIR AI Marketing Image Editor is a purpose-built platform that automates marketing image production for CORSAIR's marketing team. The platform takes campaign briefs (PDF, DOCX, or text) and product images, transforming them into polished marketing assets with professional text overlays using Google Gemini's Nano Banana Pro (gemini-3-pro-image-preview) AI model.

**Primary Focus:** Perfect the image editing experience for CORSAIR before expanding to multi-tenant architecture.

### 1.2 Product Vision
Deliver a best-in-class AI image editing solution that:
- Reduces CORSAIR's marketing image production time by 90%
- Maintains exact brand consistency with Saira typography
- Provides intuitive re-editing through conversational AI
- Exports professional, layered PSD files for final adjustments

### 1.3 Business Objectives
- **Primary Goal:** Achieve CORSAIR team satisfaction with consistent, high-quality output
- **Time Savings Target:** 4-8 hours saved per image (vs. manual Photoshop work)
- **Quality Target:** 90%+ first-pass approval rate
- **Future Goal:** Expand to multi-tenant platform after CORSAIR success

---

## 2. Core AI Architecture

### 2.1 AI Model Selection

| Purpose | Model | Rationale |
|---------|-------|-----------|
| **Image Generation & Editing** | Nano Banana Pro (gemini-3-pro-image-preview) | Best quality, 4K resolution, superior text rendering |
| **Chat Understanding** | Gemini Flash 1.5 | Fast, cost-effective intent parsing |
| **Brief Analysis** | OpenAI GPT-4 | Reliable document parsing and spec extraction |

**Key Principle:** All image generation MUST use Nano Banana Pro. No fallback to lower-quality models for production output.

### 2.2 Image Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORSAIR Image Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. INPUT                                                       │
│     ├── Brief (PDF/DOCX/Text)                                   │
│     ├── Product Images (PNG/JPG)                                │
│     └── Optional: Logo file                                     │
│                                                                 │
│  2. EXTRACTION (GPT-4)                                          │
│     ├── Parse brief text                                        │
│     ├── Extract: Title, Subtitle, Asset names                  │
│     └── Generate structured image specs                         │
│                                                                 │
│  3. PARAMETER GENERATION                                        │
│     ├── Calculate font sizes (based on image dimensions)        │
│     ├── Set gradient parameters (height, opacity, stops)        │
│     ├── Define text positions (margins, alignment)              │
│     └── Store all parameters in structured JSON                 │
│                                                                 │
│  4. IMAGE EDITING (Nano Banana Pro)                             │
│     ├── Send: Original image + Prompt + Parameters              │
│     ├── Receive: AI-edited composite image (PNG)                │
│     └── Preserve: Original product unchanged, overlays added    │
│                                                                 │
│  5. POST-PROCESSING                                             │
│     ├── Logo overlay (if requested) via Sharp                   │
│     ├── Upload to Google Drive                                  │
│     └── Store parameters for PSD generation                     │
│                                                                 │
│  6. OUTPUT                                                      │
│     ├── PNG preview in results gallery                          │
│     ├── Before/After comparison slider                          │
│     └── Downloadable layered PSD                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Chat Editor Architecture

### 3.1 Chat Flow Overview

The AI Chat Editor provides natural language image editing with a two-model architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chat Editor Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Message ──► Gemini Flash 1.5 ──► Intent + Parameters      │
│       │                                       │                 │
│       │                                       ▼                 │
│       │                              Parameter Validator        │
│       │                                       │                 │
│       │                                       ▼                 │
│       │                              Merge with Stored Params   │
│       │                                       │                 │
│       │                                       ▼                 │
│       └────────────────► Confirmation Prompt to User            │
│                                       │                         │
│                                       ▼                         │
│                      User Confirms? ──► Nano Banana Pro         │
│                             │                   │               │
│                            No                   │               │
│                             │                   ▼               │
│                             ▼          New Edited Image         │
│                          Cancel                 │               │
│                                                 ▼               │
│                                        Store New Version        │
│                                        + Parameters             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Edit Modes

The chat editor supports two distinct editing modes:

**Mode A: Fresh Edit (Edit Original)**
- Takes the ORIGINAL product image
- Applies a completely new prompt with updated parameters
- Use when: User wants to start over with different styling

**Mode B: Iterative Edit (Edit Current)**
- Takes the ALREADY EDITED image (latest version)
- Applies incremental changes based on user feedback
- Use when: User says "make it brighter" or "move text up"

### 3.3 Editable Parameters

Users can adjust these parameters via natural language:

| Parameter | Example Commands | Default Value |
|-----------|------------------|---------------|
| **Title Text** | "Change title to UNLEASH POWER" | From brief |
| **Subtitle Text** | "Make subtitle say 'Premium Performance'" | From brief |
| **Title Font Size** | "Make title bigger", "Smaller headline" | 4.5% of width |
| **Subtitle Font Size** | "Increase subtitle size" | 2% of width |
| **Gradient Intensity** | "Darker shading", "Lighter gradient" | 35% opacity |
| **Gradient Height** | "Extend gradient", "Less gradient coverage" | 22% of height |
| **Text Position** | "Move text lower", "Text more to the left" | Top-left |
| **Text Margins** | "More padding around text" | 5% left, 8% top |

### 3.4 Parameter Storage Schema

```javascript
{
  "imageId": "img_123",
  "version": 3,
  "sourceAssetId": "original_drive_id",
  "parentVersionId": "img_123_v2",  // null if fresh edit
  "parameters": {
    "title": {
      "text": "POWER UNLEASHED",
      "fontSize": 58,
      "fontFamily": "Saira-Bold",
      "color": "#FFFFFF",
      "position": { "x": 80, "y": 120 },
      "shadow": { "blur": 4, "offsetX": 2, "offsetY": 2, "color": "rgba(0,0,0,0.5)" }
    },
    "subtitle": {
      "text": "Next-generation performance for enthusiasts",
      "fontSize": 24,
      "fontFamily": "Saira-Regular",
      "color": "#FFFFFF",
      "position": { "x": 80, "y": 170 }
    },
    "gradient": {
      "height": 0.22,
      "stops": [
        { "position": 0, "color": "rgba(20,20,20,0.35)" },
        { "position": 1, "color": "rgba(20,20,20,0)" }
      ]
    },
    "logo": {
      "enabled": false,
      "fileId": null,
      "position": "bottom-right",
      "sizePercent": 15
    }
  },
  "promptHash": "abc123",
  "generatedAt": "2025-12-03T10:30:00Z"
}
```

---

## 4. Layered PSD Generation (Future Enhancement)

### 4.1 Architecture Approach

**Recommended Strategy: Hybrid AI + Programmatic**

The PSD generation will use a hybrid approach:
- **AI (Nano Banana Pro)**: Generates the composite hero image (text + gradient on product)
- **Programmatic (ag-psd)**: Creates individual editable layers from stored parameters

This approach ensures:
- Deterministic typography (exact Saira font matching)
- Precise gradient positioning
- Editable text layers in Photoshop
- Alignment with stored parameters for consistency

### 4.2 PSD Layer Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    PSD Layer Stack                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Layer 1: Title (Editable Text) ──────────────────────┐    │
│  │   Font: Saira-Bold                                      │    │
│  │   Style: From stored parameters                         │    │
│  │   Editable: YES                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── Layer 2: Subtitle (Editable Text) ───────────────────┐    │
│  │   Font: Saira-Regular                                   │    │
│  │   Style: From stored parameters                         │    │
│  │   Editable: YES                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── Layer 3: Gradient Overlay ───────────────────────────┐    │
│  │   Generated: Programmatically from stored params        │    │
│  │   Adjustable: Opacity slider in Photoshop               │    │
│  │   Editable: YES                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── Layer 4: Logo (Optional) ────────────────────────────┐    │
│  │   Source: Uploaded logo file or placeholder             │    │
│  │   Position: From stored parameters                      │    │
│  │   Editable: YES                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── Layer 5: Original Product Image (Background) ────────┐    │
│  │   Source: Original unmodified product image             │    │
│  │   Locked: Optional                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── Group: AI Reference (Hidden) ────────────────────────┐    │
│  │   - AI Edited Composite (for comparison)                │    │
│  │   - Difference Layer (visual changes)                   │    │
│  │   Visible: NO (reference only)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Layer Generation Source

| Layer | Generation Method | Source |
|-------|-------------------|--------|
| Title Text | Programmatic (ag-psd) | Stored parameters |
| Subtitle Text | Programmatic (ag-psd) | Stored parameters |
| Gradient Overlay | Programmatic (Canvas API) | Stored gradient config |
| Logo | File reference | Uploaded logo or placeholder |
| Background | Direct file | Original product image |
| AI Reference | AI output | Nano Banana Pro composite |

**Why NOT AI-generated individual layers?**
- AI text rendering varies; programmatic is deterministic
- Gradient positioning is exact with Canvas API
- Font matching is guaranteed with ag-psd
- Parameters are already stored for consistency
- Faster generation (no multiple AI calls)

---

## 5. Typography System

### 5.1 Font Specifications

**Exclusive Font Family: Saira**

| Element | Font | Weight | Case | Color |
|---------|------|--------|------|-------|
| Title | Saira | Bold | UPPERCASE | #FFFFFF (White) |
| Subtitle | Saira | Regular | Sentence case | #FFFFFF (White) |

### 5.2 Text Accuracy Requirements

- **Character-for-Character Accuracy**: AI must render text EXACTLY as provided
- **No AI Modifications**: Never add/remove words, punctuation, or formatting
- **Explicit Instructions**: Prompts include "copy text character-for-character"

---

<!-- 
## 6. ML Feedback & Learning System (DEFERRED)

NOTE: This section is commented out as it is not a priority for the current phase.
Focus is on perfecting the core editing experience for CORSAIR first.

### 6.1 Feedback Collection
- 5-star rating per image
- Text feedback for improvements
- Automatic tracking of re-edit patterns

### 6.2 Prompt Optimization
- GPT-4 powered prompt analysis
- A/B testing of prompt variations
- Performance metrics per prompt template

### 6.3 Learning Pipeline
- Aggregate feedback by prompt type
- Identify patterns in successful edits
- Auto-suggest prompt improvements

This will be revisited after CORSAIR is satisfied with the platform.
-->

---

## 6. Current Implementation Status

### 6.1 Completed Features
- [x] PDF/DOCX/Text brief upload and parsing
- [x] Google Drive integration (brief upload, image storage)
- [x] Nano Banana Pro image generation (gemini-3-pro-image-preview)
- [x] Before/After comparison slider
- [x] AI Chat Assistant with vision capabilities (GPT-4o)
- [x] Re-editing workflow with confirmation
- [x] Basic PSD download with editable text layers
- [x] Saira font integration
- [x] User authentication (brand-specific login)

### 6.2 In Progress / Planned
- [ ] Switch chat from GPT-4o to Gemini Flash 1.5
- [ ] Structured parameter storage per image
- [ ] Parameter editing via chat commands
- [ ] Enhanced PSD with individual overlay layers
- [ ] Version tracking for iterative edits

---

## 7. Future: Multi-Tenant Architecture (POST-CORSAIR)

**Status:** Planned for after CORSAIR success

### 7.1 Automated Brand Setup via Web Scraping

When a new client uploads their website URL:

1. **Web Scraper** analyzes the website
2. **Extracts**: Logo, colors, typography, brand voice
3. **Generates**: Default brand settings and prompt templates
4. **Creates**: Isolated Google Drive folders
5. **Configures**: Brand-specific AI parameters

### 7.2 Multi-Tenant Features (Future)
- Sub-account management
- Seat-based user licensing
- Usage analytics per brand
- Prompt template library with versioning
- Cross-brand isolation and security

**Focus:** These features will be developed AFTER CORSAIR is fully satisfied with the platform.

---

## 8. Success Metrics

### 8.1 Quality Metrics
- **First-Pass Approval Rate:** Target 90%+
- **Text Accuracy:** 100% character-for-character match
- **Image Preservation:** Original product unchanged
- **Re-edit Rate:** <20% of images needing re-edits

### 8.2 Performance Metrics
- **Processing Time:** <30 seconds per image
- **PSD Generation:** <5 seconds per file
- **Chat Response:** <3 seconds for understanding
- **System Uptime:** 99.5%+

### 8.3 User Satisfaction
- **CORSAIR Team Feedback:** Regular check-ins
- **Feature Requests:** Prioritized backlog
- **Issue Resolution:** <24 hour response time

---

## 9. Environment Configuration

### 9.1 Required Environment Variables

```bash
# AI Models
GEMINI_API_KEY=your_gemini_api_key
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview  # Always Nano Banana Pro

# Supporting Services
OPENAI_API_KEY=your_openai_api_key  # For brief parsing
DATABASE_URL=postgresql://...

# Security
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# Optional
CANVAS_TEST_ENABLED=false
```

### 9.2 Model Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| GEMINI_IMAGE_MODEL | gemini-3-pro-image-preview | Nano Banana Pro (required) |
| Chat Model | gemini-1.5-flash | For intent parsing (future) |
| Brief Parser | gpt-4 | For document extraction |

---

## 10. Implementation To-Do List

### Phase 1: Core Improvements (Current Priority)

| # | Task | Priority | Status | Description |
|---|------|----------|--------|-------------|
| 1 | **Enforce Nano Banana Pro** | P0 | Done | Ensure all image generation uses gemini-3-pro-image-preview exclusively |
| 2 | **Implement Parameter Storage** | P0 | To Do | Store structured JSON parameters per image edit (font sizes, gradient config, positions) |
| 3 | **Update Chat to Flash 1.5** | P1 | To Do | Replace GPT-4o with Gemini Flash 1.5 for chat understanding; keep Nano Banana Pro for generation |
| 4 | **Add Parameter Editing** | P1 | To Do | Allow users to adjust parameters via natural language ("make title bigger") |
| 5 | **Implement Version Tracking** | P1 | To Do | Track edit versions with parent pointers for iterative editing |
| 6 | **Add Edit Mode Selection** | P2 | To Do | UI toggle for "Edit Original" vs "Edit Current" |

### Phase 2: Enhanced PSD Generation

| # | Task | Priority | Status | Description |
|---|------|----------|--------|-------------|
| 7 | **Create Separate Title Layer** | P1 | To Do | Generate title as independent editable text layer in PSD |
| 8 | **Create Separate Subtitle Layer** | P1 | To Do | Generate subtitle as independent editable text layer in PSD |
| 9 | **Create Editable Gradient Layer** | P1 | To Do | Generate gradient as adjustable layer (not flattened) |
| 10 | **Add Logo Layer Placeholder** | P2 | To Do | Include optional logo layer with position from parameters |
| 11 | **Improve Layer Naming** | P2 | To Do | Clear, descriptive layer names for Photoshop workflow |

### Phase 3: Quality & Polish

| # | Task | Priority | Status | Description |
|---|------|----------|--------|-------------|
| 12 | **Text Accuracy Validation** | P1 | To Do | Add validation to ensure text matches input exactly |
| 13 | **Parameter Presets** | P2 | To Do | Save and reuse parameter configurations |
| 14 | **Batch Parameter Updates** | P2 | To Do | Apply parameter changes to multiple images at once |
| 15 | **Enhanced Error Messaging** | P2 | To Do | Clear error messages when edits fail |

### Phase 4: Future (Post-CORSAIR)

| # | Task | Priority | Status | Description |
|---|------|----------|--------|-------------|
| 16 | **Web Scraping Brand Setup** | P3 | Future | Auto-configure brands from website URL |
| 17 | **Multi-Tenant Architecture** | P3 | Future | Isolated brands with sub-accounts |
| 18 | **ML Feedback System** | P3 | Future | Learn from user feedback to improve prompts |
| 19 | **Prompt Template Library** | P3 | Future | Version-controlled prompt templates per brand |
| 20 | **Usage Analytics Dashboard** | P3 | Future | Track usage, costs, and performance per brand |

---

## 11. Technical Dependencies

### 11.1 Core Dependencies
- **@google/genai** - Gemini API SDK for image generation
- **ag-psd** - PSD file generation with editable layers
- **sharp** - Image manipulation (logo overlay)
- **mammoth** - DOCX text extraction
- **pdfjs-dist** - PDF text extraction

### 11.2 Fonts
- **Saira-Bold.ttf** - Title text
- **Saira-Regular.ttf** - Subtitle text

### 11.3 Infrastructure
- **PostgreSQL (Neon)** - Database
- **Google Drive API** - File storage
- **Express.js** - Backend server
- **React/Vite** - Frontend

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Nano Banana Pro** | Internal name for gemini-3-pro-image-preview model |
| **Flash 1.5** | Gemini 1.5 Flash model for fast text understanding |
| **PSD** | Photoshop Document format with editable layers |
| **Brief** | Marketing document (PDF/DOCX) with image requirements |
| **Parameters** | Stored configuration values (font sizes, positions, etc.) |
| **Fresh Edit** | Re-editing using the original image as source |
| **Iterative Edit** | Re-editing using the current edited version as source |

---

## Appendix B: Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Dec 3, 2025 | Initial CORSAIR-specific PRD | Platform Team |

---

**Document Status:** Draft - Pending Client Review  
**Next Review:** After CORSAIR team feedback on to-do list priorities
