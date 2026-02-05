import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const LICENSE_FILE = 'license.enc';
const VALIDATE_INTERVAL_DAYS = 7;

export interface LicenseStatus {
  isActivated: boolean;
  key?: string;
  instanceId?: string;
  customerName?: string;
  expiresAt?: string;
  lastValidated?: string;
}

interface StoredLicense {
  key: string;
  instanceId: string;
  customerName: string;
  expiresAt: string | null;
  lastValidated: string;
}

function getLicensePath(): string {
  return path.join(app.getPath('userData'), LICENSE_FILE);
}

function saveLicense(data: StoredLicense): void {
  const json = JSON.stringify(data);
  const filePath = getLicensePath();

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(filePath, encrypted);
  } else {
    // Fallback: store as plain text (dev/unsupported platforms)
    fs.writeFileSync(filePath, json, 'utf-8');
  }
}

function loadLicense(): StoredLicense | null {
  const filePath = getLicensePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath);

    let json: string;
    if (safeStorage.isEncryptionAvailable()) {
      json = safeStorage.decryptString(raw);
    } else {
      json = raw.toString('utf-8');
    }

    return JSON.parse(json) as StoredLicense;
  } catch {
    return null;
  }
}

function deleteLicenseFile(): void {
  const filePath = getLicensePath();
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

async function lemonSqueezyPost(endpoint: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

export async function activateLicense(key: string): Promise<{ success: boolean; error?: string; customerName?: string }> {
  try {
    const instanceName = os.hostname();
    const result = await lemonSqueezyPost('activate', {
      license_key: key,
      instance_name: instanceName,
    });

    if (result.activated || result.valid) {
      const stored: StoredLicense = {
        key,
        instanceId: result.instance?.id || '',
        customerName: result.meta?.customer_name || '',
        expiresAt: result.license_key?.expires_at || null,
        lastValidated: new Date().toISOString(),
      };
      saveLicense(stored);

      return { success: true, customerName: stored.customerName };
    }

    return { success: false, error: result.error || 'Activation failed. Check your license key.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error. Please check your connection.' };
  }
}

export async function validateLicense(): Promise<{ isActivated: boolean; customerName?: string }> {
  const stored = loadLicense();
  if (!stored) return { isActivated: false };

  // Check if we need to re-validate
  const lastValidated = new Date(stored.lastValidated);
  const daysSince = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < VALIDATE_INTERVAL_DAYS) {
    return { isActivated: true, customerName: stored.customerName };
  }

  // Re-validate with LemonSqueezy
  try {
    const result = await lemonSqueezyPost('validate', {
      license_key: stored.key,
      instance_id: stored.instanceId,
    });

    if (result.valid) {
      stored.lastValidated = new Date().toISOString();
      saveLicense(stored);
      return { isActivated: true, customerName: stored.customerName };
    }

    // License revoked or invalid — clear local data
    deleteLicenseFile();
    return { isActivated: false };
  } catch {
    // Network error during re-validation — stay activated (grace period)
    return { isActivated: true, customerName: stored.customerName };
  }
}

export async function deactivateLicense(): Promise<void> {
  const stored = loadLicense();
  if (!stored) return;

  try {
    await lemonSqueezyPost('deactivate', {
      license_key: stored.key,
      instance_id: stored.instanceId,
    });
  } catch {
    // Best-effort deactivation
  }

  deleteLicenseFile();
}

export function getLicenseStatus(): LicenseStatus {
  const stored = loadLicense();
  if (!stored) return { isActivated: false };

  return {
    isActivated: true,
    key: stored.key,
    instanceId: stored.instanceId,
    customerName: stored.customerName,
    expiresAt: stored.expiresAt || undefined,
    lastValidated: stored.lastValidated,
  };
}
