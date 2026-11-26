import { useState } from 'react'
import { BrandMark, useToast } from '../kit'

/** iOS version from the browser, e.g. 17.4, or null if unknown. */
export function iosVersion(ua = navigator.userAgent): number | null {
  const m = ua.match(/OS (\d+)_(\d+)/)
  return m ? parseFloat(`${m[1]}.${m[2]}`) : null
}

/** Pulls the invite code out of a pasted link (or a bare code). */
export function tokenFrom(text: string): string | null {
  const m = text.match(/join=([0-9a-f]{32,})/i) ?? text.trim().match(/^([0-9a-f]{32,})$/i)
  return m ? m[1].toLowerCase() : null
}

const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-5px' }}>
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>)

/**
 * iPhone, opened in Safari (not yet from the Home Screen). A Home Screen app keeps its own storage on iPhone,
 * so the phone must join from inside the Home Screen app: copy the link, add to Home Screen, open it, paste.
 */
export function IosSetup({ token }: { token: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}/?join=${token}`
  const v = iosVersion()
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast('Link copied') }
    catch { const el = document.getElementById('ios-link') as HTMLInputElement | null; el?.select(); toast('Press and hold the link, then Copy') }
  }
  return (
    <div className="main enter"><div className="pad stack">
      <BrandMark />
      <h2 style={{ margin: 0 }}>Set up on iPhone</h2>
      <div className="note">Four short steps. Do them in order, in <b>Safari</b>.</div>
      {v != null && v < 16.4 && <div className="banner warnb"><b>Update your iPhone first.</b><span>Alerts need iOS 16.4 or newer. Go to Settings → General → Software Update.</span></div>}

      <ol className="ios-steps">
        <li><b>Make sure you are in Safari.</b>
          <span>Opened from WhatsApp? Tap the button below. If it does nothing, tap <b>⋯</b> or the compass at the bottom, then <b>Open in Safari</b>.</span>
          <a className="blk" href={`x-safari-${link}`}>Open in Safari</a></li>
        <li><b>Copy your link.</b>
          <input id="ios-link" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <button className={`blk ${copied ? '' : 'primary'}`} onClick={copy}>{copied ? 'Copied ✓' : 'Copy my link'}</button></li>
        <li><b>Add to Home Screen.</b>
          <span>Tap the Share button <ShareIcon /> at the bottom of Safari. Scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
        <li><b>Open Hash Lounge from your Home Screen.</b>
          <span>Tap <b>Paste my invite link</b>, then set your 4-digit PIN. Then tap <b>Menu → Alerts → Turn on alerts</b> and allow them.</span></li>
      </ol>
      <p className="muted small">Don’t set up here in Safari: on iPhone, the Home Screen app keeps its own data, so it must be set up from there.</p>
    </div></div>)
}

/** On the welcome screen: join with a copied invite link (used by the iPhone Home Screen app). */
export function PasteInvite() {
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const go = (t: string) => { const tok = tokenFrom(t); if (tok) location.replace(`/?join=${tok}`); else setErr('That is not an invite link. Copy the whole link from WhatsApp and try again.') }
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); setText(t); go(t) }
    catch { setErr('Press and hold the box below, tap Paste, then tap Join.') }
  }
  return (
    <div className="block">
      <b>Copied your invite link?</b>
      <button className="blk primary" onClick={paste}>Paste my invite link</button>
      <label className="lbl" htmlFor="paste-link">Or paste it here</label>
      <input id="paste-link" value={text} placeholder="https://shift-pos.pages.dev/?join=…" onChange={e => { setText(e.target.value); setErr(null) }} />
      {text && <button className="blk" onClick={() => go(text)}>Join</button>}
      {err && <span className="warn small">{err}</span>}
    </div>)
}
