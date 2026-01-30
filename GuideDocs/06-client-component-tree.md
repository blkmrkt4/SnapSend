# SnapSend - Client Component Tree & State Management

## React Component Hierarchy

```mermaid
graph TD
    Main["main.tsx<br/>ReactDOM.createRoot()"] --> App

    App["App.tsx"] --> QCP["QueryClientProvider"]
    QCP --> AuthProv["AuthProvider<br/>(useAuth context)"]
    AuthProv --> TTP["TooltipProvider"]
    TTP --> Toaster["Toaster"]
    TTP --> Router["Router (wouter Switch)"]

    Router --> LandingPage["/ LandingPage"]
    Router --> AuthPage["/auth AuthPage"]
    Router --> ProtectedRoute["/app ProtectedRoute"]
    Router --> NotFound["* NotFound"]

    ProtectedRoute --> Home["Home.tsx"]

    Home --> DeviceSetup["DeviceSetup<br/>(if !isSetup)"]
    Home --> MainLayout["Main Layout<br/>(if isSetup)"]

    MainLayout --> SidebarComp["Sidebar"]
    MainLayout --> ContentArea["Content Area"]

    ContentArea --> ConnView["ConnectionManager"]
    ContentArea --> FileView["FileExplorer"]
    ContentArea --> SettingsView["SettingsPage"]

    ConnView --> SearchInput["Search Input"]
    ConnView --> SearchResults["Search Results List"]
    ConnView --> PendingReqs["Pending Requests"]
    ConnView --> OutgoingReqs["Outgoing Requests"]
    ConnView --> ActiveConns["Active Connections"]

    FileView --> FileList["File List<br/>(sort/filter)"]
    FileView --> FileActions["Preview / Download / Delete"]
    FileView --> FilePreview["FilePreviewModal"]
    FileView --> DropWindow["MinimalDropWindow<br/>(drag & drop upload)"]

    SidebarComp --> UserMenu["User Menu"]
    SidebarComp --> NavItems["Navigation Items"]
    SidebarComp --> NotifBadge["Notification Badge"]

    Home --> NotifWindow["NotificationWindow"]
```

## Provider & Context Architecture

```mermaid
graph TD
    subgraph "Context Providers (Outer → Inner)"
        QC["QueryClientProvider<br/>React Query cache"]
        QC --> AP["AuthProvider<br/>User auth state"]
        AP --> TP["TooltipProvider<br/>Radix tooltips"]
    end

    subgraph "AuthContext provides:"
        User["user: User | null"]
        Loading["isLoading: boolean"]
        LoginMut["loginMutation"]
        RegMut["registerMutation"]
        LogoutMut["logoutMutation"]
    end

    AP --> User
    AP --> Loading
    AP --> LoginMut
    AP --> RegMut
    AP --> LogoutMut
```

## useConnectionSystem State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected

    state Disconnected {
        [*] --> WSConnecting: useEffect calls connect()
    }

    WSConnecting --> SetupRequired: Receive "setup-required"

    state SetupRequired {
        [*] --> WaitingForSetup: isSetup=false
    }

    WaitingForSetup --> SettingUp: setupDevice(nickname, userId)
    SettingUp --> Ready: Receive "setup-complete"

    state Ready {
        [*] --> Idle: isSetup=true, currentDevice set
        Idle --> Searching: searchUsers(query)
        Searching --> Idle: Receive "scan-results"

        Idle --> Connecting: requestConnection(target)
        Connecting --> Connected: Receive "connection-approved"
        Connecting --> Idle: Receive "connection-rejected"

        Connected --> Idle: Receive "connection-terminated"
    }

    Ready --> Disconnected: WebSocket closes
    note right of Disconnected: Auto-reconnect after 3s
```

## useConnectionSystem - Full State Shape

```mermaid
graph LR
    subgraph "ConnectionSystemState"
        isSetup["isSetup: boolean"]
        isConnecting["isConnecting: boolean"]
        currentDevice["currentDevice: Device | null"]
        connections["connections: Connection[]"]
        files["files: ExtendedFile[]"]
        notifications["notifications: Notification[]"]
        searchResults["searchResults: Device[]"]
        pendingRequests["pendingRequests: Request[]"]
        outgoingRequests["outgoingRequests: Request[]"]
        isSearching["isSearching: boolean"]
    end

    subgraph "Returned Actions"
        setupDevice["setupDevice(nickname, userId)"]
        searchUsers["searchUsers(query)"]
        requestConnection["requestConnection(target)"]
        respondToConnection["respondToConnection(id, approved)"]
        terminateConnection["terminateConnection(id)"]
        sendFile["sendFile(fileData)"]
        submitVerificationKey["submitVerificationKey(id, key)"]
        dismissNotification["dismissNotification(id)"]
        clearAllNotifications["clearAllNotifications()"]
        clearAllFiles["clearAllFiles()"]
        refreshFiles["refreshFiles()"]
        deleteFile["deleteFile(id)"]
    end
```

## WebSocket Message → State Update Map

```mermaid
flowchart TD
    subgraph "Incoming Messages"
        M1["setup-required"]
        M2["setup-complete"]
        M3["scan-results"]
        M4["connection-request"]
        M5["connection-request-sent"]
        M6["connection-approved"]
        M7["connection-rejected"]
        M8["connection-terminated"]
        M9["file-received"]
        M10["clipboard-sync"]
        M11["file-sent-confirmation"]
        M12["error"]
    end

    subgraph "State Updates"
        S1["isSetup=false, isConnecting=false"]
        S2["isSetup=true, currentDevice=device"]
        S3["searchResults=users, isSearching=false"]
        S4["pendingRequests += request"]
        S5["outgoingRequests += request,<br/>notifications += 'sent'"]
        S6["connections += connection,<br/>clear pending/outgoing,<br/>notifications += 'approved'"]
        S7["clear pending/outgoing,<br/>notifications += 'rejected'"]
        S8["connections -= id,<br/>notifications += 'terminated'"]
        S9["files += file (received),<br/>notifications += 'file received'"]
        S10["navigator.clipboard.writeText()"]
        S11["files += file (sent),<br/>notifications += 'file sent'"]
        S12["notifications += error"]
    end

    M1 --> S1
    M2 --> S2
    M3 --> S3
    M4 --> S4
    M5 --> S5
    M6 --> S6
    M7 --> S7
    M8 --> S8
    M9 --> S9
    M10 --> S10
    M11 --> S11
    M12 --> S12
```

## Page Navigation Flow

```mermaid
flowchart TD
    Landing["/ Landing Page"] -->|"Get Started / Login"| Auth
    Auth["/auth Auth Page"] -->|"Login success"| AppPage
    Auth -->|"Register success"| AppPage
    AppPage["/app Home Dashboard"] -->|"Logout"| Landing

    subgraph "Home Dashboard Sections"
        direction LR
        Connections["Connections Tab"]
        Files["Files Tab"]
        Settings["Settings Tab"]
    end

    AppPage --> Connections
    AppPage --> Files
    AppPage --> Settings
```
