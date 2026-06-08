# Prompt Arsitektur CatatDuit

Kamu bisa menyalin teks di bawah ini dan memberikannya ke AI lain agar mereka mengerti keseluruhan sistem aplikasi pencatatan keuanganmu.

***

Tolong bertindak sebagai Software Engineer senior yang sedang membantu saya mengembangkan aplikasi pencatatan keuangan bernama **"CatatDuit"**. Aplikasi ini adalah sebuah Progressive Web App (PWA) berbasis React yang menggunakan Google Spreadsheet sebagai database melalui Google Apps Script.

Berikut adalah penjelasan lengkap tentang arsitektur, struktur database, dan logika bisnis aplikasi ini:

### 1. Struktur Database (Google Spreadsheet)
Aplikasi ini membaca dan menulis data ke sebuah Google Spreadsheet. Database dibagi menjadi beberapa tab bulanan (JANUARI, FEBRUARI, MARET, dst).
Struktur utama pada setiap bulannya ada di **Tabel Master** yang berada di rentang kolom `F` sampai `L` (baris 4 hingga 124). Saldo Awal Bulan dibaca dari kolom `C` (baris 5 hingga 29).

- **F**: Tanggal
- **G**: Keterangan
- **H**: Kategori (Contoh: Pemasukkan, Pengeluaran, Hutang (Masuk), Tarik Cash, Topup Gopay, Topup Shopeepay)
- **I**: Metode Pembayaran (Mandiri, Cash, Gopay, Shopeepay)
- **J**: Sub-Kategori (Contoh: Kebutuhan, Jajan, Bensin, Impulsive, dll)
- **K**: Pemasukan (Nominal uang masuk)
- **L**: Pengeluaran (Nominal uang keluar)

**Logika Perhitungan Saldo (REKAP):**
Aplikasi menghitung saldo per metode pembayaran langsung dari Tabel Master dengan aturan khusus:
1. **Cash**: Saldo bertambah jika Kategori adalah `Tarik Cash`, `Hutang (Masuk)`, atau `Pemasukan`/`Pemasukkan`.
2. **Gopay**: Saldo bertambah jika Kategori adalah `Topup Gopay`, `Hutang (Masuk)`, atau `Pemasukan`/`Pemasukkan`.
3. **Shopeepay**: Saldo bertambah jika Kategori adalah `Topup Shopeepay`, `Hutang (Masuk)`, atau `Pemasukan`/`Pemasukkan`.
4. **Mandiri**: Saldo bertambah jika Kategori adalah `Pemasukan`/`Pemasukkan` atau `Hutang (Masuk)`.
5. **Pengecualian Mandiri (Transfer Internal):** Jika ada pengeluaran dengan kategori `Tarik Cash`, `Topup Gopay`, atau `Topup Shopeepay` (walaupun dicatat dengan metode Cash/Gopay/Shopeepay di kolom I), nominal tersebut **juga akan diakumulasi sebagai pengeluaran dari Mandiri**. Ini mensimulasikan uang keluar dari rekening bank utama menuju e-wallet/cash.

*Catatan Typo:* Terdapat typo penulisan `Pemasukkan` (double k) di spreadsheet, sehingga sistem harus menangani string `Pemasukkan` dan `Pemasukan`. Jika ada nilai di kolom K dan L di baris yang sama, kolom K diprioritaskan untuk income, dan L untuk expense/transfer.

### 2. Backend API (Google Apps Script - `Code.gs`)
Apps Script bertindak sebagai API yang di-deploy sebagai Web App.
- **Routing**: Terdapat parameter `action` (`addTransaction`, `getSummary`, `getTransactions`, `ping`) dan `month` untuk mendeteksi tab sheet yang akan diakses.
- **CORS & Redirects**: Endpoint `GET` (seperti `getSummary` dan `getTransactions`) diimplementasikan menggunakan teknik **JSONP**. Frontend menyuntikkan tag `<script>` dan Apps Script mengembalikan respons yang dibungkus dalam fungsi callback (contoh: `cb({...})`).
- **Endpoint `handleAdd`**: Menerima HTTP POST (JSON stringified) untuk menambahkan baris baru ke Tabel Master di baris kosong pertama (dicari dari bawah).
- **Endpoint `handleSummary`**: Membaca rentang master, lalu melakukan loop untuk menghitung total pemasukan, pengeluaran, saldo per metode sesuai logika REKAP di atas, serta memperhitungkan pengeluaran transfer internal Mandiri. Juga membaca Saldo Awal dari kolom `C`.

### 3. Frontend (React PWA)
Frontend dibangun dengan **React + Vite** dan **Vanilla CSS** (Premium Dark UI style).
- **Offline-First & Queue**: Menggunakan `lib/storage.js` untuk cache (summary, history transaksi) dan mekanisme `queue` untuk menyimpan transaksi ketika offline, lalu otomatis mencoba sinkronisasi via `POST` ketika koneksi kembali online.
- **UI Components**:
  - `Home.jsx`: Menampilkan kartu pahlawan (Hero Card) berisi Total Saldo, filter bulan (MonthPicker), rincian saldo per metode, grafik pengeluaran mingguan (WeeklyChart), grafik sub-kategori, dan daftar top expenses yang bisa difilter.
  - `History.jsx`: Menampilkan riwayat transaksi yang dikelompokkan per hari, dilengkapi dengan filter per Metode dan Sub-Kategori.
  - `QuickAddSheet.jsx`: Bottom sheet overlay 2-tahap (Nominal lalu Detail) dengan NumPad custom untuk layar sentuh dan mendukung input keyboard fisik desktop.
  - `Settings.jsx`: Halaman untuk mengatur URL eksekusi Apps Script, test koneksi, dan mengelola offline queue.
- **Styling**: `index.css` menggunakan CSS variables untuk tema gelap (Dark Mode), micro-animations, glassmorphism, dan tampilan premium ala iOS/Fintech modern.

### 4. Fitur Utama Aplikasi
1. **Pencatatan Offline-First:** Bisa input transaksi tanpa koneksi internet; otomatis sinkronisasi ke Google Sheets saat online.
2. **Dashboard Dinamis:** Menampilkan total saldo berjalan, alokasi per metode (Mandiri, Cash, dll), grafik pengeluaran mingguan, dan breakdown per sub-kategori.
3. **Filter Bulanan:** Data transaksi dan chart otomatis menyesuaikan dengan bulan yang sedang dipilih (merujuk ke tab spesifik di spreadsheet).
4. **Quick Add (Input Cepat):** Bottom sheet dengan *custom* Numpad untuk mencatat nominal dan detail pengeluaran/pemasukan secepat kilat, mendukung keyboard fisik juga.
5. **Transfer Pintar:** Logika khusus yang otomatis mendeteksi transaksi transfer internal (misalnya Tarik Cash atau Topup Gopay) dan secara akurat memotong saldo di bank asal (Mandiri).
6. **Riwayat & Filter:** Riwayat transaksi harian yang bisa di-filter dengan mudah berdasarkan metode pembayaran maupun sub-kategori.

**Kondisi Saat Ini:**
Aplikasi sudah berjalan penuh. Fitur offline-first caching, visualisasi chart, dan Quick Add sheet sudah diimplementasikan. Logika saldo telah diisolasi dari Tabel Master tanpa bergantung pada sub-tabel turunan di Google Sheets.

Jika saya meminta bantuan lebih lanjut, tolong berikan saran kode atau perbaikan berdasarkan konteks di atas.
***
