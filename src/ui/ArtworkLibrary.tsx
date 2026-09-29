import { memo, useMemo, useRef, useState, type DragEvent } from 'react'
import { create } from 'zustand'
import { FRAME_COLORS, SIZE_PRESETS } from '../decor/catalog'
import { newId, useDecor, type LibraryImage } from '../decor/store'
import { unplacedAt } from '../scene/decor/DecorLayer'
import { matches } from './format'
import { Icon } from './icons'
import { NoResults } from './Libraries'

// ---------- uploads ----------

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
const EXT = /\.(png|jpe?g|webp|gif|avif)$/i
const MAX_MB = 30

interface UploadState {
  total: number
  done: number
  current: string | null
  errors: { id: number; text: string }[]
  dismiss: (id: number) => void
}

export const useUploads = create<UploadState>((set) => ({
  total: 0,
  done: 0,
  current: null,
  errors: [],
  dismiss: (id) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
}))

let errorId = 0
const fail = (text: string) => useUploads.setState((s) => ({ errors: [...s.errors, { id: ++errorId, text }] }))

/** Checks and uploads files one at a time, reporting progress and per-file errors. */
export async function uploadFiles(files: File[]) {
  const ok: File[] = []
  for (const f of files) {
    if (!EXT.test(f.name)) fail(`“${f.name}” is not a supported image. Use PNG, JPEG, WebP, GIF or AVIF.`)
    else if (f.size > MAX_MB * 1024 * 1024) fail(`“${f.name}” is larger than ${MAX_MB} MB. Resize it and try again.`)
    else ok.push(f)
  }
  if (ok.length === 0) return
  const upload = useDecor.getState().upload
  useUploads.setState((s) => ({ total: s.total - s.done + ok.length, done: 0 }))
  for (const f of ok) {
    useUploads.setState({ current: f.name })
    try {
      const img = await upload(f)
      if (!img) fail(`Unable to upload “${f.name}”. ${useDecor.getState().error ?? ''} Try again.`.replace(/\s+/g, ' '))
    } catch {
      fail(`Unable to upload “${f.name}”. Check that the dev server is running, then try again.`)
    }
    useUploads.setState((s) => ({ done: s.done + 1 }))
  }
  useUploads.setState({ total: 0, done: 0, current: null })
}

/** True when a drag carries files (not text or a link). */
export const dragHasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')

// ---------- library ----------

function naturalSize(url: string, el: HTMLImageElement | null): Promise<[number, number]> {
  if (el?.complete && el.naturalWidth) return Promise.resolve([el.naturalWidth, el.naturalHeight])
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve([img.naturalWidth || 1, img.naturalHeight || 1])
    img.onerror = () => resolve([1, 1])
    img.src = url
  })
}

export function ArtworkLibrary({ query, onClear }: { query: string; onClear: () => void }) {
  const library = useDecor((s) => s.library)
  const startPlacing = useDecor((s) => s.startPlacing)
  const input = useRef<HTMLInputElement>(null)
  const shown = useMemo(() => library.filter((img) => matches(query, img.name)), [library, query])

  const place = async (url: string, el: HTMLImageElement | null) => {
    const [width, height] = await naturalSize(url, el)
    const landscape = width > height * 1.05
    const [pw, ph] = SIZE_PRESETS[1].size
    startPlacing({
      kind: 'artwork',
      id: newId('artwork'),
      image: url,
      at: unplacedAt(),
      facing: 'z+',
      size: { preset: 'A4', w: landscape ? ph : pw, h: landscape ? pw : ph },
      fit: 'cover',
      frame: { style: 'thin', color: FRAME_COLORS[0].color, mat: 0 },
    })
  }

  return (
    <div className="library">
      <UploadBox onBrowse={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          void uploadFiles(files)
        }}
      />
      {library.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No images yet</p>
          <p className="note">Upload a photo or a print to hang it on a wall. Files also appear here when you add them to public/artwork.</p>
        </div>
      ) : shown.length === 0 ? (
        <NoResults query={query} noun="artwork" onClear={onClear} />
      ) : (
        <section className="lib-group" aria-labelledby="g-images">
          <h3 className="group-label" id="g-images">
            Choose an image to hang <span className="count">{shown.length}</span>
          </h3>
          <ul className="thumbs">
            {shown.map((img) => (
              <Thumb key={img.url} img={img} onPick={place} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const Thumb = memo(function Thumb({ img, onPick }: { img: LibraryImage; onPick: (url: string, el: HTMLImageElement | null) => void }) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  return (
    <li>
      <button type="button" className={`thumb${loaded ? ' loaded' : ''}`} title={img.name} aria-label={`Hang ${img.name}`} onClick={() => onPick(img.url, ref.current)}>
        <img ref={ref} src={img.url} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} />
      </button>
    </li>
  )
})

function UploadBox({ onBrowse }: { onBrowse: () => void }) {
  const { total, done, current, errors, dismiss } = useUploads()
  const busy = total > 0
  return (
    <div className="upload">
      <button type="button" className="dropzone" onClick={onBrowse} disabled={busy}>
        <Icon name="upload" size={18} />
        <span>
          <strong>Upload images</strong>
          <span className="note">or drop them anywhere on this panel</span>
        </span>
      </button>
      <div role="status" className="upload-status">
        {busy && (
          <>
            <span>
              Uploading {Math.min(done + 1, total)} of {total}
              {current ? ` · ${current}` : ''}
            </span>
            <progress max={total} value={done + 0.5} aria-label="Upload progress" />
          </>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="upload-errors">
          {errors.map((e) => (
            <li key={e.id} role="alert">
              <Icon name="alert" size={14} />
              <span>{e.text}</span>
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(e.id)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
