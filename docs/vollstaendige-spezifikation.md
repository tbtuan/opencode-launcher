# OpenCode Launcher — Vollständige Spezifikation

> Dieses Dokument beschreibt jede Funktion, jede Interaktion, jedes Styles und jedes Verhalten des OpenCode Launcher bis ins kleinste Detail. Grundlage für die Migration zu React + Vite + CSS Modules.

---

## 1. Projektübersicht

**Typ:** Electron-Desktop-App  
**Zweck:** Tab-basierter Launcher für mehrere OpenCode-CLI-Terminalsitzungen  
**Stack:** Electron + xterm.js + node-pty + CodeMirror 5  
**Shell:** Eigenes Fenster, keine Menüleiste (Menu.setApplicationMenu(null))

### 1.1 Dateistruktur

```
opencode-launcher/
├── main.js                          # Electron-Hauptprozess
├── preload.js                       # Context-Bridge für IPC
├── config.json                      # Persistente Konfiguration (im .gitignore)
├── package.json
├── renderer/
│   ├── index.html                   # HTML-Struktur
│   ├── app.js                       # Renderer-Logik (1335 Zeilen)
│   ├── styles.css                   # Komplette Styles (922 Zeilen)
│   ├── i18n.js                      # Internationalisierung
│   └── test.html                    # Xterm.js-Testseite
├── resources/
│   ├── en.json                      # Englische Übersetzungen (57 keys)
│   ├── de.json                      # Deutsche Übersetzungen (57 keys)
│   ├── flag-en.svg                  # UK-Flagge (SVG)
│   └── flag-de.svg                  # Deutschland-Flagge (SVG)
├── start.bat                        # Windows-Start (ruft start-hidden.vbs auf)
├── start.vbs                        # Windows-Start mit verstecktem Fenster
├── start-hidden.vbs                 # VBS-Skript, startet npm start unsichtbar
├── start.sh                         # Linux/macOS-Start (nohup)
├── test-main.js                     # Eigenständiger Test-HTML-Loader
└── README.md
```

### 1.2 Abhängigkeiten (package.json)

| Package | Version | Zweck |
|---------|---------|-------|
| electron | ^29.0.0 | Desktop-Framework |
| @xterm/xterm | ^6.0.0 | Terminal-Emulator |
| @xterm/addon-fit | ^0.11.0 | Auto-Resize für xterm |
| @xterm/addon-clipboard | ^0.2.0 | Clipboard-Addon |
| codemirror | ^5.65.21 | JSON-Editor |
| node-pty | ^1.0.0 | Echte PTY-Shell-Prozesse |
| @electron/rebuild | ^3.6.0 | Rebuild native modules |

---

## 2. Hauptprozess (main.js) — 300 Zeilen

### 2.1 Fenstererstellung

**createWindow():**
- Fenstergröße: 1200 × 800 Pixel
- Mindestgröße: 600 × 400 Pixel
- `backgroundColor: '#1e1e1e'` (kein weißer Flash beim Laden)
- `autoHideMenuBar: true` (Menüleiste standardmäßig ausgeblendet)
- `contextIsolation: true`, `nodeIntegration: false` (Sicherheit)
- Lädt `renderer/index.html`
- Beim Schließen: Alle PTY-Prozesse werden gekillt (`ptyProcesses.clear()`)
- Kein Application-Menü (`Menu.setApplicationMenu(null)`)

### 2.2 Config-Ladung/Speicherung

**loadConfig():**
- Liest `config.json` aus dem Projektverzeichnis
- Fallback: `{ directories: [] }`

**saveConfig(config):**
- Überschreibt `config.json` mit `JSON.stringify(data, null, 2)`

### 2.3 Modelle laden

**loadModels(refresh = false):**
- Führt `opencode models [--refresh] --verbose` als Child Process aus (15s Timeout)
- Parst die Ausgabe zeilenweise: sucht nach Headern mit Format `provider/model`
- Extrahiert JSON-Blöcke nach jedem Header
- Gibt Array `{ id, name, providerID }` zurück
- Bei Fehler: leeres Array

### 2.4 IPC-Handler (vollständige Liste)

#### config:load
- **Typ:** invoke/handle
- **Rückgabe:** Gesamte config.json als Objekt

#### config:save
- **Parameter:** config-Objekt
- **Rückgabe:** `{ ok: true }`

#### dialog:openFolder
- **Parameter:** lang (für Titel)
- **Öffnet:** natives Betriebssystem-Dialogfenster zur Ordnerauswahl
- **Titel:** "Verzeichnis auswählen" (de) / "Select Directory" (en)
- **Rückgabe:** Pfad oder null bei Abbruch

#### pty:create
- **Parameter:** `{ tabId, cwd, args }`
- **Shell-Auswahl:**
  - Windows: `pwsh.exe`
  - macOS: `/bin/zsh`
  - Linux: `$SHELL` oder `/bin/bash`
  - Fallback: `sh`
- **PTY-Settings:** `name: 'xterm-256color'`, cols 80, rows 24, cwd + env
- **onData:** Sendet `pty:data:{tabId}` an Renderer
- **onExit:** Sendet `pty:exit:{tabId}` mit Exit-Code, löscht aus Map
- **Auto-Start:** Nach 500ms wird `opencode {args}` in die PTY geschrieben
  - Sendet `opencode:started:{tabId}` Signal an Renderer
- Existierende PTY mit gleicher tabId wird vorher gekillt
- **Rückgabe:** `{ ok: true, pid }`

#### pty:write
- **Typ:** on (keine Rückgabe)
- **Parameter:** `{ tabId, data }`
- Schreibt Daten in die PTY

#### pty:resize
- **Typ:** on
- **Parameter:** `{ tabId, cols, rows }`
- Ändert PTY-Größe

#### pty:kill
- **Parameter:** `{ tabId }`
- Killt PTY-Prozess, löscht aus Map
- **Rückgabe:** `{ ok: true }`

#### models:list
- Gibt gecachte Modelle zurück, falls vorhanden
- Sonst: lädt einmalig und speichert Cache
- **Rückgabe:** `{ models, timestamp }`

#### models:refresh
- Lädt Modelle neu mit `--refresh`
- Aktualisiert Cache
- **Rückgabe:** `{ models, timestamp }`

#### app:restart
- Führt `app.relaunch()` + `app.exit()` aus

#### config:opencode:read
- Suchpfad für opencode.json:
  1. `OPENCODE_CONFIG` Umgebungsvariable
  2. `~/.config/opencode/opencode.json`
- Erstellt Verzeichnis falls nicht vorhanden
- Schreibt Minimal-JSON falls Datei nicht existiert: `{ "$schema": "https://opencode.ai/config.json" }`
- **Rückgabe:** `{ content, filePath }`

#### config:opencode:write
- **Parameter:** `{ content, filePath }`
- Validiert JSON vor dem Schreiben
- **Rückgabe:** `{ ok: true }` oder `{ ok: false, error }`

#### i18n:load
- **Parameter:** lang (z.B. "en", "de")
- Liest `resources/{lang}.json`
- **Rückgabe:** Geparstes JSON oder null

#### resource:read
- **Parameter:** filename
- Liest aus `resources/` Verzeichnis
- **Rückgabe:** File-Inhalt als String oder null

#### terminal-paste
- **Typ:** on
- **Parameter:** `{ tabId }`
- Liest Text aus der Zwischenablage (clipboard.readText())
- Sendet `paste-content:{tabId}` mit dem Text an Renderer

#### clipboard:write
- **Parameter:** text
- Schreibt Text in die Zwischenablage

#### fs:checkDirs
- **Parameter:** Array von Pfaden
- Prüft welche Verzeichnisse noch existieren
- **Rückgabe:** Array von Booleans

### 2.5 App-Lifecycle

**app.whenReady():**
- Menu.setApplicationMenu(null)
- createWindow()
- macOS: Bei `activate` neues Fenster wenn alle geschlossen

**window-all-closed:**
- Plattform ≠ darwin → app.quit()

---

## 3. Preload (preload.js) — 66 Zeilen

Exponiert `window.api` mit allen IPC-Kanälen via `contextBridge.exposeInMainWorld`.

### Vollständige API-Liste

| Methode | IPC-Typ | Beschreibung |
|---------|---------|-------------|
| `loadConfig()` | invoke | Lädt config.json |
| `saveConfig(config)` | invoke | Speichert config.json |
| `openFolder(lang)` | invoke | Native Ordnerauswahl |
| `listModels()` | invoke | Gecachte Modelle |
| `refreshModels()` | invoke | Modelle neuladen |
| `createPty(tabId, cwd, args)` | invoke | PTY erstellen |
| `killPty(tabId)` | invoke | PTY killen |
| `writePty(tabId, data)` | send | Daten an PTY |
| `resizePty(tabId, cols, rows)` | send | PTY-Größe ändern |
| `onPtyData(tabId, cb)` | on | Gibt Unsubscribe-Funktion zurück |
| `onPtyExit(tabId, cb)` | on | Gibt Unsubscribe-Funktion zurück |
| `restartApp()` | invoke | App neustarten |
| `loadI18n(lang)` | invoke | Übersetzungen laden |
| `readResource(filename)` | invoke | Ressource lesen |
| `readOpencodeConfig()` | invoke | opencode.json lesen |
| `writeOpencodeConfig(content, filePath)` | invoke | opencode.json schreiben |
| `triggerPaste(tabId)` | send | Hauptprozess liest Clipboard |
| `onPasteComplete(tabId, cb)` | on | Paste-Text erhalten |
| `onOpencodeStarted(tabId, cb)` | on | opencode-Start-Signal |
| `writeClipboard(text)` | invoke | In Zwischenablage schreiben |
| `checkDirectories(paths)` | invoke | Existenz-Prüfung |

---

## 4. Renderer (app.js) — 1335 Zeilen

### 4.1 State-Variablen

| Variable | Typ | Initialwert | Zweck |
|----------|-----|-------------|-------|
| `tabs` | Array | `[]` | Alle offenen Tabs |
| `activeId` | String | `'home'` | Aktiver Tab/Home |
| `tabCounter` | Number | `0` | Inkrementelle Tab-ID |
| `contextMenuTabId` | String\|null | `null` | Ziel-ID für Kontextmenü |
| `savedDirectories` | Array | `[]` | Gespeicherte Verzeichnisse |
| `dirIdCounter` | Number | `0` | Inkrementelle Verzeichnis-ID |
| `availableModels` | Array | `[]` | Modelle von opencode CLI |
| `modelsTimestamp` | String\|null | `null` | ISO-Timestamp der Modellliste |
| `savedTabOrder` | Array | `[]` | Reihenfolge der Tabs |
| `defaultTab` | String | `'home'` | Standard-Tab beim Start |
| `draggedTabId` | String\|null | `null` | Aktuell gezogener Tab |
| `editorTabId` | String\|null | `null` | ID des Editor-Tabs (nur einer) |
| `previewTerminals` | Map | `new Map()` | tabId → Preview-Objekte |
| `draggedCardPath` | String\|null | `null` | Aktuell gezogene Karte |
| `dragCounter` | Number | `0` | Drag-Zähler für Overlay |

### 4.2 Initialisierung (init())

**Ablauf:**

1. **Config laden:** `window.api.loadConfig()`
2. **ID-Migration:** Alten Verzeichnissen ohne `_id` wird eine vergeben; dirIdCounter wird aktualisiert
3. **Verzeichnis-Prüfung:** `checkDirectories()` — fehlende werden aus Config entfernt und persistiert
4. **Tab-Reihenfolge & Standard-Tab laden:** aus Config
5. **Migration alter defaultTab:** Falls ein Verzeichnis `defaultTab: true` hatte, wird es in das neue Format überführt
6. **Sprache erkennen/setzen:**
   - Config-Sprache (de/en) → i18n.setLanguage()
   - Sonst → navigator.language erkennen
   - Übersetzungen laden + anwenden
7. **SVG-Flaggen laden:** `resource:read('flag-de.svg')` + `flag-en.svg`
8. **Modelle laden:** `listModels()` → availableModels + Timestamp
9. **Karten rendern:** `renderCards()`
10. **Actions-Menü einrichten:** Klick-Handler für Button + Schließen bei externem Klick
11. **Actions-Buttons:**
    - "Modelle neu laden": lädt via `refreshModels()`, deaktiviert Button währenddessen, zeigt "Lade..."
    - "Neustarten": `restartApp()`
    - "Einstellungen": `showSettingsDialog()`
    - "Config bearbeiten": `openConfigEditor()`
12. **Auto-Launch:** Verzeichnisse mit `startOnLaunch: true` werden automatisch als Tab geöffnet (mit --continue falls aktiviert)
13. **Standard-Tab aktivieren:**
    - 'home' → Dashboard
    - Pfad → existierenden Tab finden oder neuen erstellen
    - Fallback: letzten Auto-Launch-Tab oder 'home'
14. **Tab-Reihenfolge anwenden:** `applyTabOrder(savedTabOrder)`

### 4.3 Pane-Aktivierung (activatePane)

**Parameter:** `id` (String)

**Verhalten:**
1. `activeId = id`
2. Alle `.content-pane` → `classList.remove('active')`
3. Wenn `id === 'home'`: Dashboard aktivieren
4. Sonst: Pane `#pane-{id}` aktivieren
5. **Bei Terminal-Tabs:**
   - Indicator-Zustand wiederherstellen (falls Processing, gelb bleiben, kein kurzzeitiges Grün)
   - Preview-Status synchronisieren
   - `suppressIndicator(500)` gegen falsche Processing-Erkennung
   - `requestAnimationFrame()` → `fitAddon.fit()`, `resizePty()`, `terminal.focus()`
6. **Bei Editor-Tabs:** `editor.refresh()` im nächsten Frame
7. `renderTabBar()` aufrufen

### 4.4 Dashboard-Karten

#### renderCards()
- Container `#cards-grid` leeren
- Wenn keine Verzeichnisse: `#no-dirs` einblenden mit Icon (📁), Text und Hinweis
- Für jedes Verzeichnis: Karte erstellen via `createCard(dir)`
- Drag & Drop für Karten-Reihenfolge:
  - `dragstart`: speichert `draggedCardPath`, setzt effectAllowed='move'
  - `dragover`: zeigt `.drag-over` Klasse
  - `drop`: Reihenfolge in `savedDirectories` ändern, persistConfig + neu rendern
  - `dragend`: Klassen entfernen
- Verhindert Drag während Einstellungsdialog offen ist oder Editor geöffnet ist

#### createCard(dir)

**HTML-Struktur:**
```html
<div class="dir-card" data-dir-id="{id}">
  <div class="dir-card-view">
    <div class="dir-card-icon">📁</div>
    <div class="dir-card-info">
      <div class="dir-card-name">{name}</div>
      <div class="dir-card-path">{path}</div>
      <div class="dir-card-desc">{description} oder "Keine Beschreibung" (kursiv)</div>
      <div class="dir-card-autolaunch">▶ Start on launch (optional)</div>
      <div class="dir-card-defaulttab">⭐ Standard-Tab (optional)</div>
    </div>
    <div class="dir-card-actions">
      <button class="dir-card-settings-btn">⚙</button>
      <button class="dir-card-play-btn">▶</button>
      <button class="dir-card-stop-btn hidden">■</button>
      <button class="dir-card-restart-btn hidden">↻</button>
    </div>
  </div>
  <div class="dir-card-model-section">
    <div class="dir-card-model-label">Bevorzugtes Modell</div>
    <select class="dir-card-model-select">
      <option>— Kein Modell ausgewählt —</option>
      <optgroup label="OpenCode">...</optgroup>
      <optgroup label="openai">...</optgroup>
    </select>
    <div class="dir-card-model-provider">Provider: ...</div>
  </div>
  <div class="dir-card-editor hidden">
    <!-- Inline-Editor -->
  </div>
</div>
```

**Modell-Select:**
- Optionen: "— Kein Modell ausgewählt —" (leerer Wert)
- Nach Provider gruppiert via `<optgroup>`
- Vorauswahl: `dir.model` (falls vorhanden)
- Bei Änderung: `dir.model` setzen, `persistConfig()`, Provider-Label updaten

**Button-Verhalten:** (siehe 4.5)

**Rechtsklick:** Kontextmenü mit "Kachel entfernen"

**Inline-Editor:**
- Felder: Name (Text), Beschreibung (Text), Start on Launch (Checkbox), Continue Session (Checkbox)
- Save: Werte übernehmen, Config persistieren, Karten neu rendern
- Cancel: Editor schließen ohne Änderungen
- Enter = Save, Escape = Cancel

**Drag-Einschränkung:** Während Editor offen ist, `draggable = false`

### 4.5 Karten-Aktionsbuttons

#### Settings-Button (⚙)
- Öffnet Inline-Editor (view → editor)
- Stoppt Event-Propagation

#### Play-Button (▶)
- Sichtbar wenn Tab NICHT läuft
- Ruft `openTerminalForDir(dir)` auf
- Stoppt Event-Propagation

#### Stop-Button (■)
- Sichtbar wenn Tab LÄUFT
- Schließt den zugehörigen Tab
- Stoppt Event-Propagation

#### Restart-Button (↻)
- Sichtbar wenn Tab LÄUFT
- Schließt alten Tab, öffnet neuen
- **Positionstreue:** Neuer Tab wird an gleicher Position in der Tab-Leiste eingefügt
- Alte Aktivität bleibt erhalten

### 4.6 Terminal öffnen (openTerminalForDir)

**Ablauf:**
1. Existierenden Tab für `dir._id` suchen → wenn vorhanden: `activatePane(existing.id)` und return
2. Command-Args bauen: `--model {dir.model}` (falls gesetzt) + `--continue` (falls aktiviert)
3. `createTab(dir.name, dir.path, args, dir._id)` aufrufen
4. Neuen Tab aktivieren

### 4.7 Ordner-Dialog (openFolderDialog → showSaveDialog)

**openFolderDialog:**
1. `window.api.openFolder(lang)` → natives OS-Dialog
2. Wenn Pfad: `showSaveDialog(pfad, Ordnername)`

**showSaveDialog:**
- Modal Overlay `#save-dialog-overlay` einblenden
- Pfad anzeigen, Name-Eingabe mit Default (Ordnername)
- Name-Input fokussieren + selektieren

**Vier Buttons:**

| Button | Text (de) | Text (en) | Aktion |
|--------|-----------|-----------|--------|
| Yes | Speichern & Öffnen | Save & Open | Speichert Verzeichnis + öffnet Tab |
| Save Only | Nur speichern | Save Only | Speichert Verzeichnis nur |
| No | Nur öffnen | Open Only | Öffnet Tab ohne zu speichern |
| Cancel | Abbrechen | Cancel | Schließt Dialog |

**Tastatur:**
- Enter → Yes (Save & Open)
- Escape → Cancel

**replaceListener:** Entfernt alte Event-Listener durch Klonen + Ersetzen (verhindert Mehrfach-Bindungen)

### 4.8 Tab-Erstellung (createTab) — Herzstück

**Parameter:** `name, cwd, args = '', dirId = null`
**Rückgabe:** `id` (z.B. `tab-5`)

**Ablauf:**

1. **Pane erzeugen:** `<div class="content-pane terminal-pane" id="pane-{id}">`
2. **Pane kurz aktiv schalten** (damit xterm messen kann)
3. **Xterm erstellen:**
   - **Theme (VS Code Dark):**
     - Hintergrund: `#1e1e1e`
     - Vordergrund: `#cccccc`
     - Cursor: `#ffffff`
     - Selection: `rgba(0,122,204,0.3)`
     - 16 ANSI-Farben passend zu VS Code Dark+
   - **Font:** `'Cascadia Code', 'Fira Code', 'Consolas', monospace`, Größe 13
   - **lineHeight:** 1.3
   - **cursorBlink:** true
   - **scrollback:** 5000
4. **FitAddon laden + fit() aufrufen**
5. **Pane wieder unsichtbar schalten** (activatePane regelt Sichtbarkeit)

#### Processing/Idle-Erkennung

**Zustandsvariablen:**
- `writeIdleTimeout` — Timeout-Handle (200ms Debounce nach jedem Write)
- `isUserAction` — Boolean, blockiert Processing-Erkennung
- `isProcessing` — Boolean, aktueller Status
- `isOpenCodeStarting` — Boolean, Startup-Phase
- `recentInputSize` — Erfasste Benutzereingabe-Größe
- `inputTimeout` — Resetto 500ms nach letzter Eingabe

**suppressIndicator(ms = 300):**
- Setzt `isUserAction = true`
- Nach `ms` Millisekunden: `isUserAction = false`

**Processing-Erkennung (onPtyData):**
- **Während OpenCode-Startup:** Immer Processing (gelb)
- **Nach Startup:** Nur Processing wenn:
  - `!isUserAction` UND
  - `data.length > 100` ODER `data.length > recentInputSize * 1.5`
- Das unterscheidet echte Shell-Ausgabe von Echo

**setProcessing():**
- `isProcessing = true`
- Tab-Indicator: `.active` Klasse hinzufügen → gelbe Farbe + Puls-Animation
- Preview-Status: `.preview-active` Klasse + Text "In Bearbeitung"

**setIdle():**
- Blockiert wenn `isOpenCodeStarting` (bleibt gelb)
- `isProcessing = false`
- Tab-Indicator: `.active` Klasse entfernen → grüne Farbe
- Preview-Status: `.preview-active` entfernen + Text "Bereit"

**writeIdleTimeout:**
- `onWriteParsed`-Event → clear + 200ms setTimeout auf `setIdle()`
- Dadurch wird kurz nach dem letzten Datenempfang auf Idle geschaltet

**User-Tracking:**
- `terminal.onKey()` → `suppressIndicator(300)` — Tastatureingabe blockiert Verarbeitungs-Anzeige für 300ms
- `wheel`-Event auf terminal.element → `suppressIndicator(500)` — Scrollen blockiert für 500ms
- `terminal.onData()` → `recentInputSize += data.length`, Reset nach 500ms

#### OpenCode Startup-Erkennung

**Signal:** `onOpencodeStarted(id)` vom Hauptprozess (500ms nach PTY-Erstellung)

**Ablauf:**
1. `isOpenCodeStarting = true`
2. `setProcessing()` → gelb
3. **TUI-Readiness-Polling (200ms Intervall):**
   - Prüft: `buffer.cursorY >= rows - 3` (Cursor am unteren Ende)
   - Prüft: ≥ 50% der Zeilen haben Inhalt
   - Beides erfüllt → Intervall stoppen, `isOpenCodeStarting = false`
4. **Fallback-Timeout: 5000ms** → Intervall stoppen, `isOpenCodeStarting = false`

#### Event-Handler

**onPtyData(id, data):**
- `terminal.write(data)` — Ausgabe im Hauptterminal
- Processing-Logik (siehe oben)
- `previewTerminals.get(id)` → `preview.terminal.write(data)` — auch im Preview

**onPtyExit(id, code):**
- Tab-Status auf `'stopped'` setzen
- Display-Namen neu berechnen
- Gelbe Meldung im Terminal: `[Process exited with code {code}]`

**terminal.onData(data):**
- `window.api.writePty(id, data)` — Benutzereingabe an PTY senden

#### Custom Key Handler

**Ctrl+C (mit Selektion):**
- `terminal.hasSelection()` → `writeClipboard(selection)` → `return false` (Kein SIGINT)

**Ctrl+V:**
- `triggerPaste(id)` → Hauptprozess liest Clipboard → `paste-content:{id}` zurück
- Prevent native Paste: Der versteckte Textarea von xterm blockiert paste-Events (capture: true)

**onPasteComplete(id, text):**
- `suppressIndicator(1000)` — Paste blockiert Verarbeitung für 1s
- `terminal.input('\x1b[200~' + text + '\x1b[201~')` — Bracketed Paste Mode

#### Tab-Objekt

```javascript
{
  id: String,          // "tab-{counter}"
  name: String,        // Verzeichnisname
  displayName: String, // Bei Mehrfachinstanzen: "name (1)"
  cwd: String,         // Arbeitsverzeichnis
  dirId: Number|null,  // Verknüpfung mit savedDirectory
  terminal,            // xterm.js Instanz
  fitAddon,            // FitAddon Instanz
  type: undefined,     // undefined für Terminal-Tabs
  isProcessing: () => Boolean,
  status: 'stopped'|'running'|'error',
  // Unsubscribe-Funktionen:
  unsubData, unsubExit, unsubAll, unsubPaste,
  suppressIndicator(ms)
}
```

**Nach PTY-Erstellung:**
- Status → `'running'`
- Display-Namen aktualisieren
- `resizePty()` aufrufen
- Nach 100ms: `createPreviewTerminal(tabObj)`
- `setProcessing()` → sofort gelb (Processing-Start)

**Bei Fehler:**
- Status → `'error'`
- Rote Fehlermeldung im Terminal

### 4.9 Config Editor (CodeMirror)

**openConfigEditor():**
- Prüft ob Editor-Tab bereits existiert → dann aktivieren
- Liest opencode.json via `readOpencodeConfig()`
- Erstellt Editor-Tab via `createEditorTab(content, filePath)`
- Nur ein Editor-Tab gleichzeitig (editorTabId)

**createEditorTab(content, filePath):**
- CodeMirror 5 mit:
  - `mode: { name: 'javascript', json: true }`
  - `theme: 'default'` (aber via CSS komplett dunkel gestylt)
  - `lineNumbers: true`
  - `indentUnit: 2`, `tabSize: 2`
  - `indentWithTabs: true`
  - `matchBrackets: true`
  - `styleActiveLine: true`
  - `viewportMargin: Infinity`
  - `extraKeys: { 'Ctrl-S': save }`
- Höhe: `100%`
- Tab-Objekt: `{ type: 'editor', filePath, content, editor, isDirty: false, status: 'running' }`
- **Change-Tracking:** Bei jeder Änderung → `isDirty` vergleichen, bei Änderung `renderTabBar()` (zeigt dann `* ` vor Dateinamen)

**handleEditorSave(id):**
- `editor.getValue()` holen
- `writeOpencodeConfig(content, filePath)` → bei Erfolg `isDirty = false`, `tab.content = content`

### 4.10 Tab-Reihenfolge

**applyTabOrder(order):**
- Sortiert `tabs[]` basierend auf der gespeicherten Reihenfolge der `cwd`-Pfade
- Fehlende Pfade → hinten (Index 999)

**persistTabOrder():**
- Nach Drag & Drop: speichert `tabs.map(t => t.cwd)` in Config

### 4.11 Tab-Bar (renderTabBar)

**Home-Tab:** `#tab-home`, Aktiv-Status via `classList.toggle`

**Jeder Tab:**
```html
<div class="tab {status} {active}" data-id="{id}">
  <div class="tab-indicator"></div>  <!-- oder für Editor: .tab-editor-icon ✎ -->
  <span class="tab-label" title="{fullPath}">
    {dirty ? '* ' : ''}{displayName || name}
  </span>
  <button class="tab-close">×</button>
</div>
```

**Interaktionen:**
- Klick auf Tab → `activatePane(id)` (außer auf Close-Button)
- Klick auf Close → `closeTab(id)` mit stopPropagation
- Rechtsklick → Kontextmenü (siehe 4.12)
- Drag & Drop:
  - `dragstart`: `draggedTabId` setzen, `.dragging` Klasse
  - `dragover`: `.drag-over` Klasse (mit `-2px box-shadow accent`)
  - `drop`: Reihenfolge in `tabs[]` ändern, neu rendern, Reihenfolge persistieren
  - `dragend`: Klassen entfernen
- Verhindert Drag während Einstellungsdialog offen ist

**Card-Button-Sync:** Nach jedem Rendern werden die Button-Zustände aller Karten aktualisiert

### 4.12 Tab schließen (closeTab)

**Parameter:** `id`

**Editor-Tab:**
1. Pane entfernen
2. `editorTabId = null` falls gleich
3. Aus `tabs[]` entfernen

**Terminal-Tab:**
1. Alle Listener deabonnieren: `unsubData()`, `unsubExit()`, `unsubAll()`, `unsubPaste()`
2. PTY killen: `window.api.killPty(id)`
3. Terminal disposen: `tab.terminal.dispose()`
4. Pane entfernen
5. Preview entfernen: `removePreviewTerminal(id)`
6. Aus `tabs[]` entfernen
7. Display-Namen neu berechnen

**Aktivitäts-Wechsel:**
- Falls `activeId === id`:
  - Wenn noch Tabs existieren: den vorherigen oder nächsten Tab aktivieren
  - Sonst: Home (`'home'`) aktivieren
- Sonst: nur Tab-Bar neu rendern

### 4.13 Kontextmenü

**showContextMenu(x, y, targetId, type):**
- Setzt `contextMenuTabId = targetId`
- Filtert Einträge basierend auf Typ (tab/editor/card):
  - Editor: "Speichern" + Trenner + "Tab schließen"
  - Tab: "Umbenennen" + "Verzeichnis ändern" + "Neustart" + Trenner + "Tab schließen"
  - Card: "Kachel entfernen"
- Positioniert bei Mausposition
- **Out-of-Bounds-Schutz:** im nächsten Frame prüfen; falls rechts/links ragt → umkehren

**hideContextMenu():**
- `.hidden` Klasse + `contextMenuTabId = null`
- Wird aufgerufen bei:
  - Klick außerhalb des Menüs
  - Escape-Taste

**Menu-Einträge im Detail:**

| ID | Typen | Aktion |
|----|-------|--------|
| ctx-save | editor | `handleEditorSave(id)` |
| ctx-rename | tab | Label durch `<input>` ersetzen, Enter/Blur speichert, Escape bricht ab |
| ctx-change-dir | tab | Ordnerdialog → PTY mit neuem Pfad neustarten |
| ctx-restart | tab | Terminal + Preview leeren, PTY neustarten |
| ctx-close | tab, editor | `closeTab(id)` |
| ctx-delete-card | card | Aus savedDirectories entfernen, zugehörige Tabs schließen |

**Rename-Detail:**
- Ersetzt `.tab-label` durch `<input class="tab-rename-input">`
- Input: `#3c3c3c` Hintergrund, accent Border, 120px breit
- `tab.name = input.value` (leere Eingabe → alter Name bleibt)
- `recalcDisplayNames(tab.cwd)` → aktualisiert displayName bei Mehrfach-Instanzen

### 4.14 Config-Persistierung (persistConfig)

```javascript
window.api.saveConfig({
  directories: savedDirectories,
  defaultTab: defaultTab,
  language: i18n.getLanguage()
})
```

Wird aufgerufen bei:
- Karte hinzufügen/löschen/ändern
- Modell-Auswahl ändern
- Karten-Reihenfolge via Drag
- Einstellungen speichern

### 4.15 Einstellungen-Dialog (showSettingsDialog)

**Overlay:** `#settings-dialog-overlay` (fixed, z-index 10000)

**Inhalt:**
- Titel: "Standard-Tab beim Start"
- Radio-Button-Liste:
  - "Home (Dashboard-Ansicht)"
  - Für jedes gespeicherte Verzeichnis: `{name} ({path})`
- **Sprachauswahl:**
  - Label "Sprache"
  - Zwei Buttons mit SVG-Flaggen: Deutsch (🇩🇪) / Englisch (🇬🇧)
  - Aktive Sprache: accent-Hintergrund

**Speichern:**
- `defaultTab` setzen
- Wenn Sprache geändert: Config mit neuer Sprache speichern, `showRestartDialog()`
- Wenn Sprache gleich: Config speichern, Übersetzungen neu anwenden, Karten neu rendern

**Abbrechen:** Dialog schließen

**Klick auf Overlay-Hintergrund:** Auch schließen

**Draggable-Sperre:** Während Dialog offen: alle Karten `draggable = false`

### 4.16 Neustart-Dialog (showRestartDialog)

**Overlay:** `#restart-dialog-overlay` (z-index 11000)

**Inhalt:**
- Titel: "Sprache ändern"
- Nachricht: "Die Sprache wird erst nach einem Neustart übernommen. Jetzt neustarten?"
- Buttons: "Neu starten" / "Später"

**"Neu starten":** `window.api.restartApp()`
**"Später":** Dialog schließen
**Overlay-Klick:** Dialog schließen

### 4.17 ResizeObserver

- Beobachtet `#content-area`
- Bei Größenänderung (wenn NICHT Home):
  - `tab.fitAddon.fit()`
  - `resizePty()` an Hauptprozess
  - **Preview-Größe synchronisieren:**
    - `preview.terminal.resize(cols, rows)`
    - Höhe: `rows * Math.round(6 * 1.2) + 40` Pixel

### 4.18 Tastatur-Shortcuts

| Shortcut | Wirkung |
|----------|---------|
| Ctrl+S (oder Cmd+S) | Editor speichern (nur wenn Editor-Tab aktiv) |
| Ctrl+T | Neues Terminal (openFolderDialog) |
| Ctrl+W | Aktiven Tab schließen (außer Home) |
| Ctrl+Tab | Nächster Tab (home → tabs[0] → tabs[1] → ... → home) |
| Ctrl+Shift+Tab | Vorheriger Tab (umgekehrte Reihenfolge) |
| Escape | Kontextmenü schließen |

### 4.19 Display-Namen (recalcDisplayNames)

- Findet alle Tabs mit gleichem `cwd`
- Laufende Tabs werden nach ID sortiert
- Erster Tab: `name`, zweiter: `name (1)`, dritter: `name (2)`, etc.
- Nicht-laufende Tabs: immer nur `name`
- Aktualisiert auch Preview-Header

### 4.20 Karten-Status (updateCardState)

- Laufenden Tab für `dir._id` suchen
- Play-Button: versteckt wenn läuft
- Stop-Button: sichtbar wenn läuft
- Restart-Button: sichtbar wenn läuft
- Name in Karte: `tab.displayName` wenn läuft, sonst `dir.name`

### 4.21 Preview-Terminals

#### createPreviewTerminal(tab)

**HTML-Struktur:**
```html
<div class="preview-card" data-tab-id="{id}">
  <div class="preview-card-header">
    <span class="preview-card-name">{displayName}</span>
    <span class="preview-card-status preview-active">
      <span class="preview-activity-dot"></span> In Bearbeitung
    </span>
  </div>
  <div class="preview-card-terminal"></div>
</div>
```

**Mini-Xterm:**
- Gleiche Farben wie Hauptterminal
- fontSize: 6 (sehr klein)
- lineHeight: 1.2
- cursorBlink: false
- cursorStyle: 'underline'
- scrollback: 500 (reduziert)
- disableStdin: true (read-only)
- Höhe: `rows * Math.round(6 * 1.2) + 40px`

**Click:** `activatePane(tab.id)` → wechselt zum Vollbild-Tab

**Map-Eintrag:**
```javascript
{
  terminal,      // xterm-Instanz
  container,     // .preview-card-terminal Element
  card,          // .preview-card Element
  activeDot,     // .preview-activity-dot Element
  activeStatus,  // .preview-card-status Element
  createdAt: Date.now()
}
```

#### removePreviewTerminal(tabId)
- Terminal disposen
- Karte aus DOM entfernen
- Aus Map löschen
- Preview-Sektion ggf. ausblenden

#### renderPreviewSection()
- `previewTerminals.size === 0` → Sektion verstecken
- Sonst: anzeigen

### 4.22 Hilfsfunktionen

**providerDisplayName(providerID):**
```
opencode      → "OpenCode"
github-copilot → "GitHub Copilot"
litellm       → "LiteLLM"
sonst         → providerID (unverändert)
```

**escapeHtml(str):**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`

---

## 5. i18n (i18n.js) — 106 Zeilen

### Globales Objekt: `window.i18n`

### API

| Methode | Beschreibung |
|---------|-------------|
| `detectLanguage()` | `navigator.language` → 'de' oder 'en' |
| `setLanguage(lang)` | Setzt aktuelle Sprache |
| `getLanguage()` | Gibt aktuelle Sprache zurück |
| `t(key)` | Übersetzung mit Fallback (englisch) |
| `loadTranslations(lang)` | Lädt JSON via IPC |
| `applyTranslations()` | Wendet alle `data-i18n-*` Attribute an |

### DOM-Attribute

| Attribut | Wirkung |
|----------|---------|
| `data-i18n` | `el.textContent = t(key)` |
| `data-i18n-title` | `el.title = t(key)` |
| `data-i18n-placeholder` | `el.placeholder = t(key)` |
| `data-i18n-html` | `el.innerHTML = t(key)` (erlaubt HTML!) |

### Fallback

Alle 57 Keys sind im Fallback-Objekt auf Englisch hinterlegt. Falls ein Key in der geladenen JSON fehlt, wird der Fallback verwendet.

### Übersetzbare Keys

```
tab.home, tab.newTerminal
dashboard.title, dashboard.noDirs, dashboard.noDirsHint, dashboard.addDirectory
actions.title, actions.reloadModels, actions.editConfig, actions.restartLauncher, actions.settings
loading.models
models.lastLoaded, models.noSelection, models.provider, models.preferred
preview.title, preview.running, preview.processing
ctx.save, ctx.rename, ctx.changeDir, ctx.restart, ctx.closeTab, ctx.removeCard
saveDialog.title, saveDialog.name, saveDialog.saveAndOpen, saveDialog.saveOnly, saveDialog.openOnly, saveDialog.cancel
settings.title, settings.homeSubtitle, settings.save, settings.cancel, settings.language
editor.name, editor.description, editor.descriptionPlaceholder, editor.startOnLaunch, editor.continueSession, editor.save, editor.cancel
card.noDescription, card.btn.settings, card.btn.play, card.btn.stop, card.btn.restart
terminal.processExited, terminal.error
dialog.selectDirectory
restartDialog.title, restartDialog.message, restartDialog.restart, restartDialog.later
```

---

## 6. Styles (styles.css) — 922 Zeilen

### 6.1 CSS-Variablen (Custom Properties)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--bg-base` | `#1e1e1e` | Haupthintergrund (dunkel) |
| `--bg-tab-bar` | `#2d2d2d` | Tab-Leisten-Hintergrund |
| `--bg-tab` | `#3c3c3c` | Tab-Hintergrund (inaktiv) |
| `--bg-tab-hover` | `#4a4a4a` | Tab-Hover |
| `--bg-tab-active` | `#1e1e1e` | Tab-Aktiv (Hintergrund, gleicht Basis) |
| `--accent` | `#007acc` | Akzentfarbe (blau) |
| `--accent-hover` | `#1e8ad6` | Akzent-Hover (helleres Blau) |
| `--text` | `#cccccc` | Haupttext |
| `--text-dim` | `#888888` | Deaktivierter/sekundärer Text |
| `--text-tab` | `#aaaaaa` | Tab-Text (inaktiv) |
| `--text-tab-active` | `#ffffff` | Tab-Text (aktiv) |
| `--border` | `#404040` | Trennlinien/Rahmen |
| `--danger` | `#f44747` | Gefahr/Rot (z.B. Tab schließen) |
| `--tabbar-h` | `38px` | Höhe der Tab-Leiste |
| `--card-bg` | `#252526` | Kartenhintergrund (etwas heller als Basis) |
| `--card-hover` | `#2d2d2d` | Karten-Hover |

### 6.2 Basis-Styles

- **Box-Sizing:** `border-box` für alle Elemente
- **.hidden:** `display: none !important` (höchste Priorität)
- **html, body:** 100% × 100%, kein Scrollen (`overflow: hidden`), Hintergrund `#1e1e1e`
- **Font:** `'Segoe UI', system-ui, sans-serif`, 13px
- **user-select:** `none` (keine Textauswahl außerhalb von Eingabefeldern)
- **body:** `flex: column`

### 6.3 Tab-Bar

**#tab-bar:**
- `flex: 0 0 38px` (fixe Höhe)
- Hintergrund `#2d2d2d`
- Untere Border `#404040`
- `align-items: stretch` (Tabs füllen Höhe)
- `overflow: hidden`

**#tabs-container:**
- Flex, horizontal scrollbar (`overflow-x: auto, overflow-y: hidden`)
- Dünner Scrollbar: Höhe 3px, `#404040`

**Tab (.tab):**
- Flex mit `gap: 6px`, Padding `0 12px 0 14px`
- Min 130px, max 220px, volle Höhe
- Hintergrund `#3c3c3c`, Text `#aaaaaa`
- Border-right `#404040`
- `flex-shrink: 0` (nicht schrumpfen)
- Übergang: `background 0.12s`
- **Hover:** Hintergrund `#4a4a4a`, Text `#cccccc`
- **Active:** Hintergrund `#1e1e1e`, Text `#ffffff`, untere Border 2px `#007acc`
- **Dragging:** Opacity 0.4, `cursor: grabbing`
- **Drag-over:** `box-shadow: -2px 0 0 #007acc` (Linie links)

**Home-Tab (#tab-home):**
- Min 80px, max 100px, Padding `0 14px`
- `border-right`, `flex-shrink: 0`

**Tab-Icon (.tab-home-icon):**
- 16px, `line-height: 1`

**Editor-Icon (.tab-editor-icon):**
- 13px, Farbe `#888888`

**Tab-Indicator (.tab-indicator):**
- 8×8px Kreis, `border-radius: 50%`
- Standard: `#888888` (grau)
- `.tab.running`: `#4ec9b0` (grün)
- `.tab.stopped`: `#888888` (grau)
- `.tab.error`: `#f44747` (rot)
- `.tab.running .tab-indicator.active`: `#dcdcaa` (gelb) + Puls-Animation

**Tab-Label (.tab-label):**
- `flex: 1`, `overflow: hidden`
- `text-overflow: ellipsis`
- 12px Schrift

**Close-Button (.tab-close):**
- 18×18px, `border-radius: 3px`
- Transparent, Farbe `#888888`, 16px
- **Hover:** `rgba(255,255,255,0.1)` Hintergrund, Farbe `#cccccc`

**Add-Tab-Button (#btn-add-tab):**
- 36px breit, transparent
- Farbe `#888888`, 22px
- **Hover:** Farbe `#cccccc`, `rgba(255,255,255,0.06)` Hintergrund

### 6.4 Content-Bereich

**#content-area:**
- `flex: 1 1 0` (füllt restliche Höhe)
- `position: relative`, `overflow: hidden`

**Pane (.content-pane):**
- `display: none` (unsichtbar)
- Absolute Positionierung (top/left/right/bottom: 0)
- `.active`: `display: block`

**Editor-Pane (.editor-pane.active):**
- `display: flex`, `flex-direction: column`

### 6.5 Dashboard

**#dashboard:**
- `overflow-y: auto` (scrollbar bei vielen Karten)
- Padding: `32px 40px`

**Header:**
- Flex, `space-between`
- `margin-bottom: 28px`
- Titel: 20px, `font-weight: 600`
- Letztes-Lade-Datum: 11px, `#888888`

**Actions-Menü (#actions-menu):**
- `position: relative` (für Dropdown-Positionierung)
- Button: Padding 8×12, Hintergrund `#252526`, Border `#404040`, 5px Radius
- **Hover:** Hintergrund `#4a4a4a`, Text `#cccccc`

**Actions-Dropdown (#actions-dropdown):**
- Absolute Positionierung: `top: 100%, right: 0`
- Hintergrund `#252526`, Border `#404040`, 6px Radius
- Padding: 4px 0, min-width 220px
- Box-shadow: `0 4px 16px rgba(0,0,0,0.5)`, z-index 100
- Buttons: full width, linksbündig, 12px, Padding 8×14
- **Hover:** `rgba(255,255,255,0.08)`
- **Disabled:** Opacity 0.5, default cursor
- **HR:** Border-top `#404040`, margin 4×8

**Add-Directory-Button (#btn-add-directory):**
- Padding 8×16, Hintergrund `#007acc`, weißer Text
- 5px Radius, 13px
- **Hover:** `#1e8ad6`

### 6.6 Karten-Grid

**#cards-grid:**
- CSS Grid: `auto-fill, minmax(380px, 1fr)`
- Gap: 16px

### 6.7 Directory Card

**Basics:**
- Hintergrund `#252526`, Border `#404040`
- 8px Radius, `overflow: hidden`
- **Hover:** Border `#007acc`, Hintergrund `#2d2d2d`, `translateY(-1px)`
- **Dragging:** Opacity 0.4
- **Drag-over:** Box-shadow `-3px 0 0 #007acc`

**View-Mode (.dir-card-view):**
- Flex, `align-items: center`, gap 12px
- Padding 16×14

**Icon:** 22px

**Info-Bereich:**
- `flex: 1`, `min-width: 0`

**Name:**
- 14px, `font-weight: 600`
- `text-overflow: ellipsis`

**Path:**
- 11px, Farbe `#888888`
- Monospace (`'Consolas', monospace`)

**Description:**
- 11px, `#888888`
- `.dir-card-desc--empty`: Opacity 0.4, italic

**Auto-Launch-Badge:**
- 10px, Farbe `#4ec9b0` (grün)
- `▶` vorangestellt

**Standard-Tab-Badge:**
- 10px, Farbe `#dcdcaa` (gelb)
- `⭐` vorangestellt

**Action-Buttons:**
- Flex, gap 6px
- Alle: 34×34px, 8px Radius

**Settings-Button:**
- Transparent, `#888888` Icon
- Border `#404040`
- **Hover:** Border `#888888`, Text `#cccccc`

**Play-Button:**
- Hintergrund `#007acc`, weißes Icon
- `padding-left: 2px`
- **Hover:** `#1e8ad6`, `scale(1.1)`

**Stop-Button:**
- Hintergrund `rgba(244,71,71,0.15)`, Icon `#f44747`
- **Hover:** `rgba(244,71,71,0.3)`, `scale(1.1)`

**Restart-Button:**
- Hintergrund `rgba(220,220,170,0.1)`, Icon `#dcdcaa`, 16px
- **Hover:** `rgba(220,220,170,0.22)`, `scale(1.1)`

### 6.8 Card Editor (Inline)

- Padding 14×14, Border-top
- Hintergrund `#1e1e1e`
- Flex column, gap 10px
- Labels: 11px, uppercase, `#888888`
- Inputs: Padding 6×8, Hintergrund `#252526`, Border `#404040`, 5px Radius
- **Focus:** Border `#007acc`
- Checkbox: 15×15, `accent-color: #007acc`
- Footer: `justify-content: flex-end`, gap 6px
- Save: `#007acc`, weiß
- Cancel: transparent, Border `#404040`

### 6.9 "No Dirs" Placeholder

- Flex column, centered, Padding 80px 0
- Icon: 48px, Opacity 0.3
- Text: 16px, `font-weight: 500`
- Hint: 12px, Opacity 0.7

### 6.10 Preview Section

**Sektion:**
- Margin-top 28px, Border-top `#404040`, Padding-top 18px

**Header:**
- Flex, gap 8px, `margin-bottom: 12px`
- Titel: 12px, `font-weight: 600`, uppercase

**Grid:**
- CSS Grid: `auto-fill, minmax(380px, 1fr)`, gap 12px

**Preview Card:**
- Hintergrund `#252526`, Border `#404040`, 8px Radius
- `cursor: pointer` (klickbar)
- **Hover:** Border `#007acc`, Hintergrund `#2d2d2d`

**Header:**
- Flex, `space-between`, Padding 7×12
- Border-bottom, Hintergrund `#1e1e1e`

**Name:**
- 12px, `font-weight: 600`
- `text-overflow: ellipsis`

**Status:**
- 10px, Standard: `#4ec9b0` (grün)
- `.preview-active`: `#dcdcaa` (gelb)
- Übergang `color 0.3s`

**Activity-Dot:**
- 6×6px Kreis
- Standard: `#4ec9b0`
- `.preview-active`: `#dcdcaa` + Puls-Animation

**Puls-Animation (@keyframes preview-pulse):**
- 0%, 100%: Opacity 1
- 50%: Opacity 0.2
- 1s, ease-in-out, infinite

### 6.11 Drop Overlay

- Absolute Positionierung, Semitransparent (`rgba(0,0,0,0.55)`)
- Border: 3px dashed `#007acc`, 12px Radius
- Zentrierter Inhalt, z-index 100
- `pointer-events: none` (durchlässig für Maus)

### 6.12 Settings Dialog

- Fixed Overlay: z-index 10000, `rgba(0,0,0,0.6)`
- Dialog: `#252526`, 10px Radius, min-width 400px, max-width 500px
- Box-shadow: `0 8px 32px rgba(0,0,0,0.6)`
- Options: flex column, max-height 300px, scrollbar
- Jede Option: card-artig mit Border, Hover mit accent
- Radio: `accent-color: #007acc`, 16×16
- Lang-Buttons: Padding 5×12, Border, SVG-Flaggen
- Active Lang: `#007acc` Hintergrund, weißer Text
- Save: `#007acc`, weiß
- Cancel: transparent, Border `#404040`

### 6.13 Restart Dialog

- z-index 11000 (über Settings)
- 380px breit
- Gleiches Overlay-Pattern

### 6.14 Terminal-Pane

- Padding: 2px
- xterm/Viewport/Screen: 100% × 100% (mit !important)

### 6.15 Editor (CodeMirror)

**Basis:**
- Höhe 100%
- Font: `'Cascadia Code', 'Fira Code', 'Consolas', monospace`
- 13px, lineHeight 1.5
- Hintergrund `#1e1e1e`, Text `#d4d4d4`

**Gutter (Zeilennummern):**
- Hintergrund `#252526`, rechte Border `#333`
- Nummern: `#858585`

**Syntax-Highlighting (VS Code Dark):**

| Token | Farbe |
|-------|-------|
| Keyword | `#569cd6` (blau) |
| String | `#ce9178` (orange) |
| Number | `#b5cea8` (grün) |
| Property | `#9cdcfe` (cyan) |
| Atom | `#569cd6` (blau) |
| Definition | `#dcdcaa` (gelb) |
| Operator | `#d4d4d4` (hellgrau) |
| Meta | `#d4d4d4` |
| Bracket | `#d4d4d4` |
| Comment | `#6a9955` (grün) |
| Variable | `#d4d4d4` |
| Variable-2 | `#9cdcfe` (cyan) |
| Tag | `#569cd6` (blau) |
| Attribute | `#9cdcfe` (cyan) |
| Qualifier | `#569cd6` |
| Builtin | `#569cd6` |
| Error | `#f44747` (rot) |

**Weitere:**
- Cursor: `border-left: 2px solid #aeafad`
- Selection: `rgba(0,122,204,0.3)`
- Active Line: `rgba(255,255,255,0.04)`

### 6.16 Context Menu

- Fixed, z-index 9999
- `#252526`, Border `#404040`, 6px Radius, Padding 4px 0
- Min-width 160px, Box-shadow
- Buttons: full width, Padding 7×14, 12px, linksbündig
- **Hover:** `rgba(255,255,255,0.08)`
- **Danger:** `#f44747`
- **Danger Hover:** `rgba(244,71,71,0.15)`

### 6.17 Tab Rename Input

- Hintergrund `#3c3c3c`, Border `#007acc`
- 3px Radius, Text `#cccccc`
- 12px, 120px breit

### 6.18 Save Dialog

- Gleiches Overlay-Pattern
- 380px min-width
- Path: monospace, `#1e1e1e` Hintergrund, Padding 8×10
- Name-Input: `#1e1e1e`, Border `#404040`, Focus accent
- Buttons:
  - "Save & Open": `#007acc` (accent)
  - "Save Only": `#3c3c3c` Hintergrund
  - "Open Only": `#3c3c3c` Hintergrund
  - "Cancel": transparent

### 6.19 Scrollbars

- Webkit-Scrollbar: 8px breit, `#424242` Thumb, 4px Radius
- Track: transparent

---

## 7. HTML (index.html) — 134 Zeilen

### 7.1 Struktur

```
body
├── #tab-bar
│   ├── #tab-home (pinnbarer Home-Tab)
│   ├── #tabs-container (dynamisch)
│   └── #btn-add-tab (+)
├── #content-area
│   ├── #dashboard (Home-Pane)
│   │   ├── #dashboard-header
│   │   │   ├── h1 "OpenCode Launcher"
│   │   │   ├── #models-last-loaded
│   │   │   ├── #actions-menu (Dropdown)
│   │   │   └── #btn-add-directory
│   │   ├── #cards-grid (dynamisch)
│   │   ├── #no-dirs (Platzhalter)
│   │   ├── #preview-section (dynamisch)
│   │   │   ├── #preview-header
│   │   │   └── #preview-grid
│   │   └── #drop-overlay
│   └── Terminal-Panes (dynamisch via JS)
├── #context-menu (dynamisch eingeblendet)
├── #save-dialog-overlay (Modal)
├── #settings-dialog-overlay (Modal)
└── #restart-dialog-overlay (Modal)
```

### 7.2 Sicherheit

- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- `contextIsolation: true`
- `nodeIntegration: false`

### 7.3 Script-Reihenfolge

1. `@xterm/xterm/lib/xterm.js`
2. `@xterm/addon-fit/lib/addon-fit.js`
3. `codemirror/lib/codemirror.js`
4. `codemirror/mode/javascript/javascript.js`
5. `codemirror/addon/selection/active-line.js`
6. `codemirror/addon/edit/matchbrackets.js`
7. `i18n.js`
8. `app.js`

---

## 8. Ressourcen

### 8.1 Sprache: en.json / de.json

Je 57 Schlüssel-Wert-Paare. Identische Struktur, nur übersetzte Werte.

### 8.2 Flaggen

**flag-de.svg:** 3 horizontale Streifen (5×3 ViewBox)
- Schwarz (#000), Rot (#DD0000), Gelb (#FFCE00)

**flag-en.svg:** Union Jack (60×30 ViewBox)
- Weißes Kreuz auf blauem Grund (#012169)
- Rote Kreuze (#C8102E) auf weißen Diagonalen

### 8.3 config.json (persistente Konfiguration)

**Schema:**
```json
{
  "directories": [{ name, path, description?, model?, startOnLaunch?, continueSession?, _id }],
  "defaultTab": "home",
  "language": "en",
  "tabOrder": ["path1", "path2"],
  "modelsCache": { timestamp, models: [{ id, name, providerID }] }
}
```

**Hinweise:**
- `_id` wird automatisch vergeben (inkrementell, persistiert)
- `tabOrder` speichert Pfade (cwd) der Tabs
- `modelsCache` wird von Model-Logik verwaltet

---

## 9. Start-Skripte

### Windows (start.bat)
```
@echo off
cscript //nologo "%~dp0start-hidden.vbs" "%~dp0"
```

### Windows (start-hidden.vbs)
- Setzt Working Directory auf Skript-Pfad
- Führt `npm start` aus (versteckt, kein Fenster)

### Windows (start.vbs)
- Alternative: zeigt kein Fenster, verwendet `cmd /c cd /d`

### Linux/macOS (start.sh)
```bash
#!/bin/bash
cd "$(dirname "$0")"
nohup npm start > /dev/null 2>&1 &
```

---

## 10. Test-Dateien

### test-main.js
- Lädt `renderer/test.html` in eigenem BrowserWindow
- Öffnet DevTools
- Zum Testen von xterm.js ohne Hauptapp

### test.html
- Rendert xterm.js in einfacher HTML-Seite
- Zeigt Status: Terminal-Typ, FitAddon-Typ, cols/rows
- Schwarzer Hintergrund, grüner Status-Text

---

## 11. Drag & Drop — vollständiges Verhalten

### Dashboard (Ordner-Karten)
- **Auslöser:** `dragstart` auf `.dir-card`
- **Blockiert:** wenn Settings-Dialog offen ODER Inline-Editor offen
- **Visuell:** `.dragging` (opacity 0.4) auf gezogener Karte, `.drag-over` (box-shadow + accent border) auf Ziel
- **Drop-Ziel:** Andere `.dir-card`
- **Effekt:** Karte im Array verschieben, Config persistieren, Grid neu rendern
- **dragend:** Alle Klassen entfernen, `draggedCardPath = null`

### Tab-Bar
- **Auslöser:** `dragstart` auf `.tab`
- **Blockiert:** wenn Settings-Dialog offen
- **Visuell:** `.dragging` (opacity 0.4), `.drag-over` (box-shadow -2px links)
- **Drop-Ziel:** Anderer `.tab`
- **Effekt:** Tab im Array verschieben, neu rendern, Reihenfolge persistieren
- **dragend:** Klassen entfernen, `draggedTabId = null`

### Dateien auf Dashboard
- **dragenter:** `dragCounter++`, Overlay einblenden
- **dragover:** `preventDefault()` (erlaubt Drop)
- **dragleave:** `dragCounter--`, Overlay aus wenn 0
- **drop:** `dragCounter = 0`, Overlay aus, `file.path` auslesen → `showSaveDialog(folderPath, defaultName)`
- **Blockiert:** wenn Dashboard nicht aktiv ist → keine Aktion

---

## 12. Indicator-Zustände — vollständige Referenz

### Tab-Indicator (8px Kreis)

| Zustand | Klasse(n) | Farbe | Bedeutung |
|---------|-----------|-------|-----------|
| Stopped | `.tab.stopped` | `#888888` (grau) | PTY beendet |
| Running (idle) | `.tab.running` | `#4ec9b0` (grün) | PTY läuft, keine Aktivität |
| Running (processing) | `.tab.running .tab-indicator.active` | `#dcdcaa` (gelb, pulsiert) | Ausgabe/Verarbeitung |
| Error | `.tab.error` | `#f44747` (rot) | PTY-Fehler |
| Startup | `.tab.running .tab-indicator.active` | gelb pulsierend | OpenCode startet (bis 5s) |

### Preview-Status

| Zustand | Klasse | Farbe | Text |
|---------|--------|-------|------|
| Idle | — | `#4ec9b0` (grün) | "Ready" / "Bereit" |
| Processing | `.preview-active` | `#dcdcaa` (gelb) | "Processing" / "In Bearbeitung" |

### Timing

| Ereignis | Indicator-Änderung | Verzögerung |
|----------|-------------------|-------------|
| PTY erstellt | → Gelb (Processing) | Sofort |
| OpenCode gestartet-Signal | → Gelb (Processing) | Sofort |
| TUI bereit erkannt | → Grün (Idle) | ~200ms Polling |
| Fallback TUI-Timeout | → Grün (Idle) | 5000ms max |
| Schreibaktivität | → Gelb (Processing) | Wenn data > 100 chars oder data > 1.5× input |
| Letzte Schreibaktivität | → Grün (Idle) | 200ms Debounce |
| Benutzertastendruck | Processing blockiert | 300ms |
| Maus-Scrollen | Processing blockiert | 500ms |
| Paste | Processing blockiert | 1000ms |
| Tab-Wechsel | Zustand wiederhergestellt | Nächster Frame |

---

## 13. Verhaltensdetails — Randfälle und Spezialfälle

### Tab-Wechsel
- Processing-Indicator wird vor dem grünen "Resize-Flash" bewahrt → Zustand wird vorher gespeichert und wiederhergestellt
- `suppressIndicator(500)` verhindert fälschliche Processing-Erkennung durch Resize-Effekte

### Mehrfach-Instanzen (gleicher Pfad)
- Gleicher `cwd` → Tabs erhalten `displayName` mit Suffix `(1)`, `(2)`, etc.
- Nur laufende Tabs zählen für die Nummerierung
- Reihenfolge nach Tab-ID (Erstellungsreihenfolge)
- Nicht-laufende Tabs: immer Basisname

### Auto-Launch
- Verzeichnisse mit `startOnLaunch: true` werden beim App-Start automatisch geöffnet
- Args: `--continue` falls aktiviert
- Default-Tab wird NACH Auto-Launch gesetzt → kann auf einen Auto-Launch-Tab verweisen

### Config-Migration
- Altes Format (`dir.defaultTab` als boolean) wird erkannt und in neues Format (`config.defaultTab` als path) überführt
- Alte `autoLaunch`-Feld wird nicht mehr gelesen (nur `startOnLaunch`)

### Editor-Tab
- Nur ein Editor-Tab gleichzeitig (editorTabId)
- Dirty-Indikator: `*` vor Dateinamen in Tab
- Ctrl+S speichert (auch via Cmd+S auf macOS)
- Kein PTY, kein Indicator (nur ✎ Icon)

### Kontextmenü-Out-of-Bounds
- Falls Menü rechts über den Bildschirmrand ragt → links vom Klickpunkt positionieren
- Falls unten über den Rand ragt → oberhalb positionieren

### PTY-Cleanup
- Beim Fenster-Schließen: Alle PTYs in `ptyProcesses` werden gekillt
- Existierende PTY mit gleicher tabId wird vor Neu-Erstellung gekillt

### Verzeichnis-Prüfung beim Start
- Alle gespeicherten Pfade werden auf Existenz geprüft
- Fehlende werden aus Config entfernt und persistiert
- Still, ohne Benutzer-Interaktion

### Sprachwechsel
- Sprache wird sofort in der UI angewandt (außer Hauptprozess-Texte wie Dialog-Titel)
- Bei Sprachwechsel wird Neustart-Dialog gezeigt (weil Hauptprozess-Texte neu geladen werden müssen)
- "Später" → UI ist übersetzt, Hauptprozess-Dialoge bleiben in alter Sprache bis Neustart

---

## 14. Vollständige Interaktions-Matrix

| Element | Linksklick | Rechtsklick | Drag | Tastatur |
|---------|------------|-------------|------|----------|
| Home-Tab | Aktiviert Dashboard | — | — | — |
| Terminal-Tab | Aktiviert Pane | Kontextmenü | Neu anordnen | — |
| Editor-Tab | Aktiviert Editor | Kontextmenü (eingeschränkt) | Neu anordnen | — |
| Close-Button | Schließt Tab | — | — | — |
| + Button | Ordnerdialog | — | — | — |
| Verzeichnis-Karte (View) | — (nur Buttons) | Kontextmenü (Card) | Neu anordnen | — |
| Settings-Button (Karte) | Öffnet Editor | — | — | — |
| Play-Button | Öffnet Terminal | — | — | — |
| Stop-Button | Schließt Tab | — | — | — |
| Restart-Button | Restartet Terminal | — | — | — |
| Modell-Select | Ändert Modell | — | — | — |
| Editor Save/Cancel | Speichert/Bricht ab | — | — | Enter=Save, Escape=Cancel |
| Preview-Card | Aktiviert Vollbild-Tab | — | — | — |
| Actions-Button | Öffnet/Schließt Dropdown | — | — | — |
| Dropdown-Eintrag | Führt Aktion aus | — | — | — |
| Dialog Overlay (Hintergrund) | Schließt Dialog | — | — | — |
| Dashboard (leer) | — | — | Datei-Drop | — |
| Alle | — | — | — | Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+S, Escape |

---

## 15. Bekannte Migration-Hinweise für React + Vite + CSS Modules

1. **xterm.js:** Wrapper-Komponente benötigt. FitAddon muss via ref initialisiert werden.
2. **CodeMirror 5:** Besser zu CodeMirror 6 migrieren (@codemirror/lang-json, @codemirror/theme-one-dark)
3. **i18n:** Flexibleres System als Modul (aktuell window.i18n)
4. **PTY-Daten:** Event-Streaming via IPC → in React: useCallback + useEffect für Subscribe/Unsubscribe
5. **Preview-Terminals:** Zweite xterm-Instanz pro Tab → eigener Mini-Terminal-Context
6. **CSS-Module:** Jede Komponente bekommt eigene .module.css; CSS-Variablen als globale :root
7. **Drag & Drop:** HTML5 DnD durch react-beautiful-dnd oder @dnd-kit ersetzen
8. **Zustandsmanagement:** tabs[], activeId, savedDirectories → React Context oder Zustand
9. **ResizeObserver:** useResizeObserver-Hook
10. **Processing-Erkennung:** In useEffect + useRef kapseln (Debounce, Intervall)
11. **Modale Dialoge:** Portal-basierte Modal-Komponente
12. **Kontextmenü:** Positioniertes Overlay mit useClickOutside
13. **CodeMirror-Theme:** Die 20+ CSS-Klassen in CodeMirror 6 übersetzen
14. **Keyboard-Shortcuts:** useEffect + useCallback für globalen Event-Listener
