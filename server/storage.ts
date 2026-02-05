import {
  devices,
  files,
  connections,
  type Device,
  type File,
  type Connection,
  type InsertDevice,
  type InsertFile,
  type InsertConnection
} from "@shared/schema";
import { db } from "./db";
import { eq, like, or, desc, and, ne } from "drizzle-orm";

export interface IStorage {
  // Device management
  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceBySocketId(socketId: string): Promise<Device | undefined>;
  getDeviceByName(name: string): Promise<Device | undefined>;
  getDeviceByUUID(uuid: string): Promise<Device | undefined>;
  updateDeviceLastSeen(socketId: string): Promise<void>;
  updateDeviceOnlineStatus(socketId: string, isOnline: boolean): Promise<void>;
  reactivateDevice(id: number, socketId: string, name?: string): Promise<Device | undefined>;
  updateDeviceName(id: number, name: string): Promise<Device | undefined>;
  setDeviceOffline(socketId: string): Promise<void>;
  getAllDevices(): Promise<Device[]>;
  getOnlineDevices(): Promise<Device[]>;

  // Connection management
  createConnection(connection: InsertConnection): Promise<Connection>;
  getConnection(id: number): Promise<Connection | undefined>;
  getConnectionsByDevice(deviceId: number): Promise<Connection[]>;
  getActiveConnectionsForDevice(deviceId: number): Promise<Connection[]>;
  terminateConnection(id: number): Promise<void>;

  // File management
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  getFileByFilename(filename: string): Promise<File | undefined>;
  getFilesByDevice(deviceId: number): Promise<File[]>;
  getAllFiles(): Promise<File[]>;
  deleteFile(id: number): Promise<void>;
  renameFile(id: number, newOriginalName: string): Promise<File | undefined>;
  searchFiles(query: string): Promise<File[]>;
}

export class DatabaseStorage implements IStorage {
  // Device management
  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async getDeviceBySocketId(socketId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.socketId, socketId));
    return device || undefined;
  }

  async getDeviceByName(name: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.name, name));
    return device || undefined;
  }

  async getDeviceByUUID(uuid: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.uuid, uuid));
    return device || undefined;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values({ ...insertDevice, isOnline: true })
      .returning();
    return device;
  }

  async updateDeviceLastSeen(socketId: string): Promise<void> {
    await db
      .update(devices)
      .set({ lastSeen: new Date().toISOString() })
      .where(eq(devices.socketId, socketId));
  }

  async updateDeviceOnlineStatus(socketId: string, isOnline: boolean): Promise<void> {
    await db
      .update(devices)
      .set({ isOnline, lastSeen: new Date().toISOString() })
      .where(eq(devices.socketId, socketId));
  }

  async reactivateDevice(id: number, socketId: string, name?: string): Promise<Device | undefined> {
    // Clean up duplicate device rows with the same name (from old sessions)
    const [target] = await db.select().from(devices).where(eq(devices.id, id));
    if (target) {
      await db.delete(devices).where(
        and(eq(devices.name, target.name), ne(devices.id, id))
      );
    }

    const updates: Record<string, any> = { socketId, isOnline: true, lastSeen: new Date().toISOString() };
    if (name) {
      updates.name = name;
    }

    const [device] = await db
      .update(devices)
      .set(updates)
      .where(eq(devices.id, id))
      .returning();
    return device || undefined;
  }

  async updateDeviceName(id: number, name: string): Promise<Device | undefined> {
    const [device] = await db
      .update(devices)
      .set({ name, lastSeen: new Date().toISOString() })
      .where(eq(devices.id, id))
      .returning();
    return device || undefined;
  }

  async setDeviceOffline(socketId: string): Promise<void> {
    await db
      .update(devices)
      .set({ isOnline: false, socketId: null })
      .where(eq(devices.socketId, socketId));
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }

  async getOnlineDevices(): Promise<Device[]> {
    return await db.select().from(devices).where(eq(devices.isOnline, true));
  }

  // Connection management
  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const [connection] = await db
      .insert(connections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection || undefined;
  }

  async getConnectionsByDevice(deviceId: number): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(or(
        eq(connections.deviceAId, deviceId),
        eq(connections.deviceBId, deviceId)
      ));
  }

  async getActiveConnectionsForDevice(deviceId: number): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(and(
        or(
          eq(connections.deviceAId, deviceId),
          eq(connections.deviceBId, deviceId)
        ),
        eq(connections.status, 'active')
      ));
  }

  async terminateConnection(id: number): Promise<void> {
    await db
      .update(connections)
      .set({
        status: 'terminated',
        terminatedAt: new Date().toISOString()
      })
      .where(eq(connections.id, id));
  }

  // File management
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

  async getFileByFilename(filename: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.filename, filename));
    return file || undefined;
  }

  async getFilesByDevice(deviceId: number): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(or(
        eq(files.fromDeviceId, deviceId),
        eq(files.toDeviceId, deviceId)
      ))
      .orderBy(desc(files.transferredAt));
  }

  async getAllFiles(): Promise<File[]> {
    return await db.select().from(files).orderBy(desc(files.transferredAt));
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async renameFile(id: number, newOriginalName: string): Promise<File | undefined> {
    const [file] = await db
      .update(files)
      .set({ originalName: newOriginalName })
      .where(eq(files.id, id))
      .returning();
    return file || undefined;
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
