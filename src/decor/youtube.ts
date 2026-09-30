// YouTube links for the TV screen: any common form to a video id (and a start time).

export interface YouTubeVideo {
  id: string
  /** Seconds to start at, from `t=` or `start=`. */
  start: number
}

const ID = /^[\w-]{11}$/

/** Seconds from "90", "1m30s", "1h2m3s". */
function seconds(t: string | null): number {
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

/** A video from a watch, share, embed or shorts link, or a bare id; null for anything else. */
export function parseYouTube(input: string): YouTubeVideo | null {
  const s = input.trim()
  if (!s) return null
  if (ID.test(s)) return { id: s, start: 0 }
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'watch') id = url.searchParams.get('v')
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] ?? null
  }
  if (!id || !ID.test(id)) return null
  return { id, start: seconds(url.searchParams.get('t') ?? url.searchParams.get('start')) }
}

/** The privacy-enhanced embed for a video. */
export function embedUrl(v: YouTubeVideo): string {
  const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
  if (v.start) q.set('start', String(v.start))
  return `https://www.youtube-nocookie.com/embed/${v.id}?${q}`
}
