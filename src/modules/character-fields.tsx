import {
  characterRoles,
  emptyCharacter,
  type CharacterProfile,
  type CharacterRole,
} from '../core/characters';
export function CharacterFields({
  value,
  change,
}: {
  value?: CharacterProfile;
  change: (v: CharacterProfile) => void;
}) {
  const profile = value || emptyCharacter;
  return (
    <fieldset className="character-fields">
      <legend>Figurenprofil</legend>
      <p className="muted small">
        Alle Angaben sind optional. Der Kartenname bleibt der Anzeigename;
        vollständiger Name und Spitzname helfen der Texterkennung.
      </p>
      <div className="character-grid">
        {(
          [
            ['firstName', 'Vorname'],
            ['lastName', 'Nachname'],
            ['nickname', 'Spitzname'],
            ['age', 'Alter'],
            ['title', 'Titel / Anrede'],
            ['faction', 'Fraktion'],
          ] as const
        ).map(([key, label]) => (
          <label className="field-label" key={key}>
            {label}
            <input
              value={profile[key]}
              onChange={(e) => change({ ...profile, [key]: e.target.value })}
            />
          </label>
        ))}
        {[0, 1].map((i) => (
          <label className="field-label" key={i}>
            {i === 0 ? 'Einordnung' : 'Weitere Einordnung'}
            <select
              value={profile.roles[i] || ''}
              disabled={i === 1 && !profile.roles[0]}
              onChange={(e) => {
                const roles = [...profile.roles];
                roles[i] = e.target.value as CharacterRole;
                change({
                  ...profile,
                  roles: [...new Set(roles.filter(Boolean))],
                });
              }}
            >
              <option value="">Keine Einordnung</option>
              {characterRoles.map((r) => (
                <option
                  key={r}
                  value={r}
                  disabled={profile.roles.includes(r) && profile.roles[i] !== r}
                >
                  {r}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
