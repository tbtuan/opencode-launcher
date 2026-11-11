import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CardEditor } from '../components/Dashboard/DirectoryCard/CardEditor'

vi.mock('../i18n', () => ({ t: (key) => key }))

const dir = { _id: 1, name: 'Project', path: '/projects/test' }

describe('CardEditor setup command', () => {
  it('defaults to empty for existing cards and saves the configured command', () => {
    const onSave = vi.fn()
    render(<CardEditor dir={dir} onSave={onSave} />)
    const input = screen.getByLabelText('editor.preStartCommand')
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: ' source "./setup script.sh" ' } })
    fireEvent.click(screen.getByText('editor.save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      preStartCommand: 'source "./setup script.sh"',
    }))
  })

  it('loads an existing command and allows clearing it', () => {
    const onSave = vi.fn()
    render(<CardEditor dir={{ ...dir, preStartCommand: '. ./setup.ps1' }} onSave={onSave} />)
    const input = screen.getByLabelText('editor.preStartCommand')
    expect(input).toHaveValue('. ./setup.ps1')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByText('editor.save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ preStartCommand: '' }))
  })
})
