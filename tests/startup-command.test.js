import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import startupCommand from '../startup-command'

const { buildStartupCommand } = startupCommand

describe('buildStartupCommand', () => {
  it('preserves direct launch and OpenCode arguments for old cards', () => {
    expect(buildStartupCommand('/bin/bash', '', undefined)).toBe('opencode\r')
    expect(buildStartupCommand('/bin/bash', '--model provider/model --continue', '  '))
      .toBe('opencode --model provider/model --continue\r')
  })

  it('chains setup and OpenCode in Unix shells and cmd', () => {
    for (const shell of ['/bin/bash', '/bin/zsh', 'cmd.exe']) {
      expect(buildStartupCommand(shell, '--continue', '  ./setup-script  '))
        .toBe('./setup-script && opencode --continue\r')
    }
  })

  it('uses a success guard compatible with Windows PowerShell and PowerShell 7', () => {
    for (const shell of ['powershell.exe', 'pwsh.exe']) {
      expect(buildStartupCommand(shell, '--continue', '. ./setup.ps1'))
        .toBe('. ./setup.ps1; if ($?) { opencode --continue }\r')
    }
  })

  it('passes setup environment changes to OpenCode in the same shell', () => {
    const command = buildStartupCommand('/bin/bash', '--continue', 'export LAUNCHER_SETUP_TEST=ready')
    const output = execFileSync('/bin/bash', ['-c',
      `opencode() { printf '%s %s' "$LAUNCHER_SETUP_TEST" "$1"; }; ${command.trimEnd()}`,
    ], { encoding: 'utf8' })
    expect(output).toBe('ready --continue')
  })

  it('does not launch OpenCode after a failed setup', () => {
    const command = buildStartupCommand('/bin/bash', '', 'false')
    const output = execFileSync('/bin/bash', ['-c',
      `opencode() { printf 'started'; }; ${command.trimEnd()}; :`,
    ], { encoding: 'utf8' })
    expect(output).toBe('')
  })
})
