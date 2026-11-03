// Browser text download without a dependency. Code fences, table CSV export,
// and message Markdown export each own their file name and content.

/**
 * Trigger a browser download of text content through a temporary anchor.
 * @param name - The file name the browser saves.
 * @param text - The exact bytes to write.
 * @param mimeType - The blob MIME type; defaults to plain text.
 */
export function downloadTextFile(name: string, text: string, mimeType = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Defer the revoke so the browser commits the download before the object URL dies.
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}
