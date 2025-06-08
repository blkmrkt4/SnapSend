import { devices, files, type Device, type File, type InsertDevice, type InsertFile } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private devices: Map<number, Device>;
  private files: Map<number, File>;
  private currentDeviceId: number;
  private currentFileId: number;

  constructor() {
    this.devices = new Map();
    this.files = new Map();
    this.currentDeviceId = 1;
    this.currentFileId = 1;
  }

  // Device management
  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const id = this.currentDeviceId++;
    const device: Device = {
      ...insertDevice,
      id,
      lastSeen: new Date(),
    };
    this.devices.set(id, device);
    return device;
  }

  async getDevice(id: number): Promise<Device | undefined> {
    return this.devices.get(id);
  }

  async getDeviceBySocketId(socketId: string): Promise<Device | undefined> {
    return Array.from(this.devices.values()).find(
      (device) => device.socketId === socketId,
    );
  }

  async updateDeviceLastSeen(socketId: string): Promise<void> {
    const device = await this.getDeviceBySocketId(socketId);
    if (device) {
      device.lastSeen = new Date();
      this.devices.set(device.id, device);
    }
  }

  async removeDevice(socketId: string): Promise<void> {
    const device = await this.getDeviceBySocketId(socketId);
    if (device) {
      this.devices.delete(device.id);
    }
  }

  async getAllDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  // File management
  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.currentFileId++;
    const file: File = {
      ...insertFile,
      id,
      transferredAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByDevice(deviceId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(
      (file) => file.toDeviceId === deviceId,
    );
  }

  async getAllFiles(): Promise<File[]> {
    return Array.from(this.files.values()).sort(
      (a, b) => (b.transferredAt?.getTime() || 0) - (a.transferredAt?.getTime() || 0)
    );
  }

  async deleteFile(id: number): Promise<void> {
    this.files.delete(id);
  }

  async searchFiles(query: string): Promise<File[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.files.values()).filter(
      (file) =>
        file.originalName.toLowerCase().includes(lowerQuery) ||
        (file.content && file.content.toLowerCase().includes(lowerQuery))
    );
  }
}

export const storage = new MemStorage();
