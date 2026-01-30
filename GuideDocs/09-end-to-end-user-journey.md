# SnapSend - End-to-End User Journey

## Complete User Flow: Registration to File Transfer

```mermaid
flowchart TD
    Start["User visits SnapSend"] --> LandingPage["Landing Page (/)"]

    LandingPage -->|"Click 'Get Started'"| AuthPage["/auth Page"]

    AuthPage --> RegisterTab["Register Tab"]
    AuthPage --> LoginTab["Login Tab"]

    RegisterTab -->|"Fill form & submit"| Register["POST /api/register"]
    LoginTab -->|"Fill form & submit"| Login["POST /api/login"]

    Register --> Dashboard
    Login --> Dashboard

    Dashboard["/app Dashboard"] --> WSConnect["WebSocket connects to /ws"]
    WSConnect --> SetupRequired["Receive: setup-required"]
    SetupRequired --> AutoSetup["Auto device-setup<br/>(user's nickname + userId)"]
    AutoSetup --> SetupComplete["Receive: setup-complete<br/>Device registered & online"]

    SetupComplete --> MainUI["Main Dashboard Ready"]

    MainUI --> ConnectionsTab["Connections Tab"]
    MainUI --> FilesTab["Files Tab"]
    MainUI --> SettingsTab["Settings Tab"]
```

## Two-Device Connection Scenario

```mermaid
sequenceDiagram
    actor Alice as Alice (Device A)
    participant Server as SnapSend Server
    actor Bob as Bob (Device B)

    Note over Alice,Bob: Both users are logged in and have<br/>completed device setup

    Alice->>Server: scan-users: "Bob"
    Server-->>Alice: scan-results: [{Bob's device}]

    Alice->>Server: connection-request:<br/>{targetNickname: "Bob"}
    Server->>Server: Generate key: "47"
    Server-->>Bob: connection-request:<br/>{requesterNickname: "Alice",<br/>connectionKey: "47"}
    Server-->>Alice: connection-request-sent:<br/>{connectionId: 1}

    Note over Alice: Alice sees:<br/>"Waiting for verification key"
    Note over Bob: Bob sees:<br/>"Alice wants to connect"<br/>Key shown: 47

    Bob->>Server: connection-response:<br/>{connectionId: 1, approved: true}

    Note over Alice,Bob: Bob tells Alice the key<br/>verbally or via another channel

    Alice->>Server: submit-verification-key:<br/>{connectionId: 1, key: "47"}
    Server->>Server: Verify key matches
    Server-->>Alice: connection-approved
    Server-->>Bob: connection-approved

    Note over Alice,Bob: Connection is now ACTIVE

    Alice->>Server: file-transfer:<br/>{file data...}
    Server-->>Bob: file-received:<br/>{file, fromDevice: "Alice"}
    Server-->>Alice: file-sent-confirmation

    Note over Alice,Bob: File successfully transferred!

    Bob->>Server: terminate-connection
    Server-->>Alice: connection-terminated
    Server-->>Bob: connection-terminated
```

## Settings Page Flow

```mermaid
flowchart TD
    Settings["Settings Page"] --> ProfileSection["Profile Settings"]
    Settings --> DeviceSection["Device Settings"]
    Settings --> LogoutSection["Logout"]

    ProfileSection --> EditName["Edit Name"]
    ProfileSection --> EditEmail["Edit Email"]
    ProfileSection --> EditNickname["Edit Nickname"]
    ProfileSection --> SaveProfile["PUT /api/user/update"]

    ProfileSection --> ChangePassword["Change Password"]
    ChangePassword --> EnterCurrent["Enter current password"]
    EnterCurrent --> EnterNew["Enter new password"]
    EnterNew --> SavePassword["PUT /api/user/change-password"]

    DeviceSection --> ViewDevice["View device nickname"]

    LogoutSection --> ConfirmLogout["Logout button"]
    ConfirmLogout --> PostLogout["POST /api/logout"]
    PostLogout --> ClearState["Clear query cache"]
    ClearState --> Redirect["Redirect to /"]
```

## File Explorer User Flow

```mermaid
flowchart TD
    FileExplorer["File Explorer Tab"] --> ViewFiles["View all files<br/>(sent & received)"]

    ViewFiles --> Sort["Sort by:<br/>date, name, size"]
    ViewFiles --> Filter["Filter by:<br/>type, direction"]

    ViewFiles --> SelectFile["Select a file"]
    SelectFile --> Preview["Preview Modal"]
    SelectFile --> Download["Download file<br/>GET /api/files/:id/download"]
    SelectFile --> Delete["Delete file<br/>DELETE /api/files/:id"]

    FileExplorer --> DragDrop["Drag & Drop Area<br/>(MinimalDropWindow)"]
    DragDrop --> ReadFile["Read file content"]
    ReadFile --> SendViaWS["Send via WebSocket<br/>file-transfer message"]

    FileExplorer --> PasteClipboard["Paste Clipboard"]
    PasteClipboard --> SendClip["Send via WebSocket<br/>isClipboard: true"]
```

## Notification Lifecycle

```mermaid
flowchart TD
    Event["Event Occurs"] --> CreateNotif["Add to notifications[]"]

    subgraph "Notification Sources"
        ConnSent["Connection request sent"]
        ConnApproved["Connection approved"]
        ConnRejected["Connection rejected"]
        ConnTerminated["Connection terminated"]
        FileReceived["File received"]
        FileSent["File sent"]
        FileDeleted["File deleted"]
        WSError["WebSocket error"]
    end

    ConnSent --> CreateNotif
    ConnApproved --> CreateNotif
    ConnRejected --> CreateNotif
    ConnTerminated --> CreateNotif
    FileReceived --> CreateNotif
    FileSent --> CreateNotif
    FileDeleted --> CreateNotif
    WSError --> CreateNotif

    CreateNotif --> Display["NotificationWindow<br/>displays notification"]
    Display --> Dismiss["User dismisses<br/>dismissNotification(id)"]
    Display --> ClearAll["User clears all<br/>clearAllNotifications()"]
```
