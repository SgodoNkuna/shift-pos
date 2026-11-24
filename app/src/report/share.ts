/** True when this phone can hand files to WhatsApp directly. */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try { return !!nav.share && !!nav.canShare?.({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }) } catch { return false }
}

/** Opens the phone's share sheet (WhatsApp, etc.) with the files. Falls back to downloading them. */
export async function shareFiles(files: File[], text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files })) {
    try { await nav.share({ files, text }); return 'shared' }
    catch (e) { if (['AbortError', 'NotAllowedError'].includes((e as Error).name)) return 'cancelled'; throw e }
  }
  for (const f of files) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f); a.download = f.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
  return 'saved'
}
