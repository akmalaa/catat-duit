// Parser e-statement Mandiri Livin (.xlsx, biasanya ber-password).
// Import library berat (officecrypto-tool/xlsx) di-dynamic import supaya gak ikut bundle utama app.

function toArrayBuffer(file) {
  return file.arrayBuffer()
}

async function decryptIfNeeded(arrayBuffer, password) {
  const [{ default: officeCrypto }, { Buffer }] = await Promise.all([
    import('officecrypto-tool'),
    import('buffer'),
  ])
  const buf = Buffer.from(arrayBuffer)

  if (!officeCrypto.isEncrypted(buf)) return buf
  if (!password) throw new Error('File ini ber-password — masukkan password dulu.')

  try {
    return await officeCrypto.decrypt(buf, { password })
  } catch {
    throw new Error('Password salah atau file gagal di-decrypt.')
  }
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    const hasNo = row.some(c => String(c || '').trim() === 'No')
    const hasKeterangan = row.some(c => {
      const v = String(c || '').trim()
      return v === 'Keterangan' || v === 'Remarks'
    })
    if (hasNo && hasKeterangan) return i
  }
  return -1
}

function findCol(headerRow, labels) {
  for (let i = 0; i < headerRow.length; i++) {
    if (labels.includes(String(headerRow[i] || '').trim())) return i
  }
  return -1
}

function parseNominal(raw) {
  if (!raw) return 0
  const cleaned = String(raw).trim().replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function isValidDateString(v) {
  if (!v) return false
  return !isNaN(new Date(v).getTime())
}

/**
 * @returns {Array<{ no, tanggalRaw, jam, keteranganRaw, danaMasuk, danaKeluar, saldo }>}
 *
 * Catatan: kolom "No" di beberapa export Livin kegeser 1 kolom dibanding data aslinya
 * (header teks "No" gak sejajar sama nilai serial-nya) — jadi baris data dideteksi dari
 * validitas Tanggal (bisa di-parse `new Date()`), bukan dari keberadaan nilai "No".
 * Ini juga otomatis nge-skip baris header (isi "Tanggal"/"Date" bukan tanggal beneran).
 */
function extractRows(rows, headerIdx, col) {
  const out = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const tanggalRaw = row[col.tanggal]
    if (!isValidDateString(tanggalRaw)) continue

    const jamRow = rows[i + 1] || []
    const jam = String(jamRow[col.tanggal] || '').trim()

    out.push({
      no: String(row[col.no] ?? '').trim(),
      tanggalRaw: String(tanggalRaw).trim(),
      jam,
      keteranganRaw: String(row[col.keterangan] || '').trim(),
      danaMasuk: parseNominal(row[col.danaMasuk]),
      danaKeluar: parseNominal(row[col.danaKeluar]),
      saldo: parseNominal(row[col.saldo]),
    })
  }
  return out
}

export async function parseMandiriStatement(file, password) {
  const arrayBuffer = await toArrayBuffer(file)
  const decrypted = await decryptIfNeeded(arrayBuffer, password)

  const { read, utils } = await import('xlsx')
  const wb = read(decrypted, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = utils.sheet_to_json(ws, { header: 1, raw: false })

  const headerIdx = findHeaderRow(rows)
  if (headerIdx === -1) {
    throw new Error('Format statement tidak dikenali — kolom "No"/"Keterangan" tidak ditemukan.')
  }

  const headerRow = rows[headerIdx]
  const col = {
    no: findCol(headerRow, ['No']),
    tanggal: findCol(headerRow, ['Tanggal', 'Date']),
    keterangan: findCol(headerRow, ['Keterangan', 'Remarks']),
    danaMasuk: findCol(headerRow, ['Dana Masuk (IDR)', 'Incoming Transactions (IDR)']),
    danaKeluar: findCol(headerRow, ['Dana Keluar (IDR)', 'Outgoing Transactions (IDR)']),
    saldo: findCol(headerRow, ['Saldo (IDR)', 'Balance (IDR)']),
  }

  if (col.no === -1 || col.tanggal === -1 || col.keterangan === -1) {
    throw new Error('Format statement tidak dikenali — kolom wajib tidak lengkap.')
  }

  return extractRows(rows, headerIdx, col)
}
