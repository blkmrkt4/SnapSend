# SnapSend - Development Roadmap & Architecture Gaps

## Current State Overview

```mermaid
graph TD
    subgraph "Implemented"
        style Implemented fill:#d4edda
        Auth["Authentication<br/>(register, login, logout)"]
        WS["WebSocket Protocol<br/>(full message handling)"]
        DevMgmt["Device Management<br/>(setup, online status)"]
        ConnFlow["Connection Flow<br/>(request, verify, approve,<br/>reject, terminate)"]
        FileTransfer["File Transfer<br/>(WS + HTTP upload)"]
        FileOps["File Operations<br/>(preview, download, delete)"]
        ClipSync["Clipboard Sync"]
        UserSettings["User Profile Settings"]
        UIComponents["UI Components<br/>(shadcn/ui, 40+)"]
        LandingPg["Landing Page"]
    end

    subgraph "Not Yet Implemented"
        style NotImplemented fill:#f8d7da
        Payment["Payment Integration<br/>(plans shown in UI only)"]
        FileVersioning["File History &<br/>Versioning"]
        SSO["SSO Integration"]
        AdminControls["Admin Controls"]
        E2E["End-to-End<br/>Encryption"]
        RateLimiting["Rate Limiting"]
        AuthMiddleware["Global Auth<br/>Middleware on API"]
        FileCleanup["Scheduled File<br/>Cleanup"]
        DeviceLimit["Device Limit<br/>Enforcement"]
        Tests["Automated Tests"]
    end
```

## Security Considerations

```mermaid
flowchart TD
    subgraph "Current Security"
        style CurrentSecurity fill:#d4edda
        PassHash["Password Hashing<br/>(scrypt + salt)"]
        TSEqual["Timing-safe comparison"]
        HttpOnly["HttpOnly cookies"]
        SessionDB["DB-backed sessions"]
        VerifyKey["2-digit connection<br/>verification key"]
    end

    subgraph "Gaps to Address"
        style Gaps fill:#fff3cd
        G1["HTTPS in production<br/>(cookie secure: false)"]
        G2["No CSRF protection"]
        G3["No rate limiting<br/>on auth endpoints"]
        G4["API routes lack<br/>auth middleware<br/>(devices, files, connections)"]
        G5["No input sanitization<br/>on file content"]
        G6["Default SESSION_SECRET<br/>in production"]
        G7["File upload path<br/>traversal risk"]
        G8["No file type<br/>validation"]
    end
```

## Suggested Feature Priorities

```mermaid
graph TD
    subgraph "Priority 1: Security Hardening"
        P1A["Add auth middleware<br/>to all API routes"]
        P1B["Enable HTTPS &<br/>secure cookies"]
        P1C["Add rate limiting<br/>(express-rate-limit)"]
        P1D["Rotate SESSION_SECRET<br/>from env var"]
        P1E["Validate file types<br/>& sanitize paths"]
    end

    subgraph "Priority 2: Core Features"
        P2A["Payment integration<br/>(Stripe)"]
        P2B["Subscription enforcement<br/>(transfer limits)"]
        P2C["Device limit per user"]
        P2D["File expiration /<br/>auto-cleanup"]
        P2E["Multi-file transfer"]
    end

    subgraph "Priority 3: Polish"
        P3A["End-to-end encryption"]
        P3B["File history /<br/>versioning"]
        P3C["Push notifications<br/>(service worker)"]
        P3D["Mobile-responsive<br/>improvements"]
        P3E["Admin dashboard"]
    end

    subgraph "Priority 4: Scale"
        P4A["Automated tests<br/>(unit + integration)"]
        P4B["CI/CD pipeline"]
        P4C["Logging & monitoring"]
        P4D["WebSocket horizontal<br/>scaling (Redis adapter)"]
        P4E["CDN for file delivery"]
    end

    P1A --> P2A
    P1B --> P2A
    P2A --> P3A
    P3A --> P4A
```

## Data Flow Bottleneck Analysis

```mermaid
flowchart TD
    subgraph "Current Bottlenecks"
        B1["File content stored<br/>in DB + disk<br/>(double storage)"]
        B2["WebSocket file transfer<br/>limited by message size<br/>(no chunking)"]
        B3["connectedClients Map<br/>is in-memory only<br/>(single server)"]
        B4["No connection pooling<br/>per-request for WS handlers"]
        B5["searchDevicesByNickname<br/>fetches all then dedupes<br/>in application code"]
    end

    subgraph "Suggested Solutions"
        S1["Store only file path<br/>in DB, serve from disk"]
        S2["Implement chunked<br/>file transfer via WS<br/>or use HTTP upload"]
        S3["Use Redis for<br/>shared client state"]
        S4["Connection pool is<br/>already configured<br/>(max: 5)"]
        S5["Use DISTINCT ON<br/>in SQL query"]
    end

    B1 --> S1
    B2 --> S2
    B3 --> S3
    B4 --> S4
    B5 --> S5
```

## Recommended Architecture Evolution

```mermaid
graph TD
    subgraph "Current (Monolith)"
        Express["Express Server"]
        Express --> WS_Handler["WebSocket Handler"]
        Express --> REST_Handler["REST API"]
        Express --> Auth_Handler["Auth"]
        Express --> Static["Static Files"]
    end

    subgraph "Phase 2 (Split Concerns)"
        API_Server["API Server<br/>(Express)"]
        WS_Server["WebSocket Server<br/>(dedicated)"]
        Redis["Redis<br/>(shared state +<br/>pub/sub)"]
        S3["Object Storage<br/>(S3/R2 for files)"]

        API_Server --> Redis
        WS_Server --> Redis
        API_Server --> S3
    end

    subgraph "Phase 3 (Scale)"
        LB["Load Balancer"]
        API1["API Instance 1"]
        API2["API Instance 2"]
        WS1["WS Instance 1"]
        WS2["WS Instance 2"]
        RedisCluster["Redis Cluster"]
        CDN["CDN"]
        ObjStore["Object Storage"]

        LB --> API1
        LB --> API2
        LB --> WS1
        LB --> WS2
        API1 --> RedisCluster
        WS1 --> RedisCluster
        CDN --> ObjStore
    end

    Current --> |"Next step"| Phase2["Phase 2"]
    Phase2 --> Phase3["Phase 3"]
```
