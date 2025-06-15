import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function seedDatabase() {
  try {
    console.log("Seeding database with initial users...");

    // Check if users already exist
    const existingUser1 = await storage.getUserByEmail("blkmrkt.runner@gmail.com");
    const existingUser2 = await storage.getUserByEmail("robin.hutchinson@uk.ey.com");

    if (!existingUser1) {
      const hashedPassword1 = await hashPassword("1234");
      await storage.createUser({
        email: "blkmrkt.runner@gmail.com",
        name: "Robin Hutchinson",
        nickname: "Robin",
        password: hashedPassword1,
        isActive: true,
      });
      console.log("Created user: blkmrkt.runner@gmail.com");
    } else {
      console.log("User blkmrkt.runner@gmail.com already exists");
    }

    if (!existingUser2) {
      const hashedPassword2 = await hashPassword("1234");
      await storage.createUser({
        email: "robin.hutchinson@uk.ey.com",
        name: "Robin Hutchinson",
        nickname: "EYRobin",
        password: hashedPassword2,
        isActive: true,
      });
      console.log("Created user: robin.hutchinson@uk.ey.com");
    } else {
      console.log("User robin.hutchinson@uk.ey.com already exists");
    }

    console.log("Database seeding completed");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}