export function providerDisplayName(providerID) {
  const names = {
    'opencode': 'OpenCode',
    'github-copilot': 'GitHub Copilot',
    'litellm': 'LiteLLM',
  }
  return names[providerID] || providerID
}

export function groupModelsByProvider(models) {
  const groups = {}
  for (const m of models) {
    if (!groups[m.providerID]) groups[m.providerID] = []
    groups[m.providerID].push(m)
  }
  return groups
}

export function formatTimestamp(isoString, locale) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getDirNameFromPath(path) {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
}
