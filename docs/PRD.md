# Product Requirements Document (PRD)
## Multi-Brand AI Marketing Image Editor

**Document Status:** Approved  
**Version:** 1.0  
**Last Updated:** November 3, 2025  
**Product Owner:** Platform Team  
**Contributors:** Engineering, Design, Product Management  

---

## 1. Executive Summary

### 1.1 Product Overview
The Multi-Brand AI Marketing Image Editor is a professional, multi-tenant SaaS platform that revolutionizes marketing image production through AI-powered automation. The platform allows marketing teams to upload campaign briefs (PDF, DOCX, or text) and product images, which are then instantly transformed into polished marketing assets using the Wavespeed Nano Banana API.

### 1.2 Product Vision
To become the industry-leading solution for AI-powered marketing image production, delivering measurable ROI through time savings, consistency, and quality while maintaining brand integrity across multiple sub-brands and teams.

### 1.3 Business Objectives
- **Primary Goal:** Reduce marketing image production time by 80-90%
- **ROI Target:** Deliver 10x time savings compared to manual editing
- **Market Position:** Enterprise-grade multi-tenant platform for marketing teams
- **Revenue Model:** Seat-based SaaS pricing with usage limits per tier

---

## 2. Problem Statement & Market Need

### 2.1 Customer Pain Points
1. **Time-Intensive Manual Editing:** Marketing teams spend 4-8 hours per image on manual editing
2. **Inconsistent Brand Application:** Difficulty maintaining brand consistency across multiple sub-brands
3. **Scalability Challenges:** Unable to scale production during peak campaign seasons
4. **Limited Creative Resources:** Not enough designers to meet demand
5. **Feedback Loop Inefficiency:** Multiple revision rounds slow time-to-market

### 2.2 Why Now?
- AI image generation technology has matured to production-ready quality
- Marketing teams face increasing pressure to produce more content faster
- Remote work has fragmented brand management across distributed teams
- Enterprise clients demand multi-tenant solutions with granular access control

---

## 3. Target Users & Personas

### 3.1 Primary Personas

#### **Persona 1: Marketing Manager (Primary User)**
- **Role:** Oversees brand campaigns and asset production
- **Goals:** 
  - Produce high-quality marketing images quickly
  - Maintain brand consistency across campaigns
  - Reduce dependency on external designers
- **Pain Points:**
  - Limited design resources
  - Tight campaign deadlines
  - Brand guideline enforcement
- **Success Metrics:** Time saved, output quality, campaign velocity

#### **Persona 2: Brand Administrator (CRM Manager)**
- **Role:** Manages sub-brand accounts, users, and configurations
- **Goals:**
  - Configure brand-specific settings and prompts
  - Monitor usage and costs across teams
  - Manage user access and permissions
- **Pain Points:**
  - Complex multi-brand hierarchies
  - Need for granular usage tracking
  - User onboarding and management overhead
- **Success Metrics:** User adoption, cost control, configuration efficiency

#### **Persona 3: Creative Director (Quality Reviewer)**
- **Role:** Reviews and approves AI-generated marketing assets
- **Goals:**
  - Ensure output meets brand standards
  - Provide feedback for continuous improvement
  - Train AI models on brand preferences
- **Pain Points:**
  - Inconsistent AI output quality
  - Difficulty articulating desired changes
  - No visibility into prompt performance
- **Success Metrics:** Output quality scores, revision rates, approval speed

---

## 4. Core Features & Requirements

### 4.1 Feature Priority Framework
- **P0 (Must-Have):** Required for MVP launch
- **P1 (High Priority):** Needed within 3 months post-launch
- **P2 (Medium Priority):** Enhances user experience
- **P3 (Nice-to-Have):** Future consideration

### 4.2 Core Features

#### **4.2.1 Multi-Input Brief Processing (P0)**
**User Story:** As a marketing manager, I want to submit campaign briefs via PDF, DOCX, or text so that I can work with my existing workflow.

**Functional Requirements:**
- Support PDF upload with text extraction (pdfjs-dist)
- Support DOCX upload with intelligent image filtering (Mammoth.js)
- Support direct text input via textarea
- Extract marketing requirements and convert to AI prompts
- Validate file types and size limits (10MB max)

**Acceptance Criteria:**
- Users can drag-and-drop files or click to upload
- System extracts text and images from DOCX without processing embedded logos
- Brief content is parsed and displayed for review
- Invalid files show clear error messages

#### **4.2.2 Parallel AI Image Processing (P0)**
**User Story:** As a user, I want my images processed quickly so that I can meet tight deadlines.

**Functional Requirements:**
- Upload multiple product images (PNG, JPG, up to 20 images)
- Process images in parallel batches of 15 using Wavespeed Nano Banana API
- Show real-time progress updates for each image
- Store original and edited images in Google Drive
- Generate public URLs for preview and download

**Acceptance Criteria:**
- Images process in <30 seconds per image on average
- Progress bar updates in real-time for each image
- All images complete successfully or show specific error messages
- Edited images display in results gallery immediately

#### **4.2.3 Interactive Before/After Comparison (P0)**
**User Story:** As a user, I want to compare original and edited images side-by-side so that I can evaluate quality.

**Functional Requirements:**
- Display before/after slider for each image pair
- Support drag-to-compare interaction
- Show images at full resolution
- Enable zoom and pan functionality
- Load images securely via authenticated API calls

**Acceptance Criteria:**
- Slider responds smoothly to mouse/touch input
- Images load within 2 seconds
- High-resolution images display without quality loss
- Before/after comparison clearly shows AI edits

#### **4.2.4 AI Chat Assistant for Selective Re-editing (P0)**
**User Story:** As a user, I want to tell the AI in natural language to re-edit specific images so that I can refine results without starting over.

**Functional Requirements:**
- Floating chat widget accessible from results page
- Natural language command processing via GPT-4
- Function calling to trigger image re-edits
- Support image selection by number or "all images"
- Display chat history and processing status

**Acceptance Criteria:**
- Users can type commands like "make image 3 brighter"
- AI correctly identifies target images and edit instructions
- Re-edited images replace previous versions
- Chat provides confirmation and progress updates

#### **4.2.5 Layered PSD Download (P0)**
**User Story:** As a creative director, I want to download layered PSD files so that I can make final adjustments in Photoshop.

**Functional Requirements:**
- Generate PSD files with separate layers for original and edited images
- Use ag-psd and node-canvas for PSD creation
- Support individual PSD download per image
- Support bulk ZIP download of all PSDs

**Acceptance Criteria:**
- PSD files open correctly in Adobe Photoshop
- Layers are properly named ("Original", "AI Edited")
- Images retain full resolution in PSD format
- Bulk download includes all processed images

#### **4.2.6 Multi-Tenant Brand Management (P0)**
**User Story:** As a platform administrator, I want to manage multiple brands with isolated data so that clients maintain privacy and customization.

**Functional Requirements:**
- Create primary brands and sub-accounts (e.g., Corsair → LifeTrek Medical)
- Configure brand-specific colors, logos, and branding assets
- Set Google Drive folder paths for isolated file storage
- Store brand-specific API keys (Wavespeed, OpenAI)
- Configure default prompt templates per brand

**Acceptance Criteria:**
- Each brand has isolated Google Drive folders
- Brand-specific theming loads dynamically in UI
- Sub-accounts inherit parent brand structure
- Admin can create/edit/deactivate brands via secure API

#### **4.2.7 User Management & RBAC (P1)**
**User Story:** As a brand administrator, I want to manage team members with different access levels so that I can control who can do what.

**Functional Requirements:**
- Support 4 roles: Owner, Admin, Member, Viewer
- Seat-based user limits enforced per brand
- User invitation system with email tokens
- bcrypt password hashing for security
- Role-based permissions on jobs, images, and settings

**Acceptance Criteria:**
- Brand admins can invite users via email
- Users receive invitation link with token
- Seat limits prevent over-provisioning
- Role permissions correctly restrict access

#### **4.2.8 Prompt Template Library with Versioning (P1)**
**User Story:** As a brand administrator, I want to create reusable prompt templates so that I can standardize and improve output quality.

**Functional Requirements:**
- Create, edit, and delete prompt templates
- Version control for prompt changes
- Track performance metrics per prompt version (rating, usage count)
- Set default prompts per brand
- Categorize prompts by use case

**Acceptance Criteria:**
- Templates save with versioning history
- Performance data links to specific versions
- Users can select from template library
- Default templates auto-populate for new jobs

#### **4.2.9 Usage Analytics Dashboard (P1)**
**User Story:** As a brand administrator, I want to see usage metrics so that I can track ROI and optimize spending.

**Functional Requirements:**
- Daily usage tracking: jobs created/completed/failed
- Image counts: uploaded vs. processed
- API call tracking (Wavespeed, OpenAI)
- Cost estimation per brand
- Time savings calculation (processing time vs. manual estimate)

**Acceptance Criteria:**
- Dashboard displays current month metrics
- Historical data available for trend analysis
- Cost estimates accurate within 10%
- Time savings calculated using 4-hour manual baseline

#### **4.2.10 ML-Powered Prompt Optimization (P1)**
**User Story:** As a platform administrator, I want the AI to analyze feedback and suggest prompt improvements so that output quality continuously improves.

**Functional Requirements:**
- Collect 5-star ratings with detailed metrics (goal alignment, creativity, technical quality)
- Analyze rating patterns using GPT-4
- Generate prompt improvement suggestions
- Show performance breakdown by prompt version
- Identify what makes high-performing prompts successful

**Acceptance Criteria:**
- Users can rate images with 1-5 stars
- ML analysis runs on-demand via admin dashboard
- Improvement suggestions include specific changes and expected impact
- Analysis identifies low-performing prompts automatically

#### **4.2.11 Time Metrics Dashboard (P0)**
**User Story:** As a user, I want to see how much time I've saved so that I can justify the platform investment to stakeholders.

**Functional Requirements:**
- Display "Time Saved", "Efficiency Gain %", "Processing Time", "Manual Estimate"
- Calculate metrics in real-time during processing
- Show metrics on job completion page
- Use 4-8 hour manual estimate per image as baseline

**Acceptance Criteria:**
- Metrics update in real-time during processing
- Time saved calculation is accurate
- Efficiency gain displayed as percentage
- Metrics persist with job for historical tracking

---

## 5. Technical Architecture

### 5.1 Technology Stack

**Frontend:**
- React.js (Vite) - Component-based UI
- React Router DOM - Client-side routing
- Custom authentication utilities (authenticatedFetch, postJSON)

**Backend:**
- Node.js + Express - REST API server
- Drizzle ORM - Database queries and migrations
- JWT - Token-based authentication
- bcrypt - Password hashing

**Database:**
- PostgreSQL (Neon) - Multi-tenant data storage

**Storage:**
- Google Drive API - File storage with brand-specific folders

**AI/ML Services:**
- Wavespeed Nano Banana API - Image editing
- OpenAI GPT-4 - Chat assistant, function calling, ML analysis

**File Processing:**
- Mammoth.js - DOCX parsing
- pdfjs-dist - PDF text extraction
- ag-psd + node-canvas - PSD generation
- Sharp - Image manipulation

### 5.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Upload UI    │  │ Results Page │  │ Admin CRM    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (JWT Auth)
┌──────────────────────────▼──────────────────────────────────┐
│                    Backend (Express)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Job API      │  │ Image API    │  │ Admin API    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼───────┐     │
│  │           Drizzle ORM (Database Layer)            │     │
│  └──────────────────────────────────────────────────┘     │
└──────┬──────────────────┬──────────────────┬──────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│ PostgreSQL  │   │ Google Drive │   │  Wavespeed   │
│   (Neon)    │   │     API      │   │  + OpenAI    │
└─────────────┘   └──────────────┘   └──────────────┘
```

### 5.3 Data Flow

**Image Processing Workflow:**
1. User uploads brief (PDF/DOCX/text) + product images
2. Backend extracts text from brief, parses requirements
3. Images uploaded to Google Drive (brand-specific folder)
4. Job created in PostgreSQL with status='processing'
5. Images sent to Wavespeed API in parallel batches (15 concurrent)
6. Edited images saved to Google Drive
7. Database updated with image URLs and metadata
8. Job status updated to 'completed'
9. Frontend polls job status, displays results

**Authentication Flow:**
1. User logs in at `/:brandSlug/login` with password
2. Backend verifies password, generates JWT token
3. Token stored in localStorage
4. All API requests include token in Authorization header
5. Middleware verifies token, extracts brandId
6. Data queries filtered by brandId for isolation

### 5.4 Security Considerations

**Data Isolation:**
- All database queries filtered by brandId
- Google Drive folders isolated per brand
- JWT tokens include brandId claim

**Authentication:**
- bcrypt password hashing (salt rounds: 10)
- JWT with expiration (24 hours)
- Admin API protected by X-Admin-Key header

**API Key Management:**
- Brand-specific API keys stored encrypted
- Keys never exposed in frontend
- Loaded per-request via brandLoader utility

**File Upload Security:**
- File type validation (whitelist)
- File size limits (10MB briefs, 5MB images)
- Content-Type verification

---

## 6. Success Metrics & KPIs

### 6.1 User Engagement Metrics
- **Monthly Active Users (MAU)** per brand
- **Jobs Created per User per Month**
- **Average Images Processed per Job**
- **User Retention Rate (30/60/90 day)**

### 6.2 Performance Metrics
- **Average Processing Time per Image:** <30 seconds
- **Job Success Rate:** >95%
- **System Uptime:** >99.5%
- **API Response Time:** <200ms (p95)

### 6.3 Business Metrics
- **Time Saved per Job:** 4-8 hours average
- **Efficiency Gain:** 80-90%
- **Cost per Image:** <$0.50 (API costs)
- **Customer Acquisition Cost (CAC):** TBD
- **Monthly Recurring Revenue (MRR):** TBD

### 6.4 Quality Metrics
- **Average User Rating:** >4.0 / 5.0 stars
- **Goal Alignment Score:** >4.0 / 5.0
- **Creativity Score:** >3.5 / 5.0
- **Technical Quality Score:** >4.0 / 5.0
- **Revision Rate:** <20%

---

## 7. User Workflows

### 7.1 Core User Journey: Image Processing

**Step 1: Upload Brief**
- Navigate to brand homepage (`/corsair`)
- Click "Start New Project"
- Upload PDF/DOCX brief OR paste text
- System extracts campaign requirements

**Step 2: Upload Product Images**
- Drag-and-drop up to 20 product images
- See file previews with validation
- Click "Start Processing"

**Step 3: Monitor Processing**
- View real-time progress for each image
- See step-by-step processing status
- View time metrics (processing time, time saved)

**Step 4: Review Results**
- Browse results gallery with before/after sliders
- Rate individual images (5-star scale)
- Provide text feedback

**Step 5: Refine with AI Chat**
- Open chat widget
- Type commands like "make image 3 brighter and more saturated"
- AI re-processes selected images
- Review updated results

**Step 6: Download Assets**
- Download individual images (PNG)
- Download layered PSDs
- Download bulk ZIP of all assets

### 7.2 Admin Journey: Brand Configuration

**Step 1: Create Brand**
- Access admin dashboard
- Click "Add New Brand"
- Enter brand name, slug, colors, logo
- Configure Google Drive folders

**Step 2: Configure Prompts**
- Navigate to Prompts tab
- Create default prompt template
- Set AI parameters (temperature, max_tokens)
- Save as active version

**Step 3: Add Users**
- Navigate to Users tab
- Click "Invite User"
- Enter email and assign role (Admin/Member/Viewer)
- Send invitation

**Step 4: Monitor Usage**
- Navigate to Analytics tab
- Review daily usage metrics
- Check cost estimates
- Analyze time savings trends

**Step 5: Optimize with ML**
- Navigate to ML Insights tab
- Click "Run Analysis"
- Review prompt performance breakdown
- Apply suggested prompt improvements

---

## 8. Scope & Constraints

### 8.1 In Scope (MVP)
✅ Multi-tenant brand management  
✅ PDF/DOCX/text brief processing  
✅ Parallel AI image editing (Wavespeed API)  
✅ Before/after comparison UI  
✅ AI chat for selective re-editing  
✅ PSD download (layered files)  
✅ User management with RBAC  
✅ Prompt template library  
✅ Usage analytics dashboard  
✅ ML-powered prompt optimization  
✅ Time savings metrics  

### 8.2 Out of Scope (Post-MVP)
❌ Video editing capabilities  
❌ Real-time collaboration (multiplayer editing)  
❌ Mobile native apps (iOS/Android)  
❌ Integration with DAM systems (Bynder, Brandfolder)  
❌ Advanced image manipulation (masking, layers)  
❌ Social media direct publishing  
❌ Workflow automation builder (drag-and-drop)  
❌ Custom AI model training  
❌ Offline mode support  

### 8.3 Assumptions
- Users have Google Drive access for file storage
- Wavespeed Nano Banana API maintains <30s response times
- OpenAI GPT-4 API availability for chat and ML features
- Users access platform via modern web browsers (Chrome, Firefox, Safari, Edge)
- Internet connection required (no offline support)

### 8.4 Dependencies
- **External APIs:** Wavespeed, OpenAI, Google Drive
- **Infrastructure:** Neon PostgreSQL database, Replit hosting
- **Third-party Libraries:** See Technical Architecture section

### 8.5 Technical Constraints
- Image processing limited to 20 images per job
- File size limits: 10MB (briefs), 5MB (images)
- Parallel processing capped at 15 concurrent API calls
- PostgreSQL database storage limits per Neon tier
- Google Drive storage quotas per brand account

---

## 9. Timeline & Roadmap

### 9.1 Phase 1: MVP Launch (Completed - October 2025)
✅ Core image processing pipeline  
✅ Multi-tenant architecture  
✅ Brand-specific authentication  
✅ Before/after comparison UI  
✅ AI chat assistant  
✅ PSD download  

### 9.2 Phase 2: CRM & Analytics (Completed - October 2025)
✅ User management with RBAC  
✅ Prompt template library  
✅ Usage analytics dashboard  
✅ ML-powered prompt optimization  
✅ Feedback and rating system  

### 9.3 Phase 3: Enterprise Features (Q1 2026)
🔲 SSO integration (SAML, OAuth)  
🔲 Advanced workflow customization  
🔲 API access for programmatic usage  
🔲 Webhook notifications  
🔲 Audit logs and compliance reporting  

### 9.4 Phase 4: Advanced Editing (Q2 2026)
🔲 Advanced image manipulation tools  
🔲 Template-based editing  
🔲 Batch operations across jobs  
🔲 Version control for edited images  

### 9.5 Phase 5: Integration & Automation (Q3 2026)
🔲 DAM system integrations  
🔲 Social media publishing  
🔲 Zapier/Make.com connectors  
🔲 Slack/Teams notifications  

---

## 10. Stakeholders & Roles

### 10.1 Internal Stakeholders

| Role | Responsibility | Contact |
|------|---------------|---------|
| Product Manager | Product strategy, roadmap, requirements | PM Team |
| Engineering Lead | Technical architecture, implementation | Dev Team |
| UX Designer | User experience, interface design | Design Team |
| QA Lead | Testing, quality assurance | QA Team |
| DevOps | Infrastructure, deployment, monitoring | Ops Team |

### 10.2 External Stakeholders

| Role | Responsibility | Engagement |
|------|---------------|------------|
| Beta Customers | Feedback, testing | Weekly calls |
| Wavespeed API Team | API support, performance | As needed |
| OpenAI | API support, quota management | As needed |
| Google Drive Support | Storage integration | As needed |

---

## 11. Risks & Mitigation

### 11.1 Technical Risks

**Risk:** Wavespeed API downtime or performance degradation  
**Impact:** High - core functionality blocked  
**Mitigation:** 
- Implement retry logic with exponential backoff
- Add secondary AI provider as fallback
- Cache successful edits for re-use

**Risk:** Database performance degradation at scale  
**Impact:** Medium - slow queries affect UX  
**Mitigation:**
- Implement proper indexing strategy
- Add query caching layer (Redis)
- Optimize N+1 queries with Drizzle ORM

**Risk:** Google Drive quota limits reached  
**Impact:** Medium - storage blocked  
**Mitigation:**
- Monitor storage usage per brand
- Implement automatic cleanup of old jobs
- Alert admins when approaching limits

### 11.2 Business Risks

**Risk:** Low user adoption / high churn  
**Impact:** High - revenue target missed  
**Mitigation:**
- Comprehensive onboarding flow
- In-app tutorials and tooltips
- Dedicated customer success team

**Risk:** High API costs erode margins  
**Impact:** High - unprofitable unit economics  
**Mitigation:**
- Implement usage limits per tier
- Optimize prompt efficiency to reduce tokens
- Negotiate volume discounts with API providers

### 11.3 Security Risks

**Risk:** Data breach exposing customer images  
**Impact:** Critical - reputation and legal liability  
**Mitigation:**
- Encrypt data at rest and in transit
- Regular security audits
- Implement RBAC strictly
- SOC 2 compliance process

**Risk:** API key leakage  
**Impact:** High - unauthorized usage, costs  
**Mitigation:**
- Never expose keys in frontend
- Rotate keys regularly
- Monitor for unusual API usage patterns

---

## 12. Open Questions & Future Considerations

### 12.1 Open Questions
1. Should we support custom AI model training per brand?
2. What is the optimal pricing model (seat-based vs. usage-based)?
3. Do we need mobile apps or is responsive web sufficient?
4. Should we build integration marketplace for third-party tools?

### 12.2 Future Enhancements
- Real-time collaboration (multiplayer editing sessions)
- Video editing capabilities (Wavespeed video API when available)
- Advanced analytics (A/B testing of prompts)
- White-label deployment for enterprise customers
- API access for programmatic usage

---

## 13. Appendix

### 13.1 Glossary
- **Brand:** A primary client account with its own settings and users
- **Sub-account:** A child brand under a parent (e.g., LifeTrek Medical under Corsair)
- **Job:** A single processing session (brief + images)
- **Prompt Template:** Reusable AI instruction set for image editing
- **Seat:** A user license allocated to a brand
- **Workflow:** Customizable processing pipeline configuration

### 13.2 References
- Wavespeed Nano Banana API Documentation
- OpenAI GPT-4 API Documentation
- Google Drive API Documentation
- Drizzle ORM Documentation

### 13.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 3, 2025 | Platform Team | Initial PRD creation |

---

**Approval Signatures:**

_Product Manager:_ _________________ _Date:_ _________

_Engineering Lead:_ _________________ _Date:_ _________

_UX Lead:_ _________________ _Date:_ _________
