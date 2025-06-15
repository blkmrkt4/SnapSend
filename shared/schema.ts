import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  nickname: text("nickname").notNull(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  nickname: text("nickname").notNull(),
  socketId: text("socket_id").notNull().unique(),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  requesterDeviceId: integer("requester_device_id").references(() => devices.id).notNull(),
  targetDeviceId: integer("target_device_id").references(() => devices.id).notNull(),
  connectionKey: text("connection_key").notNull(), // 2-digit random key
  status: text("status").notNull().default("pending"), // pending, approved, rejected, active, terminated
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  terminatedAt: timestamp("terminated_at"),
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
  connectionId: integer("connection_id").references(() => connections.id),
  transferredAt: timestamp("transferred_at").defaultNow(),
  isClipboard: integer("is_clipboard").default(0),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  lastSeen: true,
  createdAt: true,
  isOnline: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  terminatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  transferredAt: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  requestedConnections: many(connections, { relationName: "requesterDevice" }),
  targetedConnections: many(connections, { relationName: "targetDevice" }),
  sentFiles: many(files, { relationName: "sentFiles" }),
  receivedFiles: many(files, { relationName: "receivedFiles" }),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  requesterDevice: one(devices, {
    fields: [connections.requesterDeviceId],
    references: [devices.id],
    relationName: "requesterDevice",
  }),
  targetDevice: one(devices, {
    fields: [connections.targetDeviceId],
    references: [devices.id],
    relationName: "targetDevice",
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  fromDevice: one(devices, {
    fields: [files.fromDeviceId],
    references: [devices.id],
    relationName: "sentFiles",
  }),
  toDevice: one(devices, {
    fields: [files.toDeviceId],
    references: [devices.id],
    relationName: "receivedFiles",
  }),
  connection: one(connections, {
    fields: [files.connectionId],
    references: [connections.id],
  }),
}));

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// WebSocket message types
export interface WebSocketMessage {
  type: 'device-connected' | 'device-disconnected' | 'file-received' | 'clipboard-sync' | 
        'connection-request' | 'connection-response' | 'connection-approved' | 'connection-terminated' |
        'scan-users' | 'scan-results' | 'file-sent-confirmation';
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
    connectionId: number;
  };
}

export interface ConnectionRequestMessage {
  type: 'connection-request';
  data: {
    requesterNickname: string;
    targetNickname: string;
    connectionKey: string;
    connectionId: number;
  };
}

export interface ScanUsersMessage {
  type: 'scan-users';
  data: {
    query: string;
  };
}
