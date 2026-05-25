import styles from './DirectoryCard.module.css'
import { t } from '../../../i18n'
import { providerDisplayName, groupModelsByProvider } from '../../../utils/helpers'

export function ModelSelector({ models, selectedModel, onSelect }) {
  const groups = groupModelsByProvider(models)

  return (
    <select
      className={styles.modelSelect}
      value={selectedModel || ''}
      onChange={(e) => onSelect(e.target.value || undefined)}
    >
      <option value="">{t('models.noSelection')}</option>
      {Object.entries(groups).map(([providerID, providerModels]) => (
        <optgroup key={providerID} label={providerDisplayName(providerID)}>
          {providerModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
