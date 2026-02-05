import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  uuid: text("uuid"),
  socketId: text("socket_id").unique(),
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  lastSeen: text("last_seen").default(sql`(datetime('now'))`),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const connections = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceAId: integer("device_a_id").references(() => devices.id).notNull(),
  deviceBId: integer("device_b_id").references(() => devices.id).notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  terminatedAt: text("terminated_at"),
});

export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  content: text("content"),
  fromDeviceId: integer("from_device_id").references(() => devices.id),
  toDeviceId: integer("to_device_id").references(() => devices.id),
  connectionId: integer("connection_id").references(() => connections.id),
  isClipboard: integer("is_clipboard").default(0),
  transferredAt: text("transferred_at").default(sql`(datetime('now'))`),
  // P2P fields (used when devices are identified by name instead of DB ID)
  fromDeviceName: text("from_device_name"),
  toDeviceName: text("to_device_name"),
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
  terminatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  transferredAt: true,
});

// Relations
export const devicesRelations = relations(devices, ({ many }) => ({
  connectionsAsA: many(connections, { relationName: "deviceA" }),
  connectionsAsB: many(connections, { relationName: "deviceB" }),
  sentFiles: many(files, { relationName: "sentFiles" }),
  receivedFiles: many(files, { relationName: "receivedFiles" }),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  deviceA: one(devices, {
    fields: [connections.deviceAId],
    references: [devices.id],
    relationName: "deviceA",
  }),
  deviceB: one(devices, {
    fields: [connections.deviceBId],
    references: [devices.id],
    relationName: "deviceB",
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

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// WebSocket message types
export interface WebSocketMessage {
  type: 'device-connected' | 'device-disconnected' | 'device-list' |
        'file-received' | 'clipboard-sync' | 'file-sent-confirmation' |
        'pair-request' | 'pair-accepted' | 'auto-paired' |
        'connection-terminated' | 'setup-required' | 'setup-complete' | 'error' |
        // P2P message types
        'peer-handshake' | 'peer-handshake-ack' | 'file-received-ack';
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

export interface PeerHandshakeMessage {
  type: 'peer-handshake';
  data: {
    id: string;
    name: string;
  };
}

export interface PeerHandshakeAckMessage {
  type: 'peer-handshake-ack';
  data: {
    id: string;
    name: string;
  };
}

export interface P2PFileTransferMessage {
  type: 'file-transfer';
  data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    content?: string;
    isClipboard?: boolean;
    fromId: string;
    fromName: string;
  };
}
