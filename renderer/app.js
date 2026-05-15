// renderer/app.js

document.addEventListener('DOMContentLoaded', () => {
  const Terminal = window.Terminal
  const FitAddon = window.FitAddon?.FitAddon ?? window.FitAddon

  if (!Terminal || !FitAddon) {
    console.error('[app] xterm.js oder FitAddon nicht gefunden!', { Terminal, FitAddon })
    return
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let tabs = []
  let activeId = 'home'
  let tabCounter = 0
  let contextMenuTabId = null
  let savedDirectories = []
  let availableModels = []  // { id, name, providerID }
  let modelsTimestamp = null
  let savedTabOrder   = []
  let draggedTabId    = null

  // ── DOM-Refs ───────────────────────────────────────────────────────────────
  const tabsContainer = document.getElementById('tabs-container')
  const contentArea   = document.getElementById('content-area')
  const contextMenu   = document.getElementById('context-menu')

  // ── Button-Handler ─────────────────────────────────────────────────────────
  document.getElementById('tab-home').addEventListener('click', () => activatePane('home'))
  document.getElementById('btn-add-tab').addEventListener('click', () => openFolderDialog())
  document.getElementById('btn-add-directory').addEventListener('click', () => openFolderDialog())

  // ── Modelle Label ──────────────────────────────────────────────────────────
  function updateModelsLabel(isoString) {
    const el = document.getElementById('models-last-loaded')
    if (!el) return
    if (!isoString) { el.textContent = ''; return }
    const d = new Date(isoString)
    el.textContent = `Zuletzt geladen: ${d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })}`
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  init()

  async function init() {
    try {
      const config = await window.api.loadConfig()
      savedDirectories = config.directories || []
      savedTabOrder    = config.tabOrder    || []
    } catch (e) {
      console.error('[init]', e)
    }

    // Modelle laden
    try {
      const result = await window.api.listModels()
      availableModels = result.models || []
      modelsTimestamp = result.timestamp || null
      updateModelsLabel(modelsTimestamp)
    } catch (e) {}

    renderCards()

    // Modelle neu laden Button
    document.getElementById('btn-reload-models').addEventListener('click', async () => {
      const btn = document.getElementById('btn-reload-models')
      btn.disabled = true
      btn.textContent = 'Lade...'
      try {
        const result = await window.api.refreshModels()
        availableModels = result.models || []
        modelsTimestamp = result.timestamp || null
        updateModelsLabel(modelsTimestamp)
      } catch (e) {}
      btn.disabled = false
      btn.textContent = '↻ Modelle neu laden'
      renderCards()
    })

    // Auto-Launch: Verzeichnisse mit startOnLaunch=true sofort öffnen
    const autoLaunch = savedDirectories.filter(d => d.startOnLaunch)
    const tabIds = []
    if (autoLaunch.length > 0) {
      for (const dir of autoLaunch) {
        const id = await createTab(dir.name, dir.path, dir.continueSession ? '--continue' : '')
        tabIds.push({ id, dir })
      }
      // Standard-Tab aktivieren, sonst den letzten geöffneten
      const defaultEntry = tabIds.find(t => t.dir.defaultTab)
      activatePane(defaultEntry ? defaultEntry.id : tabIds[tabIds.length - 1].id)
      applyTabOrder(savedTabOrder)
    } else {
      activatePane('home')
    }
  }

  // ── Pane aktivieren ────────────────────────────────────────────────────────
  function activatePane(id) {
    activeId = id

    // Alle Panes ausblenden
    document.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'))

    if (id === 'home') {
      document.getElementById('dashboard').classList.add('active')
    } else {
      const pane = document.getElementById(`pane-${id}`)
      if (pane) pane.classList.add('active')
      // xterm fitten nach Sichtbarkeit
      const tab = tabs.find(t => t.id === id)
      if (tab) {
        requestAnimationFrame(() => {
          try {
            tab.fitAddon.fit()
            window.api.resizePty(id, tab.terminal.cols, tab.terminal.rows)
            tab.terminal.focus()
          } catch (e) {}
        })
      }
    }

    renderTabBar()
  }

  // ── Dashboard: Karten ─────────────────────────────────────────────────────
  let draggedCardPath = null

  function renderCards() {
    const grid = document.getElementById('cards-grid')
    const noDirs = document.getElementById('no-dirs')
    grid.innerHTML = ''
    if (savedDirectories.length === 0) {
      noDirs.classList.remove('hidden')
      return
    }
    noDirs.classList.add('hidden')
    for (const dir of savedDirectories) {
      const card = createCard(dir)

      card.draggable = true
      card.addEventListener('dragstart', (e) => {
        draggedCardPath = dir.path
        e.dataTransfer.effectAllowed = 'move'
        requestAnimationFrame(() => card.classList.add('dragging'))
      })
      card.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        document.querySelectorAll('.dir-card').forEach(c => c.classList.remove('drag-over'))
        if (draggedCardPath !== dir.path) card.classList.add('drag-over')
      })
      card.addEventListener('drop', (e) => {
        e.preventDefault()
        if (!draggedCardPath || draggedCardPath === dir.path) return
        const fromIdx = savedDirectories.findIndex(d => d.path === draggedCardPath)
        const toIdx   = savedDirectories.findIndex(d => d.path === dir.path)
        if (fromIdx !== -1 && toIdx !== -1) {
          savedDirectories.splice(toIdx, 0, savedDirectories.splice(fromIdx, 1)[0])
        }
        draggedCardPath = null
        persistConfig()
        renderCards()
      })
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging')
        document.querySelectorAll('.dir-card').forEach(c => c.classList.remove('drag-over'))
        draggedCardPath = null
      })

      grid.appendChild(card)
    }
  }

  function createCard(dir) {
    const card = document.createElement('div')
    card.className = 'dir-card'
    card.dataset.cwd = dir.path
    card.innerHTML = `
      <div class="dir-card-view">
        <div class="dir-card-icon">&#128193;</div>
        <div class="dir-card-info">
          <div class="dir-card-name">${escapeHtml(dir.name)}</div>
          <div class="dir-card-path">${escapeHtml(dir.path)}</div>
          ${dir.description ? `<div class="dir-card-desc">${escapeHtml(dir.description)}</div>` : '<div class="dir-card-desc dir-card-desc--empty">Keine Beschreibung</div>'}
          ${dir.startOnLaunch ? '<div class="dir-card-autolaunch">&#9654; Start on launch</div>' : ''}
          ${dir.defaultTab ? '<div class="dir-card-defaulttab">&#11088; Standard-Tab</div>' : ''}
        </div>
        <div class="dir-card-actions">
          <button class="dir-card-settings-btn" title="Einstellungen">&#9881;</button>
          <button class="dir-card-play-btn" title="Terminal starten">&#9654;</button>
          <button class="dir-card-stop-btn hidden" title="Stoppen &amp; schließen">&#9632;</button>
          <button class="dir-card-restart-btn hidden" title="Neu starten">&#8635;</button>
          <button class="dir-card-delete-btn" title="Aus Liste entfernen">&#215;</button>
        </div>
      </div>
      <div class="dir-card-model-section">
        <div class="dir-card-model-label">Bevorzugtes Modell</div>
        <select class="dir-card-model-select"></select>
        <div class="dir-card-model-provider"></div>
      </div>
      <div class="dir-card-editor hidden">
        <div class="dir-card-editor-row">
          <label>Name</label>
          <input class="dir-card-editor-name" type="text" value="${escapeHtml(dir.name)}" />
        </div>
        <div class="dir-card-editor-row">
          <label>Beschreibung</label>
          <input class="dir-card-editor-desc" type="text" placeholder="optional…" value="${escapeHtml(dir.description || '')}" />
        </div>
        <div class="dir-card-editor-row dir-card-editor-row--check">
          <input class="dir-card-editor-launch" type="checkbox" ${dir.startOnLaunch ? 'checked' : ''} />
          <label>Start on launch</label>
        </div>
        <div class="dir-card-editor-row dir-card-editor-row--check">
          <input class="dir-card-editor-continue" type="checkbox" ${dir.continueSession ? 'checked' : ''} />
          <label>Session fortsetzen beim Öffnen</label>
        </div>
        <div class="dir-card-editor-row dir-card-editor-row--check">
          <input class="dir-card-editor-default" type="checkbox" ${dir.defaultTab ? 'checked' : ''} />
          <label>Standard-Tab beim Start</label>
        </div>
        <div class="dir-card-editor-footer">
          <button class="dir-card-editor-save">Speichern</button>
          <button class="dir-card-editor-cancel">Abbrechen</button>
        </div>
      </div>
    `

    const viewEl   = card.querySelector('.dir-card-view')
    const editorEl = card.querySelector('.dir-card-editor')
    const nameInput     = card.querySelector('.dir-card-editor-name')
    const descInput     = card.querySelector('.dir-card-editor-desc')
    const launchInput   = card.querySelector('.dir-card-editor-launch')
    const continueInput = card.querySelector('.dir-card-editor-continue')
    const defaultInput  = card.querySelector('.dir-card-editor-default')
    const modelSelect   = card.querySelector('.dir-card-model-select')
    const providerLabel = card.querySelector('.dir-card-model-provider')

    // Combobox befüllen
    const emptyOpt = document.createElement('option')
    emptyOpt.value = ''
    emptyOpt.textContent = '— Kein Modell ausgewählt —'
    modelSelect.appendChild(emptyOpt)
    // Modelle nach Provider gruppieren
    const groups = {}
    for (const m of availableModels) {
      if (!groups[m.providerID]) groups[m.providerID] = []
      groups[m.providerID].push(m)
    }
    for (const [providerID, models] of Object.entries(groups)) {
      const group = document.createElement('optgroup')
      group.label = providerDisplayName(providerID)
      for (const m of models) {
        const opt = document.createElement('option')
        opt.value = m.id
        opt.textContent = m.name
        if (m.id === dir.model) opt.selected = true
        group.appendChild(opt)
      }
      modelSelect.appendChild(group)
    }

    const updateProviderLabel = () => {
      const selected = availableModels.find(m => m.id === modelSelect.value)
      providerLabel.textContent = selected ? `Provider: ${providerDisplayName(selected.providerID)}` : ''
    }
    updateProviderLabel()

    modelSelect.addEventListener('change', (e) => {
      e.stopPropagation()
      dir.model = modelSelect.value || undefined
      persistConfig()
      updateProviderLabel()
    })

    const openEditor = (e) => {
      e.stopPropagation()
      nameInput.value = dir.name
      descInput.value = dir.description || ''
      launchInput.checked   = dir.startOnLaunch   || false
      continueInput.checked = dir.continueSession  || false
      defaultInput.checked  = dir.defaultTab       || false
      viewEl.classList.add('hidden')
      editorEl.classList.remove('hidden')
      nameInput.focus(); nameInput.select()
    }

    const closeEditor = () => {
      editorEl.classList.add('hidden')
      viewEl.classList.remove('hidden')
    }

    const saveEdit = () => {
      const newName = nameInput.value.trim()
      const newDesc = descInput.value.trim()
      if (newName) dir.name = newName
      dir.description    = newDesc
      dir.startOnLaunch  = launchInput.checked
      dir.continueSession = continueInput.checked
      // Standard-Tab: nur eine Kachel darf defaultTab=true sein
      if (defaultInput.checked) {
        savedDirectories.forEach(d => { d.defaultTab = false })
      }
      dir.defaultTab = defaultInput.checked
      persistConfig()
      renderCards()
    }

    // Karten-Klick tut nichts mehr – Editor öffnet sich nur über Settings-Button
    card.querySelector('.dir-card-settings-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      openEditor(e)
    })

    card.querySelector('.dir-card-play-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      openTerminalForDir(dir)
    })

    card.querySelector('.dir-card-stop-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      const tab = tabs.find(t => t.cwd === dir.path)
      if (tab) closeTab(tab.id)
    })

    card.querySelector('.dir-card-restart-btn').addEventListener('click', async (e) => {
      e.stopPropagation()
      const tab = tabs.find(t => t.cwd === dir.path)
      const tabIndex = tab ? tabs.indexOf(tab) : -1
      const wasActive = tab?.id === activeId
      if (tab) await closeTab(tab.id)
      await openTerminalForDir(dir)
      if (tabIndex !== -1) {
        const newTab = tabs.find(t => t.cwd === dir.path)
        if (newTab) {
          const currentIdx = tabs.indexOf(newTab)
          tabs.splice(currentIdx, 1)
          tabs.splice(tabIndex, 0, newTab)
          if (wasActive) activatePane(newTab.id)
          else renderTabBar()
        }
      }
    })

    card.querySelector('.dir-card-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      savedDirectories = savedDirectories.filter(d => d.path !== dir.path)
      persistConfig()
      renderCards()
    })

    card.querySelector('.dir-card-editor-save').addEventListener('click', (e) => {
      e.stopPropagation(); saveEdit()
    })

    card.querySelector('.dir-card-editor-cancel').addEventListener('click', (e) => {
      e.stopPropagation(); closeEditor()
    })

    // Enter speichert, Escape bricht ab
    editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); saveEdit() }
      if (e.key === 'Escape') { e.preventDefault(); closeEditor() }
    })

    editorEl.addEventListener('click', (e) => e.stopPropagation())

    updateCardState(card, dir)
    return card
  }

  async function openTerminalForDir(dir) {
    const existing = tabs.find(t => t.cwd === dir.path)
    if (existing) { activatePane(existing.id); return }
    const args = [
      dir.model           ? `--model ${dir.model}` : '',
      dir.continueSession ? '--continue'            : ''
    ].filter(Boolean).join(' ')
    const id = await createTab(dir.name, dir.path, args)
    activatePane(id)
  }

  // ── Ordner-Dialog + Speichern-Dialog ──────────────────────────────────────
  async function openFolderDialog() {
    let folderPath
    try { folderPath = await window.api.openFolder() } catch (e) { return }
    if (!folderPath) return
    const defaultName = folderPath.split(/[\\/]/).pop() || folderPath
    showSaveDialog(folderPath, defaultName)
  }

  function showSaveDialog(folderPath, defaultName) {
    const overlay   = document.getElementById('save-dialog-overlay')
    const nameInput = document.getElementById('save-dialog-name')
    document.getElementById('save-dialog-path').textContent = folderPath
    nameInput.value = defaultName
    overlay.classList.remove('hidden')
    nameInput.focus(); nameInput.select()

    const cleanup = () => overlay.classList.add('hidden')

    const onYes = async () => {
      cleanup()
      const name = nameInput.value.trim() || defaultName
      if (!savedDirectories.find(d => d.path === folderPath)) {
        savedDirectories.push({ name, path: folderPath })
        persistConfig()
        renderCards()
      }
      const id = await createTab(name, folderPath)
      activatePane(id)
    }
    const onSaveOnly = () => {
      cleanup()
      const name = nameInput.value.trim() || defaultName
      if (!savedDirectories.find(d => d.path === folderPath)) {
        savedDirectories.push({ name, path: folderPath })
        persistConfig()
        renderCards()
      }
    }
    const onNo = async () => {
      cleanup()
      const id = await createTab(defaultName, folderPath)
      activatePane(id)
    }
    const onCancel = () => cleanup()

    replaceListener('save-dialog-yes',       onYes)
    replaceListener('save-dialog-save-only', onSaveOnly)
    replaceListener('save-dialog-no',        onNo)
    replaceListener('save-dialog-cancel',    onCancel)

    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter')  onYes()
      if (e.key === 'Escape') onCancel()
    }
  }

  function replaceListener(id, handler) {
    const el = document.getElementById(id)
    const clone = el.cloneNode(true)
    el.parentNode.replaceChild(clone, el)
    clone.addEventListener('click', handler)
  }

  // ── Tab erstellen ──────────────────────────────────────────────────────────
  async function createTab(name, cwd, args = '') {
    tabCounter++
    const id = `tab-${tabCounter}`

    // Pane erstellen
    const pane = document.createElement('div')
    pane.className = 'content-pane terminal-pane'
    pane.id = `pane-${id}`
    contentArea.appendChild(pane)

    // Kurz sichtbar machen damit xterm messen kann
    pane.classList.add('active')

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff',
        selectionBackground: 'rgba(0,122,204,0.3)',
        black: '#1e1e1e', red: '#f44747', green: '#4ec9b0', yellow: '#dcdcaa',
        blue: '#569cd6', magenta: '#c586c0', cyan: '#9cdcfe', white: '#d4d4d4',
        brightBlack: '#808080', brightRed: '#f44747', brightGreen: '#4ec9b0',
        brightYellow: '#dcdcaa', brightBlue: '#569cd6', brightMagenta: '#c586c0',
        brightCyan: '#9cdcfe', brightWhite: '#ffffff',
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 13, lineHeight: 1.3, cursorBlink: true, scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(pane)
    try { fitAddon.fit() } catch (e) {}

    // Sofort wieder ausblenden – activatePane übernimmt das
    pane.classList.remove('active')

    const unsubData = window.api.onPtyData(id, (data) => terminal.write(data))
    const unsubExit = window.api.onPtyExit(id, (code) => {
      const tab = tabs.find(t => t.id === id)
      if (tab) { tab.status = 'stopped'; renderTabBar() }
      terminal.write(`\r\n\x1b[33m[Prozess beendet mit Code ${code}]\x1b[0m\r\n`)
    })
    terminal.onData((data) => window.api.writePty(id, data))

    // Paste komplett selbst steuern:
    // 1. pane-Capture stoppt das paste-Event bevor es xterm's textarea erreicht
    // 2. Ctrl+V in attachCustomKeyEventHandler liest Clipboard und schreibt via writePty
    // So gibt es exakt einen Pfad für Paste.
    pane.addEventListener('paste', (e) => {
      e.stopPropagation()
      e.preventDefault()
    }, true)

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'c' && terminal.hasSelection()) {
        navigator.clipboard.writeText(terminal.getSelection())
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (text) window.api.writePty(id, text)
        })
        return false
      }
      return true
    })

    const tabObj = { id, name, cwd, terminal, fitAddon, unsubData, unsubExit, status: 'stopped' }
    tabs.push(tabObj)
    renderTabBar()

    try {
      const result = await window.api.createPty(id, cwd, args)
      if (result?.ok) { tabObj.status = 'running'; renderTabBar() }
    } catch (e) {
      tabObj.status = 'error'
      terminal.write(`\r\n\x1b[31m[Fehler: ${e.message}]\x1b[0m\r\n`)
      renderTabBar()
    }

    return id
  }

  // ── Tab-Reihenfolge ────────────────────────────────────────────────────────
  function applyTabOrder(order) {
    if (!order?.length) return
    tabs.sort((a, b) => {
      const ai = order.indexOf(a.cwd)
      const bi = order.indexOf(b.cwd)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    renderTabBar()
  }

  async function persistTabOrder() {
    try {
      const config = await window.api.loadConfig()
      config.tabOrder = tabs.map(t => t.cwd)
      await window.api.saveConfig(config)
    } catch (e) { console.error('[persistTabOrder]', e) }
  }

  // ── Tab Bar ────────────────────────────────────────────────────────────────
  function renderTabBar() {
    // Home-Tab aktiv-Status
    document.getElementById('tab-home').classList.toggle('active', activeId === 'home')

    tabsContainer.innerHTML = ''
    for (const tab of tabs) {
      const el = document.createElement('div')
      el.className = `tab ${tab.status} ${tab.id === activeId ? 'active' : ''}`
      el.dataset.id = tab.id
      el.innerHTML = `
        <div class="tab-indicator"></div>
        <span class="tab-label" title="${escapeHtml(tab.cwd)}">${escapeHtml(tab.name)}</span>
        <button class="tab-close" title="Tab schließen">×</button>
      `
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) return
        activatePane(tab.id)
      })
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); showContextMenu(e.clientX, e.clientY, tab.id)
      })
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation(); closeTab(tab.id)
      })

      // Drag & Drop
      el.draggable = true
      el.addEventListener('dragstart', (e) => {
        draggedTabId = tab.id
        e.dataTransfer.effectAllowed = 'move'
        requestAnimationFrame(() => el.classList.add('dragging'))
      })
      el.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'))
        if (draggedTabId !== tab.id) el.classList.add('drag-over')
      })
      el.addEventListener('drop', (e) => {
        e.preventDefault()
        if (!draggedTabId || draggedTabId === tab.id) return
        const fromIdx = tabs.findIndex(t => t.id === draggedTabId)
        const toIdx   = tabs.findIndex(t => t.id === tab.id)
        if (fromIdx !== -1 && toIdx !== -1) {
          tabs.splice(toIdx, 0, tabs.splice(fromIdx, 1)[0])
        }
        draggedTabId = null
        renderTabBar()
        persistTabOrder()
      })
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging')
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'))
        draggedTabId = null
      })

      tabsContainer.appendChild(el)
    }

    // Karten-Buttons mit Tab-Status synchronisieren
    document.querySelectorAll('.dir-card[data-cwd]').forEach(card => {
      const dir = savedDirectories.find(d => d.path === card.dataset.cwd)
      if (dir) updateCardState(card, dir)
    })
  }

  // ── Tab schließen ──────────────────────────────────────────────────────────
  async function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id)
    if (idx === -1) return
    const tab = tabs[idx]
    try { tab.unsubData() } catch (e) {}
    try { tab.unsubExit() } catch (e) {}
    try { await window.api.killPty(id) } catch (e) {}
    try { tab.terminal.dispose() } catch (e) {}
    document.getElementById(`pane-${id}`)?.remove()
    tabs.splice(idx, 1)

    if (activeId === id) {
      if (tabs.length > 0) {
        activatePane(tabs[Math.min(idx, tabs.length - 1)].id)
      } else {
        activatePane('home')
      }
    } else {
      renderTabBar()
    }
  }

  // ── Context Menu ───────────────────────────────────────────────────────────
  function showContextMenu(x, y, tabId) {
    contextMenuTabId = tabId
    contextMenu.classList.remove('hidden')
    contextMenu.style.left = `${x}px`
    contextMenu.style.top  = `${y}px`
    requestAnimationFrame(() => {
      const rect = contextMenu.getBoundingClientRect()
      if (rect.right  > window.innerWidth)  contextMenu.style.left = `${x - rect.width}px`
      if (rect.bottom > window.innerHeight) contextMenu.style.top  = `${y - rect.height}px`
    })
  }
  function hideContextMenu() { contextMenu.classList.add('hidden'); contextMenuTabId = null }

  document.addEventListener('click', (e) => { if (!contextMenu.contains(e.target)) hideContextMenu() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideContextMenu() })

  document.getElementById('ctx-rename').addEventListener('click', () => {
    const id = contextMenuTabId; hideContextMenu()
    if (!id) return
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    const labelEl = document.querySelector(`.tab[data-id="${id}"] .tab-label`)
    if (!labelEl) return
    const input = document.createElement('input')
    input.type = 'text'; input.className = 'tab-rename-input'; input.value = tab.name
    labelEl.replaceWith(input); input.focus(); input.select()
    const commit = () => { tab.name = input.value.trim() || tab.name; renderTabBar() }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); input.blur() }
      if (e.key === 'Escape') { input.value = tab.name; input.blur() }
    })
  })

  document.getElementById('ctx-change-dir').addEventListener('click', async () => {
    const id = contextMenuTabId; hideContextMenu()
    if (!id) return
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    const newPath = await window.api.openFolder()
    if (!newPath) return
    tab.cwd = newPath
    try {
      const result = await window.api.createPty(id, newPath)
      if (result?.ok) { tab.status = 'running'; renderTabBar() }
    } catch (e) { console.error(e) }
  })

  document.getElementById('ctx-restart').addEventListener('click', async () => {
    const id = contextMenuTabId; hideContextMenu()
    if (!id) return
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    tab.terminal.clear()
    try {
      const result = await window.api.createPty(id, tab.cwd)
      if (result?.ok) { tab.status = 'running'; renderTabBar() }
    } catch (e) { console.error(e) }
  })

  document.getElementById('ctx-close').addEventListener('click', () => {
    const id = contextMenuTabId; hideContextMenu()
    if (id) closeTab(id)
  })

  // ── Config ─────────────────────────────────────────────────────────────────
  function persistConfig() {
    window.api.saveConfig({ directories: savedDirectories })
  }

  // ── Resize Observer ────────────────────────────────────────────────────────
  new ResizeObserver(() => {
    if (!activeId || activeId === 'home') return
    const tab = tabs.find(t => t.id === activeId)
    if (tab) {
      try { tab.fitAddon.fit(); window.api.resizePty(activeId, tab.terminal.cols, tab.terminal.rows) } catch (e) {}
    }
  }).observe(contentArea)

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); openFolderDialog() }
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeId !== 'home') closeTab(activeId) }
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault()
      if (tabs.length === 0) return
      const allIds = ['home', ...tabs.map(t => t.id)]
      const idx = allIds.indexOf(activeId)
      const next = e.shiftKey ? allIds[(idx - 1 + allIds.length) % allIds.length] : allIds[(idx + 1) % allIds.length]
      activatePane(next)
    }
  })

  // ── Utils ──────────────────────────────────────────────────────────────────
  function updateCardState(card, dir) {
    const tab = tabs.find(t => t.cwd === dir.path)
    const running = tab?.status === 'running'
    card.querySelector('.dir-card-play-btn').classList.toggle('hidden', running)
    card.querySelector('.dir-card-stop-btn').classList.toggle('hidden', !running)
    card.querySelector('.dir-card-restart-btn').classList.toggle('hidden', !running)
  }

  function providerDisplayName(providerID) {
    const names = {
      'opencode':      'OpenCode',
      'github-copilot': 'GitHub Copilot',
      'litellm':       'LiteLLM',
    }
    return names[providerID] || providerID
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }
})
