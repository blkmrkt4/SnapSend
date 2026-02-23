import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, CheckCircle2, XCircle, Download, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import type { OllamaStatus } from '@/types/electron';

interface SmartNamingSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'welcome' | 'ollama-check' | 'model-choice' | 'model-pull' | 'done';

const TEXT_MODEL = 'phi3:mini';

const IMAGE_MODELS = {
  llava: { label: 'LLaVA', size: '~4.7GB', ram: '~8GB', minRam: 16 },
  moondream: { label: 'Moondream', size: '~1.7GB', ram: '~3GB', minRam: 8 },
} as const;

export function SmartNamingSetupModal({ open, onOpenChange }: SmartNamingSetupModalProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pullProgress, setPullProgress] = useState<Record<string, { status: string; percent: number }>>({});
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullComplete, setPullComplete] = useState<Record<string, boolean>>({});
  const [selectedImageModel, setSelectedImageModel] = useState<'llava' | 'moondream'>('llava');

  // Load current image model from config on open
  useEffect(() => {
    if (open && window.electronAPI?.getImageModel) {
      window.electronAPI.getImageModel().then((model) => {
        if (model === 'moondream' || model === 'llava') {
          setSelectedImageModel(model);
        }
      }).catch(() => {});
    }
  }, [open]);

  const checkOllama = useCallback(async () => {
    if (!window.electronAPI?.isElectron) return;
    setChecking(true);
    try {
      const status = await window.electronAPI.checkOllamaStatus();
      setOllamaStatus(status);
      if (status.running && step === 'ollama-check') {
        setStep('model-choice');
      }
    } catch {
      setOllamaStatus({ running: false, models: [] });
    }
    setChecking(false);
  }, [step]);

  useEffect(() => {
    if (open && step === 'ollama-check') {
      checkOllama();
    }
  }, [open, step, checkOllama]);

  // Listen for pull progress events
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    window.electronAPI.onOllamaPullProgress((data) => {
      setPullProgress((prev) => ({
        ...prev,
        [data.model]: { status: data.status, percent: data.percent ?? 0 },
      }));
      if (data.status === 'success') {
        setPullComplete((prev) => ({ ...prev, [data.model]: true }));
        setPullingModel(null);
      }
    });
  }, []);

  const handlePullModel = async (modelName: string) => {
    if (!window.electronAPI?.isElectron || pullingModel) return;
    setPullingModel(modelName);
    setPullProgress((prev) => ({ ...prev, [modelName]: { status: 'starting...', percent: 0 } }));
    try {
      await window.electronAPI.pullOllamaModel(modelName);
      setPullComplete((prev) => ({ ...prev, [modelName]: true }));
    } catch {
      setPullProgress((prev) => ({ ...prev, [modelName]: { status: 'failed', percent: 0 } }));
    }
    setPullingModel(null);
  };

  const handleEnable = async () => {
    if (!window.electronAPI?.isElectron) return;
    await window.electronAPI.setSmartNaming(true);
    onOpenChange(false);
    // Reset for next open
    setStep('welcome');
  };

  const handleSelectImageModel = async (model: 'llava' | 'moondream') => {
    setSelectedImageModel(model);
    // Save to config immediately
    if (window.electronAPI?.setImageModel) {
      await window.electronAPI.setImageModel(model);
    }
  };

  const isModelAvailable = (modelName: string): boolean => {
    if (pullComplete[modelName]) return true;
    if (!ollamaStatus) return false;
    return ollamaStatus.models.some(
      (m) => m === modelName || m.startsWith(`${modelName}:`)
    );
  };

  const allModelsAvailable = isModelAvailable(selectedImageModel) && isModelAvailable(TEXT_MODEL);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setPullProgress({});
      setPullingModel(null);
      setPullComplete({});
      setOllamaStatus(null);
    }
  }, [open]);

  const imageInfo = IMAGE_MODELS[selectedImageModel];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Naming Setup
          </DialogTitle>
        </DialogHeader>

        {step === 'welcome' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Smart Naming uses local AI models via <strong>Ollama</strong> to automatically suggest
              descriptive names for transferred files.
            </p>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>Images analyzed with a <strong>vision model</strong> (you choose which one)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>Text files analyzed with <strong>Phi-3 Mini</strong> language model (~2.3GB)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>All processing runs <strong>locally</strong> on your machine — nothing sent to the cloud</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => setStep('ollama-check')}>
              Continue
            </Button>
          </div>
        )}

        {step === 'ollama-check' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Checking if Ollama is running on your machine...
            </p>

            {checking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking for Ollama (will auto-start if installed)...
              </div>
            ) : ollamaStatus?.running ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Ollama is running
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  Ollama not detected
                </div>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <p className="font-medium">To install Ollama:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>
                      Visit{' '}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1"
                      >
                        ollama.com <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Download and install for your platform</li>
                    <li>Start the Ollama app</li>
                  </ol>
                </div>
                <Button variant="outline" className="w-full" onClick={checkOllama}>
                  Check Again
                </Button>
              </div>
            )}

            {ollamaStatus?.running && (
              <Button className="w-full" onClick={() => setStep('model-choice')}>
                Continue
              </Button>
            )}
          </div>
        )}

        {step === 'model-choice' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a vision model for analyzing images. This depends on how much <strong>RAM</strong> your machine has.
            </p>

            <div className="space-y-3">
              {/* LLaVA option */}
              <label
                className={`block rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                  selectedImageModel === 'llava'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="imageModel"
                    checked={selectedImageModel === 'llava'}
                    onChange={() => handleSelectImageModel('llava')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">LLaVA</span>
                      <Badge className="text-[10px] bg-green-600">Recommended</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>Better accuracy for describing images</div>
                      <div>Download: ~4.7GB &middot; Uses ~8GB RAM while running</div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>Requires 16GB+ RAM on your machine</span>
                    </div>
                  </div>
                </div>
              </label>

              {/* Moondream option */}
              <label
                className={`block rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                  selectedImageModel === 'moondream'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="imageModel"
                    checked={selectedImageModel === 'moondream'}
                    onChange={() => handleSelectImageModel('moondream')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Moondream</span>
                      <Badge variant="secondary" className="text-[10px]">Lightweight</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>Smaller and faster, but less accurate</div>
                      <div>Download: ~1.7GB &middot; Uses ~3GB RAM while running</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      Works on machines with 8GB RAM
                    </div>
                  </div>
                </div>
              </label>
            </div>

            <Button className="w-full" onClick={() => setStep('model-pull')}>
              Continue with {IMAGE_MODELS[selectedImageModel].label}
            </Button>
          </div>
        )}

        {step === 'model-pull' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The following models are needed for Smart Naming:
            </p>

            <div className="space-y-3">
              {[
                { name: selectedImageModel, label: `${imageInfo.label} (Vision)`, size: imageInfo.size },
                { name: TEXT_MODEL, label: 'Phi-3 Mini (Text)', size: '~2.3GB' },
              ].map(({ name, label, size }) => {
                const available = isModelAvailable(name);
                const progress = pullProgress[name];
                const pulling = pullingModel === name;

                return (
                  <div key={name} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{size}</span>
                      </div>
                      {available ? (
                        <Badge className="bg-green-600 text-xs">Available</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Pulled</Badge>
                      )}
                    </div>

                    {!available && !pulling && !progress && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                        onClick={() => handlePullModel(name)}
                        disabled={!!pullingModel}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Pull Model
                      </Button>
                    )}

                    {(pulling || (progress && !available)) && (
                      <div className="space-y-1.5">
                        <Progress value={progress?.percent ?? 0} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{progress?.status || 'Starting...'}</span>
                          <span>{progress?.percent ?? 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {allModelsAvailable ? (
              <Button className="w-full" onClick={() => setStep('done')}>
                Continue
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Pull at least one model to continue, or pull both for full coverage.
              </p>
            )}

            {(isModelAvailable(selectedImageModel) || isModelAvailable(TEXT_MODEL)) && !allModelsAvailable && (
              <Button variant="outline" className="w-full" onClick={() => setStep('done')}>
                Skip — use available models only
              </Button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Ready to go!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Smart Naming will automatically suggest descriptive names for your transferred files.
              </p>
            </div>
            <Button className="w-full" onClick={handleEnable}>
              Enable Smart Naming
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
