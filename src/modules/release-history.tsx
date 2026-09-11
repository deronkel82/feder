import releases from '../core/releases.json';

export function ReleaseHistory() {
  return (
    <details className="release-history">
      <summary>
        Versionshistorie{' '}
        <span className="muted">· {releases.length} Versionen</span>
      </summary>
      <p className="muted small">
        Alle bisherigen Veröffentlichungen, neueste zuerst. Änderungen werden
        mit jedem App-Update ergänzt.
      </p>
      {releases.map((release, index) => (
        <details
          className="release-entry"
          key={release.version}
          open={index === 0}
        >
          <summary aria-label={release.version + ' · ' + release.title}>
            <span className="release-heading">
              <strong>
                {release.version} · {release.title}
              </strong>
              <span className="muted small">
                <time dateTime={release.date}>
                  {release.date.split('-').reverse().join('.')}
                </time>
                {index === 0 && ' · Installierte Version'}
              </span>
            </span>
          </summary>
          <ul>
            {release.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </details>
      ))}
    </details>
  );
}
