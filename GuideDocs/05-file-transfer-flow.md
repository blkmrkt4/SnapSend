# SnapSend - File Transfer & Upload System

## WebSocket File Transfer (Device-to-Device)

```mermaid
sequenceDiagram
    participant Sender as Sender Device
    participant WS as WebSocket Server
    participant Storage as DatabaseStorage
    participant DB as PostgreSQL
    participant Disk as File System<br/>(uploads/)
    participant Receiver as Receiver Device

    Sender->>WS: {type: "file-transfer",<br/>data: {filename, originalName,<br/>mimeType, size, content,<br/>isClipboard}}

    WS->>Storage: getActiveConnectionsForDevice(deviceId)
    Storage->>DB: SELECT connections WHERE active

    alt No Active Connections
        WS-->>Sender: {type: "error",<br/>data: "No active connections"}
    else Has Active Connections

        alt Not Clipboard & Has Content
            WS->>Disk: Save file to uploads/<br/>(base64, text, or binary)
        end

        loop For each active connection
            WS->>Storage: createFile({<br/>filename, originalName,<br/>mimeType, size, content,<br/>fromDeviceId, toDeviceId,<br/>connectionId, isClipboard})
            Storage->>DB: INSERT INTO files

            WS->>WS: Find partner WebSocket<br/>in connectedClients
            WS-->>Receiver: {type: "file-received",<br/>data: {file, fromDevice}}

            opt Is Clipboard Content
                WS-->>Receiver: {type: "clipboard-sync",<br/>data: {content, fromDevice, file}}
            end
        end

        WS->>Storage: createFile({<br/>...senderCopy,<br/>toDeviceId: null})
        Storage->>DB: INSERT INTO files (sender record)

        WS-->>Sender: {type: "file-sent-confirmation",<br/>data: {filename, recipientCount,<br/>isClipboard, file}}
    end
```

## HTTP File Upload

```mermaid
sequenceDiagram
    participant Client as Browser
    participant Multer as Multer Middleware<br/>(50MB limit, memory)
    participant API as POST /api/upload
    participant Disk as File System
    participant Storage as DatabaseStorage
    participant DB as PostgreSQL

    Client->>Multer: multipart/form-data<br/>{file, deviceId}
    Multer->>Multer: Buffer file in memory<br/>(max 50MB)
    Multer->>API: req.file + req.body

    API->>API: Validate file exists<br/>Validate deviceId exists

    API->>Disk: mkdir uploads/ (if needed)
    API->>Disk: Write: timestamp_originalname

    API->>Storage: createFile({<br/>filename, originalName,<br/>mimeType, size,<br/>fromDeviceId, toDeviceId: null,<br/>connectionId: null})
    Storage->>DB: INSERT INTO files
    DB-->>Storage: File row

    API-->>Client: File record JSON
```

## File Download

```mermaid
flowchart TD
    Request["GET /api/files/:id/download"] --> CheckFormat{"ID format?"}

    CheckFormat -->|"Numeric ≤ MAX_INT"| ByID["storage.getFile(id)"]
    CheckFormat -->|"Numeric > MAX_INT"| ByName["storage.getFileByFilename(id)"]
    CheckFormat -->|"Non-numeric"| ByName

    ByID --> Found{"File record<br/>found?"}
    ByName --> Found

    Found -->|"No"| NotFound["404: File not found"]
    Found -->|"Yes"| DiskCheck{"File exists<br/>on disk?"}

    DiskCheck -->|"No"| DiskNotFound["404: File not found on disk"]
    DiskCheck -->|"Yes"| Download["res.download(filePath, originalName)"]
```

## File Delete

```mermaid
flowchart TD
    Request["DELETE /api/files/:id"] --> GetFile["storage.getFile(id)"]
    GetFile --> Found{"File exists?"}

    Found -->|"No"| NotFound["404: File not found"]
    Found -->|"Yes"| DiskDelete{"File on disk?"}

    DiskDelete -->|"Yes"| Unlink["fs.unlinkSync(filePath)"]
    DiskDelete -->|"No"| Skip["Skip disk delete"]

    Unlink --> DBDelete["storage.deleteFile(id)"]
    Skip --> DBDelete
    DBDelete --> Success["200: {success: true}"]
```

## File Content Handling

```mermaid
flowchart TD
    Incoming["Incoming file content<br/>via WebSocket"] --> Type{"Content type?"}

    Type -->|"Starts with 'data:'"| Base64["Base64 encoded<br/>(images, binary)"]
    Base64 --> Split["Split at comma<br/>Get base64 data"]
    Split --> BufferB64["Buffer.from(data, 'base64')"]
    BufferB64 --> Write["fs.writeFileSync(path, buffer)"]

    Type -->|"mimeType starts<br/>with 'text/'"| Text["Plain text content"]
    Text --> WriteText["fs.writeFileSync(path, content, 'utf8')"]

    Type -->|"Other"| Binary["Other binary content"]
    Binary --> WriteBin["fs.writeFileSync(path, content)"]

    Type -->|"isClipboard: true"| Clipboard["Clipboard content"]
    Clipboard --> DBOnly["Store in DB only<br/>(content column)"]

    Write --> DBRecord["Also store in files table<br/>(content column)"]
    WriteText --> DBRecord
    WriteBin --> DBRecord
```

## Client-Side File Handling

```mermaid
flowchart TD
    subgraph "Sending Files"
        SelectFile["User selects file<br/>or pastes clipboard"] --> ReadFile["FileReader reads<br/>as base64/text"]
        ReadFile --> SendMsg["sendFile({<br/>filename, originalName,<br/>mimeType, size, content,<br/>isClipboard})"]
        SendMsg --> WSOut["WebSocket.send()"]
    end

    subgraph "Receiving Files"
        WSIn["WebSocket 'file-received'<br/>message"] --> AddToState["Add to files[] state<br/>with transferType: 'received'"]
        AddToState --> Notify["Push notification:<br/>'File received from X'"]

        WSClip["WebSocket 'clipboard-sync'<br/>message"] --> NavClip["navigator.clipboard<br/>.writeText(content)"]
    end

    subgraph "File Operations"
        Preview["FilePreviewModal<br/>displays content"] --> ContentCheck{"Has content<br/>in state?"}
        ContentCheck -->|"Yes"| Inline["Render inline<br/>(image, text)"]
        ContentCheck -->|"No"| FetchFile["Fetch from<br/>/api/files/:id/download"]

        Download["Download button"] --> DownloadAPI["GET /api/files/:id/download"]
        Delete["Delete button"] --> DeleteAPI["DELETE /api/files/:id"]
        DeleteAPI --> RemoveState["Remove from files[] state"]
    end
```

## Dual File Record Creation

```mermaid
graph TD
    Transfer["File sent via WebSocket"] --> ReceiverRecord["Receiver's File Record<br/>fromDeviceId: sender<br/>toDeviceId: receiver<br/>connectionId: active connection"]
    Transfer --> SenderRecord["Sender's File Record<br/>fromDeviceId: sender<br/>toDeviceId: null<br/>connectionId: null"]

    ReceiverRecord --> ReceiverSees["Receiver sees file<br/>transferType: 'received'"]
    SenderRecord --> SenderSees["Sender sees file<br/>transferType: 'sent'"]
```
