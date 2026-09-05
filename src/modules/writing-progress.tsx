import type { Project } from '../core/model';
import { progressLimits, isShort } from '../core/project-format';
import { Progress } from '@/components/ui/progress';
export function WritingProgress({ project }: { project: Project }) {
  const c = progressLimits(project);
  const fmt = (n: number) => n.toLocaleString('de');
  return (
    <div className="writing-progress">
      <div className="goal-heading">
        <span>
          {isShort(project) ? 'Deine Wettbewerbsgrenzen' : 'Dein Text wächst'}
        </span>
      </div>
      <div className={c.wordExceeded ? 'limit-exceeded' : ''}>
        <small>
          {fmt(c.words)}
          {c.wordActive ? ' / ' + fmt(project.target) : ''} Wörter
          {c.wordExceeded
            ? ' · ' + fmt(c.words - project.target) + ' über Limit'
            : ''}
        </small>
        {c.wordActive && (
          <Progress
            aria-label="Wörter"
            value={Math.min(100, (c.words / project.target) * 100)}
          />
        )}
      </div>
      <div className={c.charExceeded ? 'limit-exceeded' : ''}>
        <small>
          {fmt(c.characters)}
          {project.charTarget ? ' / ' + fmt(project.charTarget) : ''} Zeichen
          {c.charExceeded
            ? ' · ' + fmt(c.characters - project.charTarget!) + ' über Limit'
            : ''}
        </small>
        {!!project.charTarget && (
          <Progress
            aria-label="Zeichen"
            value={Math.min(100, (c.characters / project.charTarget) * 100)}
          />
        )}
      </div>
      <small className="muted">Zeichen inkl. Leerzeichen</small>
    </div>
  );
}
