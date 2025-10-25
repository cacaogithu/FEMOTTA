import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Brands table - each brand (Corsair, Nike, etc.) gets its own configuration
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull().unique(),
  
  // Branding assets
  logoUrl: text('logo_url'),
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

// Relations
export const brandsRelations = relations(brands, ({ many }) => ({
  users: many(users),
  jobs: many(jobs),
  images: many(images)
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
  images: many(images)
}));

export const imagesRelations = relations(images, ({ one }) => ({
  job: one(jobs, {
    fields: [images.jobId],
    references: [jobs.id]
  }),
  brand: one(brands, {
    fields: [images.brandId],
    references: [brands.id]
  })
}));

// Types are inferred automatically in JavaScript via Drizzle ORM
