import { useEffect, useState } from 'react';
import type { Finding } from './analysis';
export function useAnalysis(text: string, enabled: boolean) {
  const [result, setResult] = useState<{
    text: string;
    findings: Finding[];
    total: number;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let worker: Worker | undefined;
    let active = true;
    const timer = setTimeout(() => {
      const failed = () => {
        if (active)
          setResult({
            text,
            findings: [],
            total: 0,
            error:
              'Sprachanalyse momentan nicht verfügbar. Bitte erneut öffnen.',
          });
        worker?.terminate();
      };
      try {
        worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (
          event: MessageEvent<{ findings: Finding[]; total: number }>,
        ) => {
          if (active) setResult({ text, ...event.data });
          worker?.terminate();
        };
        worker.onerror = failed;
        worker.postMessage(text);
      } catch {
        failed();
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [text, enabled]);
  return result?.text === text
    ? { ...result, pending: false }
    : { findings: [], total: 0, pending: true };
}
