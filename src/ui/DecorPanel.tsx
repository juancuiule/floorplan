import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useDecor, type PanelTab } from '../decor/store'
import { ArtworkLibrary, dragHasFiles, uploadFiles } from './ArtworkLibrary'
import { TABS, tabOfKind } from './format'
import { Icon } from './icons'
import { Inspector } from './Inspector'
import { CatalogLibrary, LIBRARY_ENTRIES } from './Libraries'
import { RoomList, useRoomCounts } from './RoomList'
import { useUi } from './uiStore'

// The right-hand panel: tabs per kind, a searchable library or the inspector
// for the selected item, and the list of what is in the room. Each part
// subscribes to the narrowest slice of the store it needs, so dragging an
// item around the room does not re-render the libraries.

export function DecorPanel() {
  const open = useUi((s) => s.panelOpen)
  if (!open) return null
  return <PanelBody />
}

function PanelBody() {
  const tab = useDecor((s) => s.tab)
  const setTab = useDecor((s) => s.setTab)
  const selectedId = useDecor((s) => s.selectedId)
  const selectedKind = useDecor((s) => s.items.find((i) => i.id === s.selectedId)?.kind)
  const error = useDecor((s) => (s.error?.startsWith('Saving') ? s.error : null))
  const [query, setQuery] = useState('')
  const [dropping, setDropping] = useState(false)
  const dragDepth = useRef(0)
  const current = TABS.find((t) => t.id === tab)!

  // Selecting something in the room brings its tab forward.
  useEffect(() => {
    if (selectedKind) setTab(tabOfKind(selectedKind).id)
  }, [selectedId, selectedKind, setTab])

  const changeTab = (id: PanelTab) => {
    if (id === tab) return
    setTab(id)
    setQuery('')
  }

  const showInspector = !!selectedId && selectedKind === current.kind

  return (
    <aside
      id="decor-panel"
      className={`panel${dropping ? ' dropping' : ''}`}
      aria-label="Decor"
      onDragEnter={(e) => {
        if (!dragHasFiles(e)) return
        dragDepth.current++
        setDropping(true)
      }}
      onDragOver={(e) => {
        if (!dragHasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        if (!dragHasFiles(e)) return
        if (--dragDepth.current <= 0) setDropping(false)
      }}
      onDrop={(e) => {
        if (!dragHasFiles(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDropping(false)
        changeTab('artwork')
        if (selectedId) useDecor.getState().select(null)
        void uploadFiles([...e.dataTransfer.files])
      }}
    >
      <Tabs tab={tab} onChange={changeTab} />

      <div className="panel-body" role="tabpanel" id="decor-tabpanel" aria-labelledby={`tab-${tab}`}>
        {error && (
          <p className="banner" role="status">
            <Icon name="alert" size={14} />
            {error}
          </p>
        )}
        {showInspector ? (
          <Inspector id={selectedId!} />
        ) : (
          <>
            <SearchBox query={query} onChange={setQuery} placeholder={`Search ${current.noun}`} />
            {tab === 'artwork' ? (
              <ArtworkLibrary query={query} onClear={() => setQuery('')} />
            ) : (
              <CatalogLibrary entries={LIBRARY_ENTRIES[tab]} query={query} noun={current.noun} onClear={() => setQuery('')} />
            )}
          </>
        )}
      </div>

      <RoomList />

      {dropping && (
        <div className="drop-overlay" aria-hidden="true">
          <Icon name="upload" size={24} />
          <strong>Drop images to add them to your artwork</strong>
        </div>
      )}
    </aside>
  )
}

function Tabs({ tab, onChange }: { tab: PanelTab; onChange: (t: PanelTab) => void }) {
  const counts = useRoomCounts()
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const t = TABS[(next + TABS.length) % TABS.length]
    onChange(t.id)
    document.getElementById(`tab-${t.id}`)?.focus()
  }
  return (
    <div className="tabs" role="tablist" aria-label="Decor type" onKeyDown={onKeyDown}>
      {TABS.map((t, i) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          aria-controls="decor-tabpanel"
          tabIndex={tab === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          <Icon name={t.icon} size={18} />
          <span className="tab-label">{t.label}</span>
          {counts[i] > 0 && (
            <span className="badge" aria-label={`, ${counts[i]} in the room`}>
              {counts[i]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function SearchBox({ query, onChange, placeholder }: { query: string; onChange: (q: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <label htmlFor="decor-search" className="sr-only">
        {placeholder}
      </label>
      <Icon name="search" size={16} className="search-icon" />
      <input
        id="decor-search"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        value={query}
        aria-keyshortcuts="/"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && query) {
            e.stopPropagation()
            onChange('')
          }
        }}
      />
      {query ? (
        <button type="button" className="icon-btn clear" aria-label="Clear search" onClick={() => onChange('')}>
          <Icon name="close" size={14} />
        </button>
      ) : (
        <kbd className="search-kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  )
}
