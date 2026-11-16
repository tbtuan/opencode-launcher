// OpenCode 2 removed `--model` from the full-screen TUI (it only exists on
// `mini` and `run`). To keep the shared background service while still pinning
// a per-directory model, preselect the model on the session through the server
// API and then open the TUI on that session with `--session <id>`.
const { execFile, execSync } = require('child_process')

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function createOpencodeSessions({ log = () => {}, platform = process.platform } = {}) {
  let powerShellExe = null

  function resolvePowerShell() {
    if (powerShellExe) return powerShellExe
    for (const candidate of ['pwsh.exe', 'powershell.exe']) {
      try {
        execSync(`where.exe ${candidate}`, { stdio: 'ignore' })
        powerShellExe = candidate
        return candidate
      } catch {}
    }
    powerShellExe = 'powershell.exe'
    return powerShellExe
  }

  // Run `opencode api ...` and return stdout. On Windows the npm shim is a .ps1
  // file, which child_process cannot execute directly, so go through PowerShell.
  function opencodeApi(args, { timeout = 20000 } = {}) {
    return new Promise((resolve, reject) => {
      const done = (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr || stdout || err.message || 'opencode api failed').trim()))
        } else {
          resolve(stdout)
        }
      }
      if (platform === 'win32') {
        const command = `& opencode api ${args.map(psQuote).join(' ')}`
        execFile(resolvePowerShell(), ['-NoProfile', '-NonInteractive', '-Command', command], {
          timeout,
          windowsHide: true,
          encoding: 'utf8',
        }, done)
      } else {
        execFile('opencode', ['api', ...args], { timeout, encoding: 'utf8' }, done)
      }
    })
  }

  // `provider/model` (optionally `provider/model#variant`) -> Model.Ref
  function parseModelRef(reference) {
    if (typeof reference !== 'string') return null
    const slash = reference.indexOf('/')
    if (slash <= 0 || slash === reference.length - 1) return null
    const providerID = reference.slice(0, slash)
    const [id, variant] = reference.slice(slash + 1).split('#')
    if (!id) return null
    return variant ? { providerID, id, variant } : { providerID, id }
  }

  async function listAvailableModels(directory) {
    const query = `location%5Bdirectory%5D=${encodeURIComponent(directory)}`
    const parsed = JSON.parse(await opencodeApi(['get', `/api/model?${query}`]))
    return Array.isArray(parsed?.data) ? parsed.data : []
  }

  // Resolve the session `--continue` should resume. Preset sessions created by
  // this launcher start empty and are the newest entries, so prefer the latest
  // session that actually has tokens; fall back to the newest one.
  async function latestSessionAt(directory) {
    const query = `directory=${encodeURIComponent(directory)}&order=desc&limit=20`
    const parsed = JSON.parse(await opencodeApi(['get', `/api/session?${query}`]))
    const sessions = Array.isArray(parsed?.data) ? parsed.data : []
    if (!sessions.length) return null
    const active = sessions.find(s => (s.tokens?.input || 0) > 0 || (s.tokens?.output || 0) > 0)
    return active || sessions[0]
  }

  async function createSessionWithModel(directory, model) {
    const body = JSON.stringify({ model, location: { directory } })
    const parsed = JSON.parse(await opencodeApi(['post', '/api/session', '-d', body]))
    const id = parsed?.data?.id
    if (!id) throw new Error('session.create returned no id')
    return id
  }

  async function setSessionModel(sessionID, model) {
    const body = JSON.stringify({ model })
    await opencodeApi(['post', `/api/session/${sessionID}/model`, '-d', body])
  }

  function defaultOpencodeCommand(args) {
    return args ? `opencode ${args}` : 'opencode'
  }

  // Build the shell command that starts the TUI. Falls back to a plain launch
  // whenever the model is unavailable or the API cannot be reached.
  async function buildOpencodeLaunch(cwd, args, model) {
    const wantsContinue = /(^|\s)--continue(\s|$)/.test(args || '')
    const fallback = defaultOpencodeCommand(args)
    const modelRef = parseModelRef(model)
    if (!modelRef) return fallback
    try {
      const available = await listAvailableModels(cwd)
      const usable = available.some(m => m && m.providerID === modelRef.providerID && m.id === modelRef.id)
      if (!usable) {
        log('warn', 'model preset skipped: not available at location', { cwd, model })
        return fallback
      }
      if (wantsContinue) {
        const last = await latestSessionAt(cwd)
        if (last?.id) {
          await setSessionModel(last.id, modelRef)
          log('info', 'model preset applied to continued session', { sessionID: last.id, model })
          return `opencode --session ${last.id}`
        }
      }
      const sessionID = await createSessionWithModel(cwd, modelRef)
      log('info', 'model preset applied to new session', { sessionID, model })
      return `opencode --session ${sessionID}`
    } catch (e) {
      log('warn', 'model preset failed, launching with default model', { cwd, model, error: e?.message })
      return fallback
    }
  }

  return { opencodeApi, parseModelRef, buildOpencodeLaunch, defaultOpencodeCommand }
}

module.exports = { createOpencodeSessions, psQuote }
