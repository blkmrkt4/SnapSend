import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
export const devices = sqliteTable("devices", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    uuid: text("uuid"),
    socketId: text("socket_id").unique(),
    isOnline: integer("is_online", { mode: "boolean" }).default(false),
    lastSeen: text("last_seen").default(sql `(datetime('now'))`),
    createdAt: text("created_at").default(sql `(datetime('now'))`),
});
export const connections = sqliteTable("connections", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceAId: integer("device_a_id").references(() => devices.id).notNull(),
    deviceBId: integer("device_b_id").references(() => devices.id).notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").default(sql `(datetime('now'))`),
    terminatedAt: text("terminated_at"),
});
// User's tag vocabulary - tags that exist independently of files
export const tags = sqliteTable("tags", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    createdAt: text("created_at").default(sql `(datetime('now'))`),
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
    transferredAt: text("transferred_at").default(sql `(datetime('now'))`),
    // P2P fields (used when devices are identified by name instead of DB ID)
    fromDeviceName: text("from_device_name"),
    toDeviceName: text("to_device_name"),
    // Metadata & tagging fields
    tags: text("tags"), // JSON array: '["work", "urgent", "q1-reports"]'
    metadata: text("metadata"), // JSON object: '{"width": 1920, "height": 1080}'
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
// Chunked transfer constants
export const CHUNK_THRESHOLD = 70 * 1024 * 1024; // 70MB - files larger than this use chunked transfer
export const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB raw data per chunk
