import { db } from '../db.js';
import { users, brands } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seedUser() {
  try {
    console.log('Starting user seed...');

    const [corsairBrand] = await db.select().from(brands).where(eq(brands.slug, 'corsair')).limit(1);
    
    if (!corsairBrand) {
      console.error('Corsair brand not found. Please seed brands first.');
      process.exit(1);
    }

    console.log('Found Corsair brand:', corsairBrand.name);

    const email = 'felippe.motta@corsair.com';
    const password = 'Corsair2025';
    const username = 'felippe.motta';

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser) {
      console.log('User already exists, updating password...');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await db.update(users)
        .set({ 
          passwordHash: hashedPassword,
          active: true,
          brandId: corsairBrand.id
        })
        .where(eq(users.email, email));
      
      console.log('User updated successfully!');
    } else {
      console.log('Creating new user...');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await db.insert(users).values({
        email: email,
        username: username,
        passwordHash: hashedPassword,
        role: 'user',
        brandId: corsairBrand.id,
        active: true
      });
      
      console.log('User created successfully!');
    }

    console.log('\n=== User Details ===');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Brand:', corsairBrand.name);
    console.log('==================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding user:', error);
    process.exit(1);
  }
}

seedUser();
