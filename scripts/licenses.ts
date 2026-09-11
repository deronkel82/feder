import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

// Read the actual bundle, including transitive packages, instead of a fixed dependency list.
export function licenseNotices(): Plugin {
  return {
    name: 'feder-license-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const roots = new Set<string>();
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        for (const id of Object.keys(file.modules)) {
          if (!id.includes('/node_modules/')) continue;
          let dir = dirname(id.split('?')[0]);
          while (dir.includes('node_modules')) {
            const manifest = join(dir, 'package.json');
            if (
              existsSync(manifest) &&
              JSON.parse(readFileSync(manifest, 'utf8')).name
            ) {
              roots.add(dir);
              break;
            }
            dir = dirname(dir);
          }
        }
      }
      // CSS imports and copied shadcn UI components are not all represented by JS chunks.
      for (const name of ['tailwindcss', 'tw-animate-css', 'shadcn'])
        roots.add(resolve('node_modules', name));
      const packages = [...roots]
        .map((root) => {
          const pkg = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
          );
          const files = readdirSync(root, { withFileTypes: true })
            .filter(
              (f) =>
                f.isFile() &&
                /^(licen[sc]e|copying|notice|copyright)(\.|$|-)/i.test(f.name),
            )
            .map((f) => ({
              name: f.name,
              text: readFileSync(join(root, f.name), 'utf8'),
            }));
          if (!files.some((f) => /^(licen[sc]e|copying)(\.|$|-)/i.test(f.name)))
            this.error(
              `Lizenztext fehlt: ${pkg.name}@${pkg.version}. Bitte vor Veröffentlichung prüfen.`,
            );
          return {
            name: pkg.name as string,
            version: pkg.version as string,
            license: pkg.license,
            files,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      const own = readFileSync('LICENSE', 'utf8');
      const thesaurus = readFileSync(
        'public/OPENTHESAURUS-LICENSE.txt',
        'utf8',
      );
      const credits = readFileSync('THIRD_PARTY.md', 'utf8');
      const text = [
        'Feder – Lizenzen und Drittanbieterhinweise',
        own,
        credits,
        ...packages.map(
          (p) =>
            `${p.name} ${p.version} (${p.license})\n${p.files.map((f) => `${f.name}\n${f.text}`).join('\n\n')}`,
        ),
        'OpenThesaurus – mitgelieferte Lizenztexte\n' + thesaurus,
      ].join('\n\n' + '='.repeat(72) + '\n\n');
      const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Feder – Lizenzen</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:24px;color:#27343b;background:#f5f6f7}a{color:#235b62}h1,h2{line-height:1.25}summary{cursor:pointer;padding:12px 0;min-height:24px}details{border-bottom:1px solid #98aaaf}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace}a:focus-visible,summary:focus-visible{outline:3px solid #3f858f;outline-offset:3px}@media(prefers-color-scheme:dark){body{background:#152026;color:#dde6e9}a{color:#9bccce}}</style>
<a href="./">← Zurück zu Feder</a><h1>Lizenzen &amp; Quellen</h1>
<p>Feder verwendet freie Software und die Wortdaten von OpenThesaurus. Die jeweiligen Lizenzbedingungen und Urhebervermerke bleiben erhalten.</p>
<p><a href="./THIRD-PARTY-LICENSES.txt" download>Alle Lizenztexte herunterladen</a> · <a href="https://github.com/deronkel82/feder">Quellcode</a></p>
<h2>Feder</h2><details><summary>MIT-Lizenz für den App-Code</summary><pre>${escape(own)}</pre></details>
<h2>OpenThesaurus</h2><p>Wortdaten: © 2003–2025 Daniel Naber. Quelle: <a href="https://www.openthesaurus.de/about/download">OpenThesaurus</a>, Export vom 04.09.2026; am 05.09.2026 in ein separat austauschbares JSON-Format umgewandelt. Begriffe und Anmerkungen wurden beibehalten. Die Daten werden unter LGPL 2.1 oder später weitergegeben; die MIT-Lizenz der App ersetzt diese Lizenz nicht.</p>
<p><a href="./thesaurus.json" download>Verwendete Wortdaten herunterladen</a> · <a href="./OPENTHESAURUS-LICENSE.txt">Originale Lizenzdatei</a></p><details><summary>Mitgelieferte Lizenztexte ansehen</summary><pre>${escape(thesaurus)}</pre></details>
<h2>Softwarebibliotheken</h2><p>Versionen und vollständige Lizenz- und Urheberhinweise der Bibliotheken dieses Builds einschließlich der verwendeten UI- und CSS-Grundlagen.</p>
${packages.map((p) => `<details><summary>${escape(p.name)} · ${escape(p.version)} · ${escape(String(p.license || 'siehe Lizenztext'))}</summary>${p.files.map((f) => `<h3>${escape(f.name)}</h3><pre>${escape(f.text)}</pre>`).join('')}</details>`).join('\n')}
<h2>Optionaler Google-Dienst</h2><p>Bei der Drive-Anmeldung wird Google Identity Services direkt von Google geladen. Dieser externe Dienst gehört nicht zur MIT-Lizenz von Feder. <a href="https://developers.google.com/terms">Google API-Nutzungsbedingungen</a> · <a href="./privacy.html">Datenschutzhinweise</a></p></html>`;
      this.emitFile({ type: 'asset', fileName: 'licenses.html', source: html });
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD-PARTY-LICENSES.txt',
        source: text,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'license-manifest.json',
        source: JSON.stringify(
          packages.map(({ name, version, license, files }) => ({
            name,
            version,
            license,
            files: files.map((f) => f.name),
          })),
          null,
          2,
        ),
      });
    },
  };
}
