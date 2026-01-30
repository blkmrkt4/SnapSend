# SnapSend - WebSocket Protocol & Real-Time Communication

## WebSocket Lifecycle

```mermaid
sequenceDiagram
    participant Client as Browser Client
    participant WS as WebSocket Server (/ws)
    participant Storage as DatabaseStorage
    participant DB as PostgreSQL
    participant OtherClients as Other Connected Clients

    Client->>WS: Connect to /ws
    WS->>WS: Generate socketId<br/>(ws_timestamp_random)
    WS-->>Client: {type: "setup-required",<br/>data: {socketId}}

    Client->>WS: {type: "device-setup",<br/>data: {nickname, userId}}
    WS->>Storage: createDevice({userId, nickname, socketId})
    Storage->>DB: INSERT INTO devices (isOnline: true)
    DB-->>Storage: Device row
    WS->>WS: connectedClients.set(deviceId, ws)
    WS-->>Client: {type: "setup-complete",<br/>data: {device}}
    WS-->>OtherClients: {type: "device-connected",<br/>data: {device, totalDevices}}

    Note over Client,WS: Device is now ready for operations

    Client->>WS: Any message
    WS->>Storage: updateDeviceLastSeen(socketId)

    Note over Client,WS: On disconnect...

    Client-xWS: Connection closes
    WS->>Storage: updateDeviceOnlineStatus(socketId, false)
    WS->>WS: connectedClients.delete(clientId)
    WS-->>OtherClients: {type: "device-disconnected",<br/>data: {device, totalDevices}}
```

## Complete Message Type Reference

```mermaid
graph TD
    subgraph "Server → Client Messages"
        SR["setup-required"]
        SC["setup-complete"]
        SCANR["scan-results"]
        CR["connection-request"]
        CRS["connection-request-sent"]
        CA["connection-approved"]
        CRJ["connection-rejected"]
        CT["connection-terminated"]
        FR["file-received"]
        CS["clipboard-sync"]
        FSC["file-sent-confirmation"]
        DC["device-connected"]
        DD["device-disconnected"]
        ERR["error"]
    end

    subgraph "Client → Server Messages"
        DS["device-setup"]
        SU["scan-users"]
        CRQ["connection-request"]
        CRSP["connection-response"]
        SVK["submit-verification-key"]
        FT["file-transfer"]
        TC2["terminate-connection"]
    end
```

## Device Search Flow

```mermaid
sequenceDiagram
    participant Requester as Requester Device
    participant WS as WebSocket Server
    participant Storage as DatabaseStorage

    Requester->>WS: {type: "scan-users",<br/>data: {query: "robin"}}
    WS->>Storage: searchDevicesByNickname("robin")

    Note over Storage: Search online devices<br/>matching query (case-insensitive)<br/>Deduplicate by nickname<br/>Exclude requesting device

    Storage-->>WS: Device[]
    WS-->>Requester: {type: "scan-results",<br/>data: {users: [...]}}
```

## Connection Establishment (Full Handshake)

```mermaid
sequenceDiagram
    participant Requester as Requester Device
    participant WS as WebSocket Server
    participant Storage as DatabaseStorage
    participant Target as Target Device

    Note over Requester: User selects target<br/>from search results

    Requester->>WS: {type: "connection-request",<br/>data: {targetNickname: "EYRobin"}}

    WS->>WS: Find target in connectedClients
    WS->>WS: Generate 2-digit key<br/>(10-99 random)
    WS->>Storage: createConnection({<br/>requesterDeviceId,<br/>targetDeviceId,<br/>connectionKey,<br/>status: "pending"})

    WS-->>Target: {type: "connection-request",<br/>data: {requesterNickname,<br/>connectionKey, connectionId}}
    WS-->>Requester: {type: "connection-request-sent",<br/>data: {connectionId, connectionKey}}

    Note over Target: Target sees request with<br/>the 2-digit verification key
    Note over Requester: Requester sees "waiting<br/>for verification key"

    alt Target Approves
        Note over Target: Target tells requester<br/>the key verbally/other channel

        Target->>WS: {type: "connection-response",<br/>data: {connectionId, approved: true}}
        Note over WS: Server waits for<br/>key verification

        Requester->>WS: {type: "submit-verification-key",<br/>data: {connectionId,<br/>verificationKey: "42"}}

        WS->>Storage: getConnection(id)
        WS->>WS: Compare submitted key<br/>with stored connectionKey

        alt Key Matches
            WS->>Storage: updateConnectionStatus(id, "active")
            WS-->>Requester: {type: "connection-approved",<br/>data: {connectionId, partnerNickname}}
            WS-->>Target: {type: "connection-approved",<br/>data: {connectionId, partnerNickname}}
            Note over Requester,Target: Connection is now ACTIVE<br/>File transfer enabled
        else Key Mismatch
            WS-->>Requester: {type: "error",<br/>data: {message: "Invalid verification key"}}
        end

    else Target Rejects
        Target->>WS: {type: "connection-response",<br/>data: {connectionId, approved: false}}
        WS->>Storage: updateConnectionStatus(id, "rejected")
        WS-->>Requester: {type: "connection-rejected",<br/>data: {connectionId, rejectedBy}}
        WS-->>Target: {type: "connection-rejected",<br/>data: {connectionId, rejectedBy}}
    end
```

## Connection Termination

```mermaid
sequenceDiagram
    participant Initiator as Either Device
    participant WS as WebSocket Server
    participant Storage as DatabaseStorage
    participant Partner as Partner Device

    Initiator->>WS: {type: "terminate-connection",<br/>data: {connectionId}}
    WS->>Storage: getConnection(connectionId)
    WS->>WS: Verify initiator is part<br/>of this connection
    WS->>Storage: terminateConnection(id)<br/>status="terminated",<br/>terminatedAt=now()
    WS-->>Partner: {type: "connection-terminated",<br/>data: {connectionId, terminatedBy}}
    WS-->>Initiator: {type: "connection-terminated",<br/>data: {connectionId, terminatedBy}}
```

## Auto-Reconnect Logic (Client)

```mermaid
flowchart TD
    Start["WebSocket connects<br/>to /ws"] --> Open{"onopen"}
    Open --> Ready["Connection ready<br/>Clear reconnect timer"]

    Ready --> Close{"onclose fires"}
    Close --> Delay["Wait 3 seconds"]
    Delay --> Reconnect["Call connect() again"]
    Reconnect --> Start

    Ready --> Error{"onerror fires"}
    Error --> Notify["Add error notification<br/>to state"]
    Error --> Close
```

## Server-Side Client Management

```mermaid
graph TD
    subgraph "connectedClients Map"
        Map["Map&lt;string, WebSocket&gt;<br/>key: deviceId (string)<br/>value: WebSocket instance"]
    end

    Connect["New WS Connection"] -->|"After device-setup"| Set["connectedClients.set(<br/>deviceId, ws)"]
    Set --> Map

    Disconnect["WS Close Event"] --> Delete["connectedClients.delete(<br/>clientId)"]
    Delete --> Map

    Map --> Broadcast["broadcast(message, excludeId)<br/>Send to all except sender"]
    Map --> FindTarget["Find specific target<br/>by iterating entries"]
    Map --> GetSize["connectedClients.size<br/>for totalDevices count"]
```
