import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';

const OLLAMA_BASE_URL = 'http://localhost:11434';

// --- Prompt config types ---

export interface PromptConfig {
  models: {
    image: string;
    text: string;
  };
  prompts: {
    image: {
      system: string;
      user: string;
    };
    text: {
      system: string;
      user: string;
    };
  };
  textPreviewChars: number;
  cleanFilename: {
    maxLength: number;
    lowercase: boolean;
  };
}

const DEFAULT_CONFIG: PromptConfig = {
  models: {
    image: 'moondream',
    text: 'phi3:mini',
  },
  prompts: {
    image: {
      system: '',
      user: 'Describe this image in 3-5 words suitable for a filename. Only respond with the filename, no explanation. The original filename was {{original_name}}.',
    },
    text: {
      system: '',
      user: 'Suggest a short descriptive filename (3-5 words) for this text content. Only respond with the filename, no explanation.\n\nOriginal filename: {{original_name}}\n\nContent:\n{{text_preview}}',
    },
  },
  textPreviewChars: 500,
  cleanFilename: {
    maxLength: 60,
    lowercase: true,
  },
};

// --- Config file management ---

export function getPromptConfigPath(): string {
  return path.join(app.getPath('userData'), 'smart-naming-config.json');
}

export function getPromptLogPath(): string {
  return path.join(app.getPath('userData'), 'smart-naming-log.jsonl');
}

export function loadPromptConfig(): PromptConfig {
  const configPath = getPromptConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge with defaults so missing keys get filled in
      return {
        models: { ...DEFAULT_CONFIG.models, ...parsed.models },
        prompts: {
          image: { ...DEFAULT_CONFIG.prompts.image, ...parsed.prompts?.image },
          text: { ...DEFAULT_CONFIG.prompts.text, ...parsed.prompts?.text },
        },
        textPreviewChars: parsed.textPreviewChars ?? DEFAULT_CONFIG.textPreviewChars,
        cleanFilename: { ...DEFAULT_CONFIG.cleanFilename, ...parsed.cleanFilename },
      };
    }
  } catch (err) {
    console.error('Smart Naming: Failed to load config, using defaults:', err);
  }

  // Write defaults on first use
  saveDefaultConfig();
  return { ...DEFAULT_CONFIG };
}

export function saveDefaultConfig(): void {
  const configPath = getPromptConfigPath();
  try {
    const configDir = path.dirname(configPath);
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  } catch (err) {
    console.error('Smart Naming: Failed to save default config:', err);
  }
}

export function resetPromptConfig(): void {
  saveDefaultConfig();
}

// --- Template resolution ---

export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return vars[key] ?? '';
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// --- Prompt logging ---

export interface PromptLogEntry {
  timestamp: string;
  fileId: number;
  originalName: string;
  mimeType: string;
  model: string;
  promptSent: { system: string; user: string };
  rawResponse: string;
  cleanedName: string;
  durationMs: number;
}

export function logPromptExchange(entry: PromptLogEntry): void {
  const logPath = getPromptLogPath();
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error('Smart Naming: Failed to write log:', err);
  }
}

export function clearPromptLog(): void {
  const logPath = getPromptLogPath();
  try {
    fs.writeFileSync(logPath, '', 'utf-8');
  } catch (err) {
    console.error('Smart Naming: Failed to clear log:', err);
  }
}

// --- Ollama process management ---

let ollamaProcess: ChildProcess | null = null;
let weStartedOllama = false;

const OLLAMA_PATHS_MAC = [
  '/usr/local/bin/ollama',
  '/Applications/Ollama.app/Contents/Resources/ollama',
  '/opt/homebrew/bin/ollama',
];

const OLLAMA_PATHS_WIN = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
  path.join(process.env.PROGRAMFILES || '', 'Ollama', 'ollama.exe'),
];

function findOllamaBinary(): string | null {
  const candidates = process.platform === 'win32' ? OLLAMA_PATHS_WIN : OLLAMA_PATHS_MAC;
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure Ollama is running. If it's not running but the binary is installed,
 * spawn `ollama serve` as a child process. Returns true if Ollama is available.
 */
export async function ensureOllamaRunning(): Promise<boolean> {
  // Already running (either externally or by us)?
  if (await isOllamaRunning()) return true;

  // Try to find and launch the binary
  const binary = findOllamaBinary();
  if (!binary) {
    console.log('Smart Naming: Ollama binary not found, skipping auto-launch');
    return false;
  }

  console.log(`Smart Naming: Starting Ollama from ${binary}`);
  try {
    ollamaProcess = spawn(binary, ['serve'], {
      stdio: 'ignore',
      detached: false,
      env: {
        ...process.env,
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_ORIGINS: '*',
      },
    });

    ollamaProcess.on('error', (err) => {
      console.error('Smart Naming: Failed to start Ollama:', err.message);
      ollamaProcess = null;
      weStartedOllama = false;
    });

    ollamaProcess.on('exit', (code) => {
      console.log(`Smart Naming: Ollama process exited with code ${code}`);
      ollamaProcess = null;
      weStartedOllama = false;
    });

    // Wait for the server to become responsive (up to 8 seconds)
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isOllamaRunning()) {
        weStartedOllama = true;
        console.log('Smart Naming: Ollama is now running');
        return true;
      }
    }

    console.log('Smart Naming: Ollama started but not responding within timeout');
    return false;
  } catch (err) {
    console.error('Smart Naming: Error launching Ollama:', err);
    return false;
  }
}

/**
 * Stop the Ollama process if we started it. Called during app shutdown.
 */
export function stopOllama() {
  if (ollamaProcess && weStartedOllama) {
    console.log('Smart Naming: Stopping Ollama process');
    try {
      ollamaProcess.kill('SIGTERM');
    } catch {}
    ollamaProcess = null;
    weStartedOllama = false;
  }
}

// --- Settings persistence ---

export function getSmartNamingSetting(): boolean {
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'smart-naming');

  try {
    if (fs.existsSync(settingFile)) {
      return fs.readFileSync(settingFile, 'utf-8').trim() === 'true';
    }
  } catch {}

  return false;
}

export function saveSmartNamingSetting(enabled: boolean) {
  const configDir = app.getPath('userData');
  const settingFile = path.join(configDir, 'smart-naming');

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(settingFile, enabled ? 'true' : 'false', 'utf-8');
  } catch (err) {
    console.error('Failed to save smart naming setting:', err);
  }
}

// --- Ollama API ---

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { running: false, models: [] };

    const data = await response.json() as { models?: { name: string }[] };
    const models = (data.models || []).map((m) => m.name);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

export function isModelAvailable(models: string[], modelName: string): boolean {
  return models.some(
    (m) => m === modelName || m.startsWith(`${modelName}:`)
  );
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
}

export async function pullModel(
  name: string,
  onProgress: (progress: PullProgress) => void
): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.ok || !response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as PullProgress;
          if (parsed.total && parsed.completed) {
            parsed.percent = Math.round((parsed.completed / parsed.total) * 100);
          }
          onProgress(parsed);
        } catch {}
      }
    }

    return true;
  } catch (err) {
    console.error(`Failed to pull model ${name}:`, err);
    return false;
  }
}

// --- Smart name generation ---

export interface SmartNameResult {
  suggestedName: string;
}

export interface SmartNameContext {
  fileId: number;
  filename: string;
  mimeType: string;
  originalName: string;
  size: number;
  isClipboard: boolean;
  fromDeviceName: string;
}

export async function generateSmartName(
  filePath: string,
  context: SmartNameContext
): Promise<SmartNameResult | null> {
  const enabled = getSmartNamingSetting();
  if (!enabled) return null;

  const status = await checkOllamaStatus();
  if (!status.running) return null;

  const config = loadPromptConfig();
  const ext = path.extname(context.originalName);
  const stem = path.basename(context.originalName, ext);

  // Build template variables available to all file types
  const baseVars: Record<string, string> = {
    original_name: context.originalName,
    file_extension: ext,
    file_stem: stem,
    mime_type: context.mimeType,
    file_size: String(context.size),
    file_size_human: formatFileSize(context.size),
    is_clipboard: String(context.isClipboard),
    from_device: context.fromDeviceName,
  };

  try {
    let rawName: string | null = null;

    if (context.mimeType.startsWith('image/') && isModelAvailable(status.models, config.models.image)) {
      rawName = await generateImageName(filePath, config, baseVars, context);
    } else if (
      (context.mimeType.startsWith('text/') || context.mimeType === 'application/json') &&
      isModelAvailable(status.models, config.models.text)
    ) {
      rawName = await generateTextName(filePath, config, baseVars, context);
    }

    if (!rawName) return null;

    const cleaned = cleanFilename(rawName, config);
    if (!cleaned || cleaned.length < 2) return null;

    return { suggestedName: cleaned + ext };
  } catch (err) {
    console.error('Smart naming failed:', err);
    return null;
  }
}

async function generateImageName(
  filePath: string,
  config: PromptConfig,
  vars: Record<string, string>,
  context: SmartNameContext
): Promise<string | null> {
  const startTime = Date.now();
  const model = config.models.image;
  const systemPrompt = resolveTemplate(config.prompts.image.system, vars);
  const userPrompt = resolveTemplate(config.prompts.image.user, vars);

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');

    const body: any = {
      model,
      prompt: userPrompt,
      images: [base64],
      stream: false,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;
    const data = await response.json() as { response?: string };
    const rawResponse = data.response?.trim() || '';
    const ext = path.extname(context.originalName);
    const cleaned = cleanFilename(rawResponse, config);

    logPromptExchange({
      timestamp: new Date().toISOString(),
      fileId: context.fileId,
      originalName: context.originalName,
      mimeType: context.mimeType,
      model,
      promptSent: { system: systemPrompt, user: userPrompt },
      rawResponse,
      cleanedName: cleaned + ext,
      durationMs: Date.now() - startTime,
    });

    return rawResponse || null;
  } catch {
    return null;
  }
}

async function generateTextName(
  filePath: string,
  config: PromptConfig,
  vars: Record<string, string>,
  context: SmartNameContext
): Promise<string | null> {
  const startTime = Date.now();
  const model = config.models.text;

  try {
    const content = fs.readFileSync(filePath, 'utf-8').slice(0, config.textPreviewChars);
    if (!content.trim()) return null;

    const textVars = { ...vars, text_preview: content };
    const systemPrompt = resolveTemplate(config.prompts.text.system, textVars);
    const userPrompt = resolveTemplate(config.prompts.text.user, textVars);

    const body: any = {
      model,
      prompt: userPrompt,
      stream: false,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;
    const data = await response.json() as { response?: string };
    const rawResponse = data.response?.trim() || '';
    const ext = path.extname(context.originalName);
    const cleaned = cleanFilename(rawResponse, config);

    logPromptExchange({
      timestamp: new Date().toISOString(),
      fileId: context.fileId,
      originalName: context.originalName,
      mimeType: context.mimeType,
      model,
      promptSent: { system: systemPrompt, user: userPrompt },
      rawResponse,
      cleanedName: cleaned + ext,
      durationMs: Date.now() - startTime,
    });

    return rawResponse || null;
  } catch {
    return null;
  }
}

function cleanFilename(raw: string, config: PromptConfig): string {
  let result = raw;
  if (config.cleanFilename.lowercase) {
    result = result.toLowerCase();
  }
  return result
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, config.cleanFilename.maxLength);
}
