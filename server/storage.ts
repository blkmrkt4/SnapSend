import { devices, files, type Device, type File, type InsertDevice, type InsertFile } from "@shared/schema";
import { db } from "./db";
import { eq, like, or, desc } from "drizzle-orm";

export interface IStorage {
  // Device management
  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceBySocketId(socketId: string): Promise<Device | undefined>;
  updateDeviceLastSeen(socketId: string): Promise<void>;
  removeDevice(socketId: string): Promise<void>;
  getAllDevices(): Promise<Device[]>;

  // File management
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  getFilesByDevice(deviceId: number): Promise<File[]>;
  getAllFiles(): Promise<File[]>;
  deleteFile(id: number): Promise<void>;
  searchFiles(query: string): Promise<File[]>;
}

export class DatabaseStorage implements IStorage {
  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async getDeviceBySocketId(socketId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.socketId, socketId));
    return device || undefined;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values(insertDevice)
      .returning();
    return device;
  }

  async updateDeviceLastSeen(socketId: string): Promise<void> {
    await db
      .update(devices)
      .set({ lastSeen: new Date() })
      .where(eq(devices.socketId, socketId));
  }

  async removeDevice(socketId: string): Promise<void> {
    await db.delete(devices).where(eq(devices.socketId, socketId));
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db
      .insert(files)
      .values(insertFile)
      .returning();
    return file;
  }

  async getFile(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || undefined;
  }

  async getFilesByDevice(deviceId: number): Promise<File[]> {
    return await db.select().from(files).where(eq(files.toDeviceId, deviceId));
  }

  async getAllFiles(): Promise<File[]> {
    return await db.select().from(files).orderBy(desc(files.transferredAt));
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async searchFiles(query: string): Promise<File[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(files)
      .where(
        or(
          like(files.originalName, searchPattern),
          like(files.content, searchPattern)
        )
      )
      .orderBy(desc(files.transferredAt));
  }
}

export const storage = new DatabaseStorage();
