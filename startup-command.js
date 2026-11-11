const path = require('path')

// Run setup in the same shell so sourced environment changes reach OpenCode.
function buildStartupCommand(shell, args, preStartCommand) {
  const command = args ? `opencode ${args}` : 'opencode'
  const setup = typeof preStartCommand === 'string' ? preStartCommand.trim() : ''
  if (!setup) return `${command}\r`

  const shellName = path.basename(shell).toLowerCase()
  if (shellName === 'pwsh.exe' || shellName === 'powershell.exe') {
    return `${setup}; if ($?) { ${command} }\r`
  }
  return `${setup} && ${command}\r`
}

module.exports = { buildStartupCommand }
