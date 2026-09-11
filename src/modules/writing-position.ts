import { useLayoutEffect, type RefObject } from 'react';
import { validPosition, type ReadingPosition } from '../core/workbench.ts';
export function readPosition(projectId: string): ReadingPosition | null {
  try {
    const p = JSON.parse(
      localStorage.getItem('feder.position.' + projectId) || 'null',
    );
    return validPosition(p) ? p : null;
  } catch {
    return null;
  }
}
export function useWritingPosition(
  projectId: string,
  sceneId: string,
  visible: boolean,
  editor: RefObject<HTMLTextAreaElement | null>,
) {
  useLayoutEffect(() => {
    const node = editor.current;
    if (!node || !visible) return;
    const saved = readPosition(projectId);
    const scroller = node.closest('.manuscript');
    if (saved?.sceneId === sceneId) {
      node.setSelectionRange(
        Math.min(saved.start, node.value.length),
        Math.min(saved.end, node.value.length),
      );
      scroller?.scrollTo({ top: saved.scroll });
      node.scrollTo({ top: saved.textScroll || 0 });
    }
    const capture = () => {
      const position: ReadingPosition = {
        sceneId,
        start: node.selectionStart,
        end: node.selectionEnd,
        scroll: scroller?.scrollTop || 0,
        textScroll: node.scrollTop,
        date: new Date().toISOString(),
      };
      try {
        localStorage.setItem(
          'feder.position.' + projectId,
          JSON.stringify(position),
        );
      } catch {
        /* optional local preference */
      }
    };
    capture();
    node.addEventListener('scroll', capture, { passive: true });
    node.addEventListener('select', capture);
    node.addEventListener('input', capture);
    node.addEventListener('blur', capture);
    scroller?.addEventListener('scroll', capture, { passive: true });
    window.addEventListener('pagehide', capture);
    return () => {
      node.removeEventListener('scroll', capture);
      node.removeEventListener('select', capture);
      node.removeEventListener('input', capture);
      node.removeEventListener('blur', capture);
      scroller?.removeEventListener('scroll', capture);
      window.removeEventListener('pagehide', capture);
    };
  }, [projectId, sceneId, visible, editor]);
}
