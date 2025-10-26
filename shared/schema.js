import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Subaccounts (formerly brands) - CRM-style multi-tenant accounts
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull().unique(),
  
  // Parent brand for sub-accounts (e.g., LifeTrek Medical under Corsair)
  parentBrandId: integer('parent_brand_id').references(() => brands.id),
  brandType: text('brand_type').default('primary'), // 'primary' or 'sub_account'
  
  // Branding assets
  logoUrl: text('logo_url'),
  brandbookUrl: text('brandbook_url'), // URL to uploaded brandbook PDF
  websiteUrl: text('website_url'), // Original website for reference
  primaryColor: text('primary_color').default('#FFC107'),
  secondaryColor: text('secondary_color').default('#FF6F00'),
  
  // Google Drive folder configuration
  briefFolderId: text('brief_folder_id'),
  productImagesFolderId: text('product_images_folder_id'),
  editedResultsFolderId: text('edited_results_folder_id'),
  
  // Default prompts and settings
  defaultPromptTemplate: text('default_prompt_template'),
  aiSettings: jsonb('ai_settings'),
  
  // API keys (encrypted in production)
  wavespeedApiKey: text('wavespeed_api_key'),
  openaiApiKey: text('openai_api_key'),
  
  // Brand-specific authentication (separate from admin)
  authPassword: text('auth_password'), // Hashed password for brand login
  
  // CRM Features - User Management
  seatsPurchased: integer('seats_purchased').default(1), // How many users allowed
  seatsUsed: integer('seats_used').default(0), // How many users currently active
  
  // CRM Features - Workflow Customization
  workflowConfig: jsonb('workflow_config'), // JSON schema for UI workflow customization
  
  // CRM Features - Usage Limits & Tracking
  monthlyJobLimit: integer('monthly_job_limit').default(100),
  monthlyImageLimit: integer('monthly_image_limit').default(1000),
  
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Users table - people who access the system
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'), // 'admin', 'brand_admin', 'user'
  brandId: integer('brand_id').references(() => brands.id),
  
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at')
});

// Jobs table - processing jobs with brand isolation
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  jobId: text('job_id').notNull().unique(),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  userId: integer('user_id').references(() => users.id),
  
  // Job data
  status: text('status').notNull().default('pending'),
  briefText: text('brief_text'),
  briefFileId: text('brief_file_id'),
  
  // Processing metadata
  imageSpecs: jsonb('image_specs'),
  workflowSteps: jsonb('workflow_steps'),
  
  // Time tracking
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  processingTimeSeconds: integer('processing_time_seconds'),
  estimatedManualTimeMinutes: integer('estimated_manual_time_minutes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Images table - stores original and edited images
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  
  // Original image
  originalName: text('original_name').notNull(),
  originalDriveId: text('original_drive_id').notNull(),
  originalPublicUrl: text('original_public_url'),
  
  // Edited image
  editedName: text('edited_name'),
  editedDriveId: text('edited_drive_id'),
  editedPublicUrl: text('edited_public_url'),
  
  // Metadata
  promptUsed: text('prompt_used'),
  title: text('title'),
  subtitle: text('subtitle'),
  
  createdAt: timestamp('created_at').defaultNow()
});

// Edited Images table - stores AI-edited versions
export const editedImages = pgTable('edited_images', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  imageId: integer('image_id').notNull().references(() => images.id),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  
  editedDriveId: text('edited_drive_id').notNull(),
  editedPublicUrl: text('edited_public_url'),
  promptUsed: text('prompt_used'),
  promptVersionId: integer('prompt_version_id').references(() => promptVersions.id),
  
  processingTimeMs: integer('processing_time_ms'),
  
  createdAt: timestamp('created_at').defaultNow()
});

// Feedback table - user ratings and improvement tracking
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  editedImageId: integer('edited_image_id').references(() => editedImages.id),
  
  rating: integer('rating').notNull(), // 1-5 stars
  feedbackText: text('feedback_text'),
  improvementSuggestions: text('improvement_suggestions'),
  
  // Detailed metrics
  goalAlignment: integer('goal_alignment'), // 1-5 rating
  creativityScore: integer('creativity_score'), // 1-5 rating
  technicalQuality: integer('technical_quality'), // 1-5 rating
  
  createdAt: timestamp('created_at').defaultNow()
});

// Subaccount Users - multi-user management per subaccount
export const subaccountUsers = pgTable('subaccount_users', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  
  // Role-based access control
  role: text('role').notNull().default('member'), // 'owner', 'admin', 'member', 'viewer'
  
  // Invitation system
  invitationToken: text('invitation_token'),
  invitedBy: integer('invited_by').references(() => subaccountUsers.id),
  invitedAt: timestamp('invited_at'),
  acceptedAt: timestamp('accepted_at'),
  
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at')
});

// Subaccount Prompts - template library per subaccount
export const subaccountPrompts = pgTable('subaccount_prompts', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // 'product', 'lifestyle', 'social', 'email', etc.
  
  // Current active version
  activeVersionId: integer('active_version_id'),
  
  // Metadata
  createdBy: integer('created_by').references(() => subaccountUsers.id),
  isDefault: boolean('is_default').default(false),
  
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Prompt Versions - version history for prompts
export const promptVersions = pgTable('prompt_versions', {
  id: serial('id').primaryKey(),
  promptId: integer('prompt_id').notNull().references(() => subaccountPrompts.id),
  
  versionNumber: integer('version_number').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  aiSettings: jsonb('ai_settings'), // Model, temperature, etc.
  
  // Performance tracking
  usageCount: integer('usage_count').default(0),
  averageRating: integer('average_rating'),
  
  // Status
  status: text('status').notNull().default('draft'), // 'draft', 'active', 'deprecated'
  
  createdBy: integer('created_by').references(() => subaccountUsers.id),
  createdAt: timestamp('created_at').defaultNow(),
  activatedAt: timestamp('activated_at')
});

// Subaccount Usage Daily - analytics and usage tracking
export const subaccountUsageDaily = pgTable('subaccount_usage_daily', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id),
  date: timestamp('date').notNull(),
  
  // Job metrics
  jobsCreated: integer('jobs_created').default(0),
  jobsCompleted: integer('jobs_completed').default(0),
  jobsFailed: integer('jobs_failed').default(0),
  
  // Image metrics
  imagesUploaded: integer('images_uploaded').default(0),
  imagesProcessed: integer('images_processed').default(0),
  
  // API usage
  wavespeedApiCalls: integer('wavespeed_api_calls').default(0),
  openaiApiCalls: integer('openai_api_calls').default(0),
  
  // Cost tracking (in cents)
  estimatedCostCents: integer('estimated_cost_cents').default(0),
  
  // Time metrics
  totalProcessingSeconds: integer('total_processing_seconds').default(0),
  totalTimeSavedSeconds: integer('total_time_saved_seconds').default(0),
  
  createdAt: timestamp('created_at').defaultNow()
});

// Relations
export const brandsRelations = relations(brands, ({ one, many }) => ({
  users: many(users),
  jobs: many(jobs),
  images: many(images),
  editedImages: many(editedImages),
  feedback: many(feedback),
  subaccountUsers: many(subaccountUsers),
  subaccountPrompts: many(subaccountPrompts),
  usageDaily: many(subaccountUsageDaily),
  parentBrand: one(brands, {
    fields: [brands.parentBrandId],
    references: [brands.id],
    relationName: 'subBrands'
  }),
  subBrands: many(brands, {
    relationName: 'subBrands'
  })
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  brand: one(brands, {
    fields: [users.brandId],
    references: [brands.id]
  }),
  jobs: many(jobs)
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  brand: one(brands, {
    fields: [jobs.brandId],
    references: [brands.id]
  }),
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id]
  }),
  images: many(images),
  editedImages: many(editedImages),
  feedback: many(feedback)
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  job: one(jobs, {
    fields: [images.jobId],
    references: [jobs.id]
  }),
  brand: one(brands, {
    fields: [images.brandId],
    references: [brands.id]
  }),
  editedImages: many(editedImages)
}));

export const editedImagesRelations = relations(editedImages, ({ one, many }) => ({
  job: one(jobs, {
    fields: [editedImages.jobId],
    references: [jobs.id]
  }),
  image: one(images, {
    fields: [editedImages.imageId],
    references: [images.id]
  }),
  brand: one(brands, {
    fields: [editedImages.brandId],
    references: [brands.id]
  }),
  promptVersion: one(promptVersions, {
    fields: [editedImages.promptVersionId],
    references: [promptVersions.id]
  }),
  feedback: many(feedback)
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  job: one(jobs, {
    fields: [feedback.jobId],
    references: [jobs.id]
  }),
  brand: one(brands, {
    fields: [feedback.brandId],
    references: [brands.id]
  }),
  editedImage: one(editedImages, {
    fields: [feedback.editedImageId],
    references: [editedImages.id]
  })
}));

export const subaccountUsersRelations = relations(subaccountUsers, ({ one, many }) => ({
  brand: one(brands, {
    fields: [subaccountUsers.brandId],
    references: [brands.id]
  }),
  inviter: one(subaccountUsers, {
    fields: [subaccountUsers.invitedBy],
    references: [subaccountUsers.id]
  }),
  createdPrompts: many(subaccountPrompts),
  createdVersions: many(promptVersions)
}));

export const subaccountPromptsRelations = relations(subaccountPrompts, ({ one, many }) => ({
  brand: one(brands, {
    fields: [subaccountPrompts.brandId],
    references: [brands.id]
  }),
  creator: one(subaccountUsers, {
    fields: [subaccountPrompts.createdBy],
    references: [subaccountUsers.id]
  }),
  activeVersion: one(promptVersions, {
    fields: [subaccountPrompts.activeVersionId],
    references: [promptVersions.id]
  }),
  versions: many(promptVersions)
}));

export const promptVersionsRelations = relations(promptVersions, ({ one, many }) => ({
  prompt: one(subaccountPrompts, {
    fields: [promptVersions.promptId],
    references: [subaccountPrompts.id]
  }),
  creator: one(subaccountUsers, {
    fields: [promptVersions.createdBy],
    references: [subaccountUsers.id]
  }),
  editedImages: many(editedImages)
}));

export const subaccountUsageDailyRelations = relations(subaccountUsageDaily, ({ one }) => ({
  brand: one(brands, {
    fields: [subaccountUsageDaily.brandId],
    references: [brands.id]
  })
}));

// Types are inferred automatically in JavaScript via Drizzle ORM
