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
import { eq, like, or, desc, and, ilike } from "drizzle-orm";

export interface IStorage {
  // Device management
  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceBySocketId(socketId: string): Promise<Device | undefined>;
  getDeviceByNickname(nickname: string): Promise<Device | undefined>;
  updateDeviceLastSeen(socketId: string): Promise<void>;
  updateDeviceOnlineStatus(socketId: string, isOnline: boolean): Promise<void>;
  removeDevice(socketId: string): Promise<void>;
  getAllDevices(): Promise<Device[]>;
  getOnlineDevices(): Promise<Device[]>;
  searchDevicesByNickname(query: string): Promise<Device[]>;

  // Connection management
  createConnection(connection: InsertConnection): Promise<Connection>;
  getConnection(id: number): Promise<Connection | undefined>;
  getConnectionsByDevice(deviceId: number): Promise<Connection[]>;
  getActiveConnectionsForDevice(deviceId: number): Promise<Connection[]>;
  updateConnectionStatus(id: number, status: string, approvedAt?: Date): Promise<void>;
  terminateConnection(id: number): Promise<void>;
  getPendingConnectionRequests(targetDeviceId: number): Promise<Connection[]>;

  // File management
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  getFileByFilename(filename: string): Promise<File | undefined>;
  getFilesByDevice(deviceId: number): Promise<File[]>;
  getFilesByConnection(connectionId: number): Promise<File[]>;
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

  async getDeviceByNickname(nickname: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.nickname, nickname));
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
      .set({ lastSeen: new Date() })
      .where(eq(devices.socketId, socketId));
  }

  async updateDeviceOnlineStatus(socketId: string, isOnline: boolean): Promise<void> {
    await db
      .update(devices)
      .set({ isOnline, lastSeen: new Date() })
      .where(eq(devices.socketId, socketId));
  }

  async removeDevice(socketId: string): Promise<void> {
    await db
      .update(devices)
      .set({ isOnline: false })
      .where(eq(devices.socketId, socketId));
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }

  async getOnlineDevices(): Promise<Device[]> {
    return await db.select().from(devices).where(eq(devices.isOnline, true));
  }

  async searchDevicesByNickname(query: string): Promise<Device[]> {
    // Get only the most recent device for each nickname that's online
    const results = await db
      .select()
      .from(devices)
      .where(and(
        ilike(devices.nickname, `%${query}%`),
        eq(devices.isOnline, true)
      ))
      .orderBy(desc(devices.lastSeen));
    
    // Remove duplicates by nickname, keeping only the most recent
    const uniqueDevices = new Map<string, typeof results[0]>();
    for (const device of results) {
      if (!uniqueDevices.has(device.nickname)) {
        uniqueDevices.set(device.nickname, device);
      }
    }
    
    return Array.from(uniqueDevices.values());
  }

  // Connection management methods
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
        eq(connections.requesterDeviceId, deviceId),
        eq(connections.targetDeviceId, deviceId)
      ));
  }

  async getActiveConnectionsForDevice(deviceId: number): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(and(
        or(
          eq(connections.requesterDeviceId, deviceId),
          eq(connections.targetDeviceId, deviceId)
        ),
        eq(connections.status, 'active')
      ));
  }

  async updateConnectionStatus(id: number, status: string, approvedAt?: Date): Promise<void> {
    const updateData: any = { status };
    if (approvedAt) {
      updateData.approvedAt = approvedAt;
    }
    
    await db
      .update(connections)
      .set(updateData)
      .where(eq(connections.id, id));
  }

  async terminateConnection(id: number): Promise<void> {
    await db
      .update(connections)
      .set({ 
        status: 'terminated',
        terminatedAt: new Date()
      })
      .where(eq(connections.id, id));
  }

  async getPendingConnectionRequests(targetDeviceId: number): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(and(
        eq(connections.targetDeviceId, targetDeviceId),
        eq(connections.status, 'pending')
      ));
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

  async getFilesByConnection(connectionId: number): Promise<File[]> {
    return await db.select().from(files).where(eq(files.connectionId, connectionId));
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
