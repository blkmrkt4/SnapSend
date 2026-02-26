import { spawn, type ChildProcess } from 'child_process';
import { lookup as dnsLookup } from 'dns';
import { networkInterfaces } from 'os';

/**
 * Get the best local IPv4 address for LAN communication.
 * Scores interfaces to prefer real adapters over virtual/VPN ones.
 */
function getLocalIPv4(): string | null {
  const nets = networkInterfaces();
  const candidates: { address: string; name: string; score: number }[] = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      let score = 0;
      const lo = name.toLowerCase();
      // Penalize known virtual adapters
      if (/vethernet|vmnet|docker|vbox|hyper-v|wsl|virtualbox|vmware/i.test(lo)) score -= 10;
      if (/vpn|tun|tap|tailscale|zt|wireguard/i.test(lo)) score -= 10;
      // Prefer common real adapter names
      if (/^(ethernet|wi-fi|en\d|eth\d|wlan\d)/i.test(lo)) score += 5;
      // Prefer 192.168.x.x (typical home/office LAN)
      if (net.address.startsWith('192.168.')) score += 3;
      // 10.x.x.x is ambiguous but still better than 172.x.x.x (Docker often uses 172.17+)
      if (net.address.startsWith('10.')) score += 1;
      candidates.push({ address: net.address, name, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1) {
    console.log(`[Discovery] IP candidates: ${candidates.map(c => `${c.address}(${c.name},${c.score})`).join(', ')}`);
  }
  return candidates[0].address;
}

export interface PeerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
}

export type PeerChangeCallback = (peers: Map<string, PeerInfo>) => void;

/**
 * macOS-native discovery using the `dns-sd` CLI tool.
 *
 * This delegates all mDNS work to the system `mDNSResponder` daemon via its
 * Unix-domain-socket API, completely bypassing macOS Sequoia's Local Network
 * Privacy packet filter that blocks raw UDP multicast from Finder-launched apps.
 *
 * Falls back to the `bonjour-service` JS library on non-macOS platforms.
 */
export class DiscoveryManager {
  private peers: Map<string, PeerInfo> = new Map();
  private localId: string;
  private localName: string;
  private localPort: number;
  private onPeerDiscovered?: (peer: PeerInfo) => void;
  private onPeerLost?: (peerId: string) => void;
  private registerProc: ChildProcess | null = null;
  private browseProc: ChildProcess | null = null;
  private lookupProcs: Map<string, ChildProcess> = new Map();
  private started = false;
  private useFallback = process.platform !== 'darwin';

  // Fallback: bonjour-service for non-macOS
  private bonjour: any = null;
  private browser: any = null;
  private errorHandler: ((err: Error) => void) | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(localId: string, localName: string, localPort: number) {
    this.localId = localId;
    this.localName = localName;
    this.localPort = localPort;
  }

  start(callbacks: { onPeerDiscovered?: (peer: PeerInfo) => void; onPeerLost?: (peerId: string) => void }) {
    this.onPeerDiscovered = callbacks.onPeerDiscovered;
    this.onPeerLost = callbacks.onPeerLost;
    this.started = true;

    if (this.useFallback) {
      this.startFallback();
    } else {
      this.startNative();
    }
  }

  // ─── macOS native dns-sd implementation ───────────────────────────────

  private startNative() {
    this.startRegister();
    this.startBrowse();
  }

  private startRegister() {
    if (this.registerProc) {
      this.registerProc.kill();
      this.registerProc = null;
    }

    // dns-sd -R <name> <type> <domain> <port> [key=value ...]
    const localIP = getLocalIPv4();
    const args = [
      '-R',
      `liquidrelay-${this.localId}`,
      '_liquidrelay._tcp',
      '.',
      String(this.localPort),
      `id=${this.localId}`,
      `deviceName=${this.localName}`,
      `ip=${localIP || ''}`,
    ];

    console.log(`[Discovery] Registering: dns-sd ${args.join(' ')}`);
    this.registerProc = spawn('/usr/bin/dns-sd', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    this.registerProc.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        const trimmed = line.trim();
        if (trimmed) console.log(`[Discovery] Register: ${trimmed}`);
      }
    });

    this.registerProc.stderr?.on('data', (data: Buffer) => {
      console.warn(`[Discovery] Register stderr: ${data.toString().trim()}`);
    });

    this.registerProc.on('error', (err) => {
      console.error('[Discovery] Failed to spawn dns-sd -R:', err.message);
    });

    this.registerProc.on('exit', (code) => {
      console.log(`[Discovery] dns-sd -R exited (code ${code})`);
      if (this.started && code !== null) {
        // Restart registration after a delay
        setTimeout(() => { if (this.started) this.startRegister(); }, 3000);
      }
    });
  }

  private startBrowse() {
    if (this.browseProc) {
      this.browseProc.kill();
      this.browseProc = null;
    }

    console.log('[Discovery] Browsing: dns-sd -B _liquidrelay._tcp');
    this.browseProc = spawn('/usr/bin/dns-sd', ['-B', '_liquidrelay._tcp'], { stdio: ['ignore', 'pipe', 'pipe'] });

    let buffer = '';
    this.browseProc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        this.parseBrowseLine(line);
      }
    });

    this.browseProc.stderr?.on('data', (data: Buffer) => {
      console.warn(`[Discovery] Browse stderr: ${data.toString().trim()}`);
    });

    this.browseProc.on('error', (err) => {
      console.error('[Discovery] Failed to spawn dns-sd -B:', err.message);
    });

    this.browseProc.on('exit', (code) => {
      console.log(`[Discovery] dns-sd -B exited (code ${code})`);
      if (this.started && code !== null) {
        setTimeout(() => { if (this.started) this.startBrowse(); }, 3000);
      }
    });
  }

  /**
   * Parse a single line of `dns-sd -B` output.
   *
   * Example output:
   *   Timestamp     A/R    Flags  if Domain     Service Type         Instance Name
   *   10:30:15.456  Add        3   4 local.     _liquidrelay._tcp.      liquidrelay-abc123
   *   10:35:20.789  Rmv        1   4 local.     _liquidrelay._tcp.      liquidrelay-abc123
   */
  private parseBrowseLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Browsing') || trimmed.startsWith('DATE:') ||
        trimmed.startsWith('Timestamp') || trimmed.includes('...STARTING...')) {
      return;
    }

    // Extract instance name: everything after the service type column
    const match = trimmed.match(/_liquidrelay\._tcp\.\s+(.+)/);
    if (!match) return;
    const instanceName = match[1].trim();

    if (trimmed.includes('Add')) {
      console.log(`[Discovery] Browse: Add ${instanceName}`);
      // Skip self
      if (instanceName === `liquidrelay-${this.localId}`) return;
      this.lookupService(instanceName);
    } else if (trimmed.includes('Rmv')) {
      console.log(`[Discovery] Browse: Rmv ${instanceName}`);
      // Find peer by instance name and remove
      const peerId = instanceName.replace(/^liquidrelay-/, '');
      if (peerId !== this.localId && this.peers.has(peerId)) {
        const peer = this.peers.get(peerId)!;
        console.log(`[Discovery] Peer lost: ${peer.name}`);
        this.peers.delete(peerId);
        this.onPeerLost?.(peerId);
      }
    }
  }

  /**
   * Resolve a discovered service instance to get host, port, and TXT record.
   * Spawns `dns-sd -L <name> _liquidrelay._tcp` and parses the output.
   *
   * Example output:
   *   10:30:15.456  liquidrelay-abc._liquidrelay._tcp.local. can be reached at MyMac.local.:53000 (interface 4)
   *    id=abc deviceName=MyMac
   */
  private lookupService(instanceName: string) {
    // Kill any existing lookup for this instance
    const existing = this.lookupProcs.get(instanceName);
    if (existing) {
      existing.kill();
      this.lookupProcs.delete(instanceName);
    }

    const proc = spawn('/usr/bin/dns-sd', ['-L', instanceName, '_liquidrelay._tcp'], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.lookupProcs.set(instanceName, proc);

    let output = '';
    let resolved = false;

    proc.stdout?.on('data', (data: Buffer) => {
      if (resolved) return;
      output += data.toString();

      // Try to parse once we have the host line and the TXT line
      const hostMatch = output.match(/can be reached at (.+?):(\d+)/);
      if (!hostMatch) return;

      // TXT record is on the next line after the "can be reached at" line.
      // It starts with whitespace and contains key=value pairs.
      const afterHost = output.substring(output.indexOf('can be reached at'));
      const txtLineMatch = afterHost.match(/\n\s+(.+)/);
      if (!txtLineMatch) return;

      resolved = true;
      proc.kill();
      this.lookupProcs.delete(instanceName);

      // Strip trailing dot from FQDN hostname (e.g., "MyMac.local." → "MyMac.local")
      const rawHost = hostMatch[1].replace(/\.$/, '');
      const port = parseInt(hostMatch[2], 10);
      const txtLine = txtLineMatch[1].trim();

      // Parse TXT key=value pairs
      const txt: Record<string, string> = {};
      const kvMatches = txtLine.matchAll(/(\w+)=(\S*)/g);
      for (const m of kvMatches) {
        txt[m[1]] = m[2];
      }

      const peerId = txt.id || instanceName.replace(/^liquidrelay-/, '');
      const peerName = txt.deviceName || instanceName;
      const txtIP = txt.ip; // IP address from TXT record (Windows advertises this)

      if (peerId === this.localId) return;

      // If peer already exists, update host/port/name if we have better data
      const existingPeer = this.peers.get(peerId);
      const isRediscovery = !!existingPeer;

      // If TXT record contains an IP, use it directly (Windows peers)
      if (txtIP && /^\d+\.\d+\.\d+\.\d+$/.test(txtIP)) {
        console.log(`[Discovery] Using IP from TXT record: ${txtIP}`);
        if (isRediscovery) {
          // Update existing peer with better info
          existingPeer!.host = txtIP;
          existingPeer!.port = port;
          existingPeer!.name = peerName;
          console.log(`[Discovery] Updated peer: ${peerName} at ${txtIP}:${port}`);
          this.onPeerDiscovered?.(existingPeer!);
        } else {
          const peer: PeerInfo = { id: peerId, name: peerName, host: txtIP, port };
          this.peers.set(peerId, peer);
          console.log(`[Discovery] Peer discovered: ${peerName} at ${txtIP}:${port}`);
          this.onPeerDiscovered?.(peer);
        }
        return;
      }

      // Resolve .local hostname to IP address — Node's ws/http client
      // doesn't reliably resolve mDNS hostnames on all machines.
      dnsLookup(rawHost, { family: 4 }, (dnsErr, ip) => {
        const host = (!dnsErr && ip) ? ip : rawHost;
        if (!dnsErr && ip) {
          console.log(`[Discovery] Resolved ${rawHost} → ${ip}`);
        } else {
          console.warn(`[Discovery] Could not resolve ${rawHost}: ${dnsErr?.message}, using hostname`);
        }

        const currentPeer = this.peers.get(peerId);
        if (currentPeer) {
          // Update existing peer with better host/port
          if (host && port > 0) {
            currentPeer.host = host;
            currentPeer.port = port;
            currentPeer.name = peerName;
            console.log(`[Discovery] Updated peer: ${peerName} at ${host}:${port}`);
            this.onPeerDiscovered?.(currentPeer);
          }
        } else {
          const peer: PeerInfo = { id: peerId, name: peerName, host, port };
          this.peers.set(peerId, peer);
          console.log(`[Discovery] Peer discovered: ${peerName} at ${host}:${port}`);
          this.onPeerDiscovered?.(peer);
        }
      });
    });

    proc.on('error', (err) => {
      console.error(`[Discovery] dns-sd -L failed for ${instanceName}:`, err.message);
      this.lookupProcs.delete(instanceName);
    });

    proc.on('exit', () => {
      this.lookupProcs.delete(instanceName);
    });

    // Safety: kill lookup after 5 seconds if it hasn't resolved
    setTimeout(() => {
      if (!resolved && !proc.killed) {
        proc.kill();
        this.lookupProcs.delete(instanceName);
      }
    }, 5000);
  }

  // ─── Fallback: bonjour-service for non-macOS ─────────────────────────

  private startFallback() {
    try {
      if (!this.errorHandler) {
        this.errorHandler = (err: Error) => {
          const msg = err.message || '';
          if (msg.includes('EHOSTUNREACH') || msg.includes('ENETUNREACH') || msg.includes('EADDRNOTAVAIL')) {
            console.warn('[Discovery] Multicast send failed (ignoring):', msg.substring(0, 80));
          } else {
            throw err;
          }
        };
        process.on('uncaughtException', this.errorHandler);
      }

      const Bonjour = require('bonjour-service').default || require('bonjour-service');
      this.bonjour = new Bonjour();

      this.browser = this.bonjour.find({ type: 'liquidrelay' }, (service: any) => {
        this.handleFallbackService(service);
      });

      console.log(`[Discovery] Browser created, update available: ${typeof this.browser.update === 'function'}`);

      this.browser.on('up', (service: any) => {
        const txt = service.txt as Record<string, string> | undefined;
        console.log(`[Discovery] Browser UP: ${txt?.deviceName || service.name} ${service.host} ${service.port}`);
      });

      this.browser.on('down', (service: any) => {
        const txt = service.txt as Record<string, string> | undefined;
        const peerId = txt?.id;
        if (peerId && peerId !== this.localId && this.peers.has(peerId)) {
          const peer = this.peers.get(peerId)!;
          console.log(`[Discovery] Peer lost: ${peer.name}`);
          this.peers.delete(peerId);
          this.onPeerLost?.(peerId);
        }
      });

      const localIP = getLocalIPv4();
      this.bonjour.publish({
        name: `liquidrelay-${this.localId}`,
        type: 'liquidrelay',
        port: this.localPort,
        txt: { id: this.localId, deviceName: this.localName, ip: localIP || '' },
      });

      console.log(`[Discovery] Fallback: publishing _liquidrelay._tcp on port ${this.localPort} (IP: ${localIP || 'unknown'})`);

      this.refreshTimer = setInterval(() => {
        if (this.started && this.browser) {
          if (typeof this.browser.update === 'function') {
            this.browser.update();
            console.log('[Discovery] Fallback: sent refresh query via update()');
          } else {
            console.log('[Discovery] Fallback: browser.update() not available, relying on passive listening');
          }
        }
      }, 30000);
    } catch (err: any) {
      console.error('[Discovery] Fallback failed to start:', err.message);
    }
  }

  private handleFallbackService(service: any): void {
    const txt = service.txt as Record<string, string> | undefined;
    const peerId = txt?.id;
    const peerName = txt?.deviceName || service.name;
    const txtIP = txt?.ip;
    if (!peerId || peerId === this.localId) return;

    const existingPeer = this.peers.get(peerId);

    // Prefer IP from TXT record (cross-platform compatibility)
    if (txtIP && /^\d+\.\d+\.\d+\.\d+$/.test(txtIP)) {
      if (existingPeer) {
        existingPeer.host = txtIP;
        existingPeer.port = service.port;
        existingPeer.name = peerName;
        console.log(`[Discovery] Updated peer: ${peerName} at ${txtIP}:${service.port}`);
        this.onPeerDiscovered?.(existingPeer);
      } else {
        console.log(`[Discovery] Using IP from TXT record: ${txtIP}`);
        const peer: PeerInfo = { id: peerId, name: peerName, host: txtIP, port: service.port };
        this.peers.set(peerId, peer);
        console.log(`[Discovery] Peer discovered: ${peerName} at ${txtIP}:${service.port}`);
        this.onPeerDiscovered?.(peer);
      }
      return;
    }

    // Fallback: resolve hostname to IP
    const rawHost = service.host;
    dnsLookup(rawHost, { family: 4 }, (err, ip) => {
      const host = (!err && ip) ? ip : rawHost;
      if (!err && ip) {
        console.log(`[Discovery] Resolved ${rawHost} → ${ip}`);
      }
      const currentPeer = this.peers.get(peerId);
      if (currentPeer) {
        if (host && service.port > 0) {
          currentPeer.host = host;
          currentPeer.port = service.port;
          currentPeer.name = peerName;
          console.log(`[Discovery] Updated peer: ${peerName} at ${host}:${service.port}`);
          this.onPeerDiscovered?.(currentPeer);
        }
      } else {
        const peer: PeerInfo = { id: peerId, name: peerName, host, port: service.port };
        this.peers.set(peerId, peer);
        console.log(`[Discovery] Peer discovered: ${peerName} at ${host}:${service.port}`);
        this.onPeerDiscovered?.(peer);
      }
    });
  }

  // ─── Public API (unchanged) ───────────────────────────────────────────

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getLocalDevice() {
    return { id: this.localId, name: this.localName };
  }

  updateName(newName: string) {
    this.localName = newName;
    // Re-register with new name (native only; fallback would need restart)
    if (!this.useFallback && this.started) {
      this.startRegister();
    }
  }

  /**
   * Add a peer that connected to us (reverse discovery).
   * When a remote peer initiates a connection to our server, we learn about
   * them through the handshake. This adds them to the discovered peers list.
   */
  addIncomingPeer(peerId: string, peerName: string): void {
    if (peerId === this.localId) return;

    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      // Peer already known — update name but DON'T overwrite valid host/port with empty values
      existingPeer.name = peerName;
      console.log(`[Discovery] Updated incoming peer name: ${peerName} (${peerId}), keeping host=${existingPeer.host}:${existingPeer.port}`);
      this.onPeerDiscovered?.(existingPeer);
      return;
    }

    // We don't know their host/port since they connected to us, but we can
    // still add them to the list so the UI shows them.
    const peer: PeerInfo = { id: peerId, name: peerName, host: '', port: 0 };
    this.peers.set(peerId, peer);
    console.log(`[Discovery] Added incoming peer: ${peerName} (${peerId})`);
    this.onPeerDiscovered?.(peer);
  }

  restart() {
    console.log('[Discovery] Restart requested — preserving known peers');
    // DON'T clear peers — keep existing peer info so reconnect can use it
    // immediately. mDNS will re-confirm or update entries as they're found.

    if (this.useFallback) {
      this.stopFallback();
      this.startFallback();
    } else {
      this.stopNative();
      this.startNative();
    }
  }

  getDebugState() {
    return {
      started: this.started,
      useFallback: this.useFallback,
      localId: this.localId,
      localName: this.localName,
      localPort: this.localPort,
      peerCount: this.peers.size,
      peers: Array.from(this.peers.values()),
      registerProcAlive: !!this.registerProc && !this.registerProc.killed,
      browseProcAlive: !!this.browseProc && !this.browseProc.killed,
      lookupProcsCount: this.lookupProcs.size,
      bonjourActive: !!this.bonjour,
      browserActive: !!this.browser,
    };
  }

  stop() {
    this.started = false;
    if (this.useFallback) {
      this.stopFallback();
    } else {
      this.stopNative();
    }
    this.peers.clear();
    console.log('[Discovery] Stopped');
  }

  private stopNative() {
    if (this.registerProc) { this.registerProc.kill(); this.registerProc = null; }
    if (this.browseProc) { this.browseProc.kill(); this.browseProc = null; }
    this.lookupProcs.forEach((proc) => { try { proc.kill(); } catch {} });
    this.lookupProcs.clear();
  }

  private stopFallback() {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    if (this.errorHandler) { process.removeListener('uncaughtException', this.errorHandler); this.errorHandler = null; }
    try {
      if (this.browser) { this.browser.stop(); this.browser = null; }
      if (this.bonjour) { this.bonjour.unpublishAll(); this.bonjour.destroy(); this.bonjour = null; }
    } catch {}
  }
}
