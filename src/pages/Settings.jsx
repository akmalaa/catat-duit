import { useState, useEffect } from 'react'
import { getSettings, saveSettings, testConnection, getScriptUrl } from '../lib/api'
import { clearQueue, getQueue } from '../lib/storage'

export default function Settings({ onSaved }) {
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    setUrl(getScriptUrl())
    setQueueCount(getQueue().length)
  }, [])

  const handleSave = () => {
    saveSettings({ scriptUrl: url.trim() })
    setTestResult(null)
    onSaved()
  }

  const handleTest = async () => {
    if (!url.trim()) return
    setTesting(true); setTestResult(null)
    try {
      await testConnection(url.trim())
      setTestResult({ ok: true, msg: '✅ Koneksi berhasil! Apps Script merespons.' })
    } catch (e) {
      setTestResult({ ok: false, msg: '❌ ' + e.message })
    } finally { setTesting(false) }
  }

  const handleClearQueue = () => { clearQueue(); setQueueCount(0) }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h1 className="page-title">Pengaturan</h1>
      </div>

      {/* ── Koneksi ────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-title">🔗 Koneksi Google Sheets</div>

        <div className="field-group">
          <label htmlFor="inp-url" className="field-label">Apps Script URL</label>
          <textarea
            id="inp-url"
            className="field-input field-area"
            rows={3}
            placeholder="https://script.google.com/macros/s/AKfy.../exec"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <div className="field-hint">
            Paste URL deployment dari Google Apps Script Anda.
            <strong>Who has access</strong> wajib <strong>Anyone</strong>
          </div>
        </div>

        {testResult && (
          <div className={`test-banner ${testResult.ok ? 'test-ok' : 'test-fail'}`}>
            {testResult.msg}
          </div>
        )}

        <div className="btn-row">
          <button id="btn-test" className="btn-outline" onClick={handleTest} disabled={testing || !url.trim()}>
            {testing ? '⏳ Testing...' : '🔌 Test Koneksi'}
          </button>
          <button id="btn-save" className="btn-primary" onClick={handleSave} disabled={!url.trim()}>
            Simpan
          </button>
        </div>
      </div>

      {/* ── Offline Queue ───────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-title">📥 Offline Queue</div>
        <p className="card-body">
          {queueCount > 0
            ? <><strong style={{ color: '#f59e0b' }}>{queueCount} transaksi</strong> menunggu untuk disync ke Google Sheets saat kamu online kembali.</>
            : 'Tidak ada transaksi yang menunggu — semua sudah tersync. ✅'}
        </p>
        {queueCount > 0 && (
          <button id="btn-clear-queue" className="btn-danger" onClick={handleClearQueue}>
            🗑️ Hapus Queue
          </button>
        )}
      </div>

      {/* ── Cara Setup ──────────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-title">📖 Cara Setup Apps Script</div>
        <ol className="setup-list">
          <li>Buka Google Spreadsheet kamu</li>
          <li>Klik menu <strong>Extensions → Apps Script</strong></li>
          <li>Hapus semua kode yang ada</li>
          <li>Copy-paste isi file <code>apps-script/Code.gs</code> dari project ini</li>
          <li>Klik <strong>Deploy → New deployment</strong></li>
          <li>Type: <strong>Web App</strong></li>
          <li>Execute as: <strong>Me</strong></li>
          <li>Who has access: <strong>Anyone</strong> — <em>bukan</em> &quot;Only myself&quot; / &quot;Anyone with Google account&quot;</li>
          <li>CatatDuit memanggil URL dari browser tanpa login Google — &quot;Only myself&quot; selalu gagal di HP lain / incognito</li>
          <li>Klik <strong>Deploy</strong>, authorize, lalu copy URL-nya</li>
          <li>Paste URL di form di atas dan klik <strong>Simpan</strong></li>
        </ol>
      </div>

      {/* ── Info ────────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="card-title">ℹ️ Info Spreadsheet</div>
        <div className="info-table">
          <div className="info-row"><span>Sheet baca</span><span>Pilih bulan di Beranda / Riwayat / Budgeting</span></div>
          <div className="info-row"><span>Budget</span><span>A63:B (sub-kategori + nominal)</span></div>
          <div className="info-row"><span>Sheet tulis</span><span>Auto-detect bulan berjalan</span></div>
          <div className="info-row"><span>Kolom tulis</span><span>F – L (Tabel Master)</span></div>
          <div className="info-row"><span>Sub-tabel</span><span>W:AB, AD:AI, AK:AP</span></div>
          <div className="info-row"><span>Spreadsheet ID</span><span>Script Properties → <code className="small-code">spreadsheetId</code></span></div>
        </div>
      </div>

      <div className="app-footer">CatatDuit v1.0 · Personal Finance PWA</div>
    </div>
  )
}
