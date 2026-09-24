import type { Project, Scene } from '../core/model';
import {
  manuscriptCounts,
  sceneCounts,
  usesScenes,
} from '../core/project-format';

export function ManuscriptCounter({
  project,
  scene,
}: {
  project: Project;
  scene: Scene;
}) {
  const total = manuscriptCounts(project);
  const current = sceneCounts(scene);
  const count = (value: { words: number; characters: number }) =>
    `${value.words.toLocaleString('de')} Wörter · ${value.characters.toLocaleString('de')} Zeichen`;
  return (
    <div
      className="manuscript-counter"
      aria-label="Wort- und Zeichenzähler"
      title="Manuskripttext einschließlich Leerzeichen und Absatzumbrüchen. Ohne Titel und Notizen; zwischen nichtleeren Textabschnitten zählen zwei Absatzumbrüche."
    >
      <span>
        <strong>Gesamt:</strong> {count(total)}
      </span>
      {project.scenes.length > 1 && (
        <span>
          {usesScenes(project) ? 'Szene' : 'Kapitel'}: {count(current)}
        </span>
      )}
      <span className="muted">Zeichen inkl. Leerzeichen</span>
    </div>
  );
}
