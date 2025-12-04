import { users } from '../shared/schema.js';
import { db } from './db.js';
import { eq } from 'drizzle-orm';

export class DatabaseStorage {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(id)));
    return user;
  }

  async getUserByReplitId(replitId) {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData) {
    const existingUser = await this.getUserByReplitId(userData.replitId);
    
    const email = userData.email || `replit_${userData.replitId}@placeholder.local`;
    const username = userData.email?.split('@')[0] || `replit_user_${userData.replitId}`;
    
    if (existingUser) {
      const [user] = await db
        .update(users)
        .set({
          email: userData.email || existingUser.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.replitId, userData.replitId))
        .returning();
      return user;
    } else {
      const [user] = await db
        .insert(users)
        .values({
          replitId: userData.replitId,
          email: email,
          username: username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: 'user',
          active: true,
        })
        .returning();
      return user;
    }
  }

  async createLocalUser(userData) {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        username: userData.username,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        brandId: userData.brandId,
        active: true,
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
