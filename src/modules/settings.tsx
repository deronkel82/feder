import { SyncPanel } from '../sync/panel';
import type { DriveSync } from '../sync/use-drive-sync';
import { AccessibilityFields } from './accessibility';
import type { Accessibility } from '../core/accessibility';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { DefaultAuthorSettings } from './authors';
import { schemes, type Scheme } from '../core/themes';
import { isOther } from '../core/project-format';
import { modules } from './registry';
import type { Project, Library } from '../core/model';
import { ReleaseHistory } from './release-history';

export function SettingsDialog({
  initialSection,
  sync,
  open,
  setOpen,
  library,
  setLibrary,
  project,
  update,
  dark,
  setDark,
  scheme,
  setScheme,
  error,
  onModuleDisabled,
  accessibility,
  setAccessibility,
}: {
  initialSection: string;
  sync: DriveSync;
  accessibility: Accessibility;
  setAccessibility: (v: Accessibility) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  scheme: Scheme;
  setScheme: (v: Scheme) => void;
  error: boolean;
  onModuleDisabled: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="settings-dialog atelier-settings">
        <DialogTitle>Einstellungen</DialogTitle>
        <DialogDescription>
          Gestalte deinen Schreibplatz. Darstellung und Autor gelten
          projektübergreifend, Module für das geöffnete Projekt.
        </DialogDescription>
        <Tabs key={initialSection + String(open)} defaultValue={initialSection}>
          <TabsList className="settings-tabs" aria-label="Einstellungsbereiche">
            <TabsTrigger value="appearance">Darstellung</TabsTrigger>
            <TabsTrigger value="author">Autor</TabsTrigger>
            <TabsTrigger value="modules">Module</TabsTrigger>
            <TabsTrigger value="sync">Sync</TabsTrigger>
            <TabsTrigger value="app">App & Daten</TabsTrigger>
          </TabsList>
          <TabsContent value="appearance" className="settings-panel">
            <h2>Dein Schreibplatz</h2>
            <p className="muted">
              Änderungen sind sofort sichtbar und werden auf diesem Gerät
              gemerkt.
            </p>
            <div className="settings-row">
              <span>
                <strong>Dunkelmodus</strong>
                <small>Funktioniert mit jedem Farbschema.</small>
              </span>
              <Switch
                checked={dark}
                onCheckedChange={setDark}
                aria-label="Dunkelmodus"
              />
            </div>
            <fieldset className="scheme-picker">
              <legend>Farbschema</legend>
              <div className="scheme-grid">
                {schemes.map((s) => (
                  <label
                    className={`scheme-option ${scheme === s.id ? 'selected' : ''}`}
                    key={s.id}
                  >
                    <input
                      type="radio"
                      name="color-scheme"
                      value={s.id}
                      checked={scheme === s.id}
                      onChange={() => setScheme(s.id)}
                    />
                    <span
                      className="scheme-preview"
                      aria-hidden="true"
                      style={{ background: s[dark ? 'dark' : 'light'][0] }}
                    >
                      <span
                        style={{ background: s[dark ? 'dark' : 'light'][4] }}
                      />
                      <span
                        style={{
                          background: s[dark ? 'dark' : 'light'][1],
                          color: s[dark ? 'dark' : 'light'][2],
                        }}
                      >
                        Aa
                      </span>
                    </span>
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <AccessibilityFields
              value={accessibility}
              change={setAccessibility}
            />
          </TabsContent>
          <TabsContent value="author" className="settings-panel">
            <h2>Autor & Pseudonym</h2>
            <DefaultAuthorSettings
              library={library}
              setLibrary={setLibrary}
              disabled={error}
            />
          </TabsContent>
          <TabsContent value="modules" className="settings-panel">
            <h2>Werkzeuge für „{project.title}“</h2>
            <p className="muted">
              Deine Inhalte bleiben beim Abschalten erhalten.
            </p>
            {isOther(project) ? (
              <p>
                „Sonstiges“ bietet bewusst nur Titel und Text. Für weitere
                Werkzeuge kannst du die Projektart in der Projektverwaltung
                ändern.
              </p>
            ) : (
              modules
                .filter((m) => !m.core)
                .map((m) => (
                  <div className="settings-row" key={m.id}>
                    <span>
                      <strong>{m.label}</strong>
                      <small>{m.description}</small>
                    </span>
                    <Switch
                      disabled={error}
                      checked={project.enabled.includes(m.id)}
                      onCheckedChange={(checked) => {
                        update((p) => ({
                          ...p,
                          enabled: checked
                            ? [...new Set([...p.enabled, m.id])]
                            : p.enabled.filter((id) => id !== m.id),
                        }));
                        if (!checked) onModuleDisabled(m.id);
                      }}
                      aria-label={m.label}
                    />
                  </div>
                ))
            )}
          </TabsContent>
          <TabsContent value="sync" className="settings-panel">
            <SyncPanel sync={sync} />
          </TabsContent>
          <TabsContent value="app" className="settings-panel">
            <h2>App & Daten</h2>
            <section className="settings-info">
              <h3>Auf den Homescreen</h3>
              <p>
                Auf iPhone und iPad in Safari: Teilen → Zum Home-Bildschirm →
                Als Web-App öffnen. Nach dem ersten vollständigen Laden kannst
                du offline schreiben.
              </p>
            </section>
            <section className="settings-info">
              <h3>Lokal gespeichert</h3>
              <p>
                Projekte werden lokal gespeichert. Optional gleicht Google Drive
                sie mit deinen anderen Geräten ab. Lade unter „Projekte &
                Export“ regelmäßig eine komplette JSON-Sicherung herunter. Dort
                kannst du sie auch auf einem anderen Gerät importieren.
              </p>
            </section>
            <section className="settings-info">
              <h3>Updates</h3>
              <p>
                Über die Versionsanzeige in der oberen Leiste kannst du Updates
                prüfen und installieren. Vor dem Neustart wird deine Arbeit
                gesichert.
              </p>
              <ReleaseHistory />
            </section>
            <section className="settings-info">
              <h3>Lizenzen & Quellen</h3>
              <p>
                Feder verwendet freie Software und OpenThesaurus-Wortdaten mit
                eigenen Lizenzbedingungen.
              </p>
              <a href="./licenses.html" target="_blank" rel="noreferrer">
                Lizenztexte und Urheberhinweise öffnen
              </a>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
