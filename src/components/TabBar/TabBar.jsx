import styles from './TabBar.module.css'
import { Tab } from './Tab'
import { ActionsMenu } from '../ActionsMenu/ActionsMenu'
import { getLanguage, t } from '../../i18n'

export function TabBar({ tabs, activeId, onActivate, onCloseTab, onAddTab, onContextMenu, onMoveTab }) {
  return (
    <div className={styles.tabBar} id="tab-bar">
      <Tab
        id="home"
        isHome
        label={t('tab.home')}
        isActive={activeId === 'home'}
        onActivate={onActivate}
      />
      <div className={styles.tabsContainer} id="tabs-container">
        {tabs.map((tab, idx) => (
          <Tab
            key={tab.id}
            id={tab.id}
            tab={tab}
            isActive={tab.id === activeId}
            onActivate={onActivate}
            onClose={onCloseTab}
            onContextMenu={onContextMenu}
            onMoveTab={onMoveTab}
            index={idx}
            totalTabs={tabs.length}
          />
        ))}
      </div>
      <button
        className={styles.addTabBtn}
        id="btn-add-tab"
        title={t('tab.newTerminal')}
        onClick={onAddTab}
      >
        +
      </button>
      <ActionsMenu />
    </div>
  )
}
