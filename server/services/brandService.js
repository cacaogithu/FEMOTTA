import { db } from '../db.js';
import { brands, users, jobs, images } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export class BrandService {
  async getBrandBySlug(slug) {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
    return brand;
  }

  async getBrandById(id) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async getAllActiveBrands() {
    return await db.select().from(brands).where(eq(brands.active, true));
  }

  async createBrand(brandData) {
    // Hash auth password if provided
    if (brandData.authPassword) {
      const saltRounds = 10;
      brandData.authPassword = await bcrypt.hash(brandData.authPassword, saltRounds);
    }

    const [brand] = await db.insert(brands).values({
      ...brandData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return brand;
  }

  async updateBrand(id, updates) {
    // Hash auth password if provided and changed
    if (updates.authPassword) {
      const saltRounds = 10;
      updates.authPassword = await bcrypt.hash(updates.authPassword, saltRounds);
    }

    const [brand] = await db.update(brands)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(brands.id, id))
      .returning();
    return brand;
  }
}

export class JobService {
  async createJob(jobData) {
    const [job] = await db.insert(jobs).values({
      ...jobData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return job;
  }

  async getJobByJobId(jobId) {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobId, jobId));
    return job;
  }

  async updateJob(jobId, updates) {
    const [job] = await db.update(jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobs.jobId, jobId))
      .returning();
    return job;
  }

  async getJobsByBrand(brandId, limit = 50) {
    return await db.select()
      .from(jobs)
      .where(eq(jobs.brandId, brandId))
      .limit(limit)
      .orderBy(jobs.createdAt);
  }
}

export class ImageService {
  async createImage(imageData) {
    const [image] = await db.insert(images).values({
      ...imageData,
      createdAt: new Date()
    }).returning();
    return image;
  }

  async getImagesByJob(jobId) {
    return await db.select().from(images).where(eq(images.jobId, jobId));
  }

  async updateImage(id, updates) {
    const [image] = await db.update(images)
      .set(updates)
      .where(eq(images.id, id))
      .returning();
    return image;
  }
}

export const brandService = new BrandService();
export const jobService = new JobService();
export const imageService = new ImageService();
