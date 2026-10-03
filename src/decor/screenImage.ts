/** Where the page loads a picture from: local paths as they are, other links through the dev server (no CORS). */
export function screenImageSrc(link: string): string | null {
  const s = link.trim()
  if (!s) return null
  if (s.startsWith('/')) return s
  if (/^https?:\/\//i.test(s)) return `/api/image?url=${encodeURIComponent(s)}`
  return null
}
