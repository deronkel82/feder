import { analyze } from './analysis';
self.onmessage = (event: MessageEvent<string>) => {
  const findings = analyze(event.data);
  self.postMessage({ findings: findings.slice(0, 80), total: findings.length });
};
