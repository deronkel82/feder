import { words } from '../core/model.ts';
export type Finding = {
  kind: string;
  message: string;
  start: number;
  end: number;
};
export function analyze(text: string) {
  const findings: Finding[] = [];
  for (const m of text.matchAll(
    /\b(eigentlich|irgendwie|sozusagen|gewissermaßen|quasi|halt|eben|wirklich|ziemlich)\b/giu,
  )) {
    findings.push({
      kind: 'Füllwort',
      message: `„${m[0]}“: Braucht dieser Satz die Abschwächung?`,
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }
  for (const m of text.matchAll(/[^.!?\n]+[.!?]?/gu)) {
    const n = words(m[0]);
    if (n > 28)
      findings.push({
        kind: 'Langer Satz',
        message: `${n} Wörter. Lässt sich der Gedanke auf zwei Sätze verteilen?`,
        start: m.index!,
        end: m.index! + m[0].length,
      });
  }
  const seen = new Map<string, number>();
  for (const m of text.matchAll(/[\p{L}]{5,}/gu)) {
    const w = m[0].toLocaleLowerCase('de');
    const previous = seen.get(w);
    if (previous !== undefined && m.index! - previous < 180)
      findings.push({
        kind: 'Wiederholung',
        message: `„${m[0]}“ kommt in kurzer Folge erneut vor.`,
        start: m.index!,
        end: m.index! + m[0].length,
      });
    seen.set(w, m.index!);
  }
  return findings.sort((a, b) => a.start - b.start);
}
