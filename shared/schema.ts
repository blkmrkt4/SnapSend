import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  socketId: text("socket_id").notNull().unique(),
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  content: text("content"), // For text/clipboard content
  fromDeviceId: integer("from_device_id").references(() => devices.id),
  toDeviceId: integer("to_device_id").references(() => devices.id),
  transferredAt: timestamp("transferred_at").defaultNow(),
  isClipboard: integer("is_clipboard").default(0),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  lastSeen: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  transferredAt: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// WebSocket message types
export interface WebSocketMessage {
  type: 'device-connected' | 'device-disconnected' | 'file-received' | 'clipboard-sync';
  data?: any;
}

export interface FileTransferMessage {
  type: 'file-transfer';
  data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    content?: string;
    isClipboard?: boolean;
    fromDevice: string;
  };
}
