export type Accessibility = {
  fontSize: number;
  lineHeight: number;
  font: 'serif' | 'sans';
  largeTargets: boolean;
  reducedMotion: boolean;
};
export const defaultAccessibility: Accessibility = {
  fontSize: 21,
  lineHeight: 1.8,
  font: 'serif',
  largeTargets: false,
  reducedMotion: false,
};
export function readAccessibility(): Accessibility {
  try {
    const v = JSON.parse(localStorage.getItem('feder.accessibility') || 'null');
    if (!v) return { ...defaultAccessibility };
    return {
      fontSize: [18, 21, 24, 28].includes(v.fontSize) ? v.fontSize : 21,
      lineHeight: [1.5, 1.8, 2.1].includes(v.lineHeight) ? v.lineHeight : 1.8,
      font: v.font === 'sans' ? 'sans' : 'serif',
      largeTargets: v.largeTargets === true,
      reducedMotion: v.reducedMotion === true,
    };
  } catch {
    return { ...defaultAccessibility };
  }
}
export function applyAccessibility(v: Accessibility) {
  const root = document.documentElement;
  root.style.setProperty('--writing-size', v.fontSize + 'px');
  root.style.setProperty('--writing-leading', String(v.lineHeight));
  root.style.setProperty(
    '--writing-font',
    v.font === 'sans' ? 'Arial, sans-serif' : 'Georgia, serif',
  );
  root.classList.toggle('large-targets', v.largeTargets);
  root.classList.toggle('reduce-motion', v.reducedMotion);
}
export function storeAccessibility(v: Accessibility) {
  try {
    localStorage.setItem('feder.accessibility', JSON.stringify(v));
  } catch {
    /* locally usable */
  }
}
