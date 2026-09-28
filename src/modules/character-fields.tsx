import {
  characterRoles,
  emptyCharacter,
  type CharacterProfile,
  type CharacterRole,
} from '../core/characters';
import { useEffect, useRef, useState } from 'react';
import { readPortrait } from './portrait-image';
export function CharacterFields({
  value,
  change,
}: {
  value?: CharacterProfile;
  change: (v: CharacterProfile) => void;
}) {
  const profile = value || emptyCharacter;
  const latest = useRef(profile);
  useEffect(() => {
    latest.current = profile;
  }, [profile]);
  const [imageError, setImageError] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <fieldset className="character-fields">
      <legend>Figurenprofil</legend>
      <p className="muted small">
        Alle Angaben sind optional. Der Kartenname bleibt der Anzeigename;
        vollständiger Name und Spitzname helfen der Texterkennung.
      </p>
      <div className="portrait-editor">
        {profile.portrait && (
          // Portraits are local data URLs already resized to 256px.
          // oxlint-disable-next-line next/no-img-element
          <img src={profile.portrait} alt="Profilbild der Figur" />
        )}
        <label className="field-label">
          PROFILBILD
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={loading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setLoading(true);
              setImageError('');
              try {
                const portrait = await readPortrait(file);
                change({ ...latest.current, portrait });
              } catch (error) {
                setImageError(
                  error instanceof Error
                    ? error.message
                    : 'Bild konnte nicht geladen werden.',
                );
              } finally {
                setLoading(false);
              }
            }}
          />
          <small>Quadratischer Ausschnitt, platzsparend gespeichert.</small>
        </label>
        {profile.portrait && (
          <button
            type="button"
            onClick={() => change({ ...profile, portrait: undefined })}
          >
            Bild entfernen
          </button>
        )}
        {loading && <output>Bild wird vorbereitet …</output>}
        {imageError && <output role="alert">{imageError}</output>}
      </div>
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
