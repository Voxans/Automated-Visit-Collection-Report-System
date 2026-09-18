# WhatsApp Collection Visit Report Bot

Sistem otomasi **Collection Visit Report** berbasis WhatsApp yang
menerima laporan dari WhatsApp Personal maupun WhatsApp Group, memproses
teks/caption menggunakan **Groq AI**, menyimpan hasil terstruktur ke
**Google Sheets**, serta menyimpan attachment gambar ke **Google
Drive**.

## Fitur Utama
 
| Kemampuan | Keterangan |
|---|---|
| Input fleksibel | Menerima pesan teks maupun gambar dengan caption |
| Sumber ganda | Mendukung chat personal dan grup |
| Ekstraksi otomatis | Groq AI mengubah teks bebas menjadi JSON terstruktur |
| Penyimpanan laporan | Baris baru otomatis ditulis ke Google Sheets |
| Penyimpanan lampiran | Gambar disimpan ke folder Google Drive |
| Konfirmasi balik | Bot membalas ke chat atau grup asal setelah data tersimpan |
 
Komponen yang digunakan:
 
| Komponen | Peran |
|---|---|
| Evolution API v2.3.7 | WhatsApp Gateway |
| WhatsApp Web / Baileys | Koneksi nomor WhatsApp |
| Docker Compose | Menjalankan Evolution API beserta database dan cache |
| Google Apps Script | Webhook receiver dan backend pemrosesan |
| Groq API | Ekstraksi informasi laporan visit |
| Google Sheets | Database laporan |
| Google Drive | Penyimpanan attachment |
| Cloudflare Tunnel | Membuka akses publik menuju Evolution API |

------------------------------------------------------------------------

## Arsitektur Sistem

```
ARAH MASUK (WhatsApp menuju Google Sheets)
 
Staff Collection
      |
      | teks / gambar + caption
      v
WhatsApp
      |
      v
Evolution API v2.3.7  (localhost:8080, di dalam Docker)
      |
      | HTTPS keluar, event MESSAGES_UPSERT
      v
Google Apps Script Web App  (https://script.google.com/.../exec)
      |
      +---------------------------+
      |                           |
      v                           v
   Groq API                  Google Drive
      |                      (attachment)
      v
Struktur JSON laporan
      |
      v
Google Sheets
```
 
```
ARAH KELUAR (Google Apps Script menuju WhatsApp)
 
Google Apps Script
      |
      | perlu memanggil Evolution API untuk mengirim balasan
      | dan mengambil media Base64
      v
Cloudflare Tunnel  (https://nama-acak.trycloudflare.com)
      |
      v
Evolution API v2.3.7  (localhost:8080)
      |
      v
WhatsApp  (balasan ke chat atau grup asal)
```
 
**Kenapa Cloudflare Tunnel diperlukan.** Evolution API berjalan di mesin lokal Anda dan tetap bisa melakukan request keluar ke internet, sehingga pengiriman webhook menuju Apps Script tidak memerlukan tunnel sama sekali. Masalahnya ada pada arah sebaliknya: Google Apps Script berjalan di infrastruktur Google dan tidak akan pernah bisa menjangkau `localhost:8080` milik Anda. Tunnel inilah yang memberi Apps Script alamat publik untuk memanggil Evolution API saat mengirim balasan dan mengambil media. Karena itu URL tunnel dimasukkan ke variabel `EVOLUTION_API_URL` di dalam Apps Script, bukan ke konfigurasi Evolution API.

## Alur pesan

1.  Staff mengirim laporan melalui WhatsApp.
2.  Evolution API menerima pesan.
3.  Evolution API mengirim event `MESSAGES_UPSERT` ke Google Apps
    Script.
4.  Google Apps Script membaca:
    -   pesan teks; atau
    -   caption pada image/file.
5.  Jika terdapat teks/caption, teks dikirim ke Groq.
6.  Groq mengekstrak data laporan ke format JSON.
7.  Google Apps Script menyimpan hasil ke Google Sheets.
8.  Jika terdapat attachment, attachment diproses untuk penyimpanan
    Google Drive dan **tidak dikirim ke Groq**.
9.  Bot mengirim konfirmasi kembali ke chat/group WhatsApp.

------------------------------------------------------------------------

## Struktur Repository
 
```
.
├── README.md                 Dokumen ini
├── TROUBLESHOOTING.md        Penanganan masalah umum
├── Webhook_Bot.gs            Kode Google Apps Script (webhook, Groq, Sheets, Drive)
├── docker-compose.yml        Definisi service Evolution API dan pendukungnya
├── webhook.json              Payload konfigurasi webhook Evolution API
└── docs/
    ├── SETUP.md              Instalasi dan konfigurasi langkah demi langkah
    ├── TESTING.md            Pengujian fungsi dan pengujian end to end
    ├── OPERATIONS.md         Monitoring, log, dan catatan operasional
    └── SECURITY.md           Checklist keamanan sebelum repository dipublikasikan
```
 
> Isi `Webhook_Bot.gs` tidak dijalankan dari repository ini. File tersebut disalin ke sebuah proyek Google Apps Script, lalu dideploy sebagai Web App. Prosesnya dijelaskan di [`docs/SETUP.md`](docs/SETUP.md).
 
---

## Prasyarat

Sebelum memulai, pastikan tersedia:
 
| Kebutuhan | Keterangan |
|---|---|
| Docker Desktop dan Docker Compose | Menjalankan Evolution API |
| PowerShell atau terminal lain | Seluruh contoh perintah ditulis untuk PowerShell |
| Akun WhatsApp | Nomor yang akan dipakai sebagai bot |
| Akun Google | Untuk Apps Script, Sheets, dan Drive |
| Groq API Key | Diambil dari console Groq |
| cloudflared | Diperlukan agar Apps Script dapat memanggil Evolution API |
 
Catatan tentang nomor WhatsApp: gunakan nomor terpisah yang memang diperuntukkan sebagai bot. Nomor tersebut akan tertaut sebagai perangkat pada Evolution API dan sesinya harus tetap aktif.

------------------------------------------------------------------------

## Quick Start
 
Ringkasan tujuh fase berikut hanya untuk memberi gambaran besar. Perintah lengkap beserta verifikasi setiap tahap ada di [`docs/SETUP.md`](docs/SETUP.md).
 
```
Fase 1  Siapkan Docker
        Clone repository, set AUTHENTICATION_API_KEY di docker-compose.yml,
        lalu jalankan container Evolution API.
 
Fase 2  Hubungkan WhatsApp
        Buat instance pkl-collection, scan QR, pastikan state bernilai open.
 
Fase 3  Siapkan sisi Google
        Buat Google Sheet dengan tab "Laporan Visit" dan folder Drive
        untuk attachment, lalu catat DRIVE_FOLDER_ID.
 
Fase 4  Siapkan Apps Script
        Buat proyek Apps Script, tempel isi Webhook_Bot.gs,
        isi CONFIG dengan Groq API Key dan ID Sheet serta Drive.
 
Fase 5  Authorization dan uji fungsi
        Jalankan setupSheet() dan testGroq() dari editor Apps Script
        untuk memicu permission Google sekaligus memastikan Groq merespons.
 
Fase 6  Buka jalur balik dan deploy
        Jalankan Cloudflare Tunnel, masukkan URL nya ke EVOLUTION_API_URL,
        lalu deploy Apps Script sebagai Web App dan salin URL /exec.
 
Fase 7  Sambungkan webhook
        Masukkan URL /exec ke webhook.json, kirimkan ke Evolution API,
        lalu lakukan pengujian end to end.
```
 
Urutan di atas disusun supaya setiap fase hanya bergantung pada fase sebelumnya. Perhatikan bahwa authorization Apps Script sengaja dilakukan sebelum deploy, karena Web App yang belum pernah diberi permission akan menerima webhook tanpa menghasilkan execution log, dan gejala itu sulit didiagnosis.
 
-----

## Dokumentasi Lengkap
 
| Dokumen | Isi | Baca ketika |
|---|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Instalasi dan konfigurasi lengkap | Melakukan deployment dari awal |
| [`docs/TESTING.md`](docs/TESTING.md) | Uji fungsi Apps Script dan uji end to end | Memverifikasi sistem sudah berjalan |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Monitoring, pembacaan log, catatan harian | Sistem sudah jalan dan perlu dipantau |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Checklist keamanan dan contoh `.gitignore` | Sebelum repository dipublikasikan |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Gejala, penyebab, dan solusi | Ada yang tidak berjalan sebagaimana mestinya |
 
----

## Konfigurasi Utama
 
Seluruh nilai berikut adalah placeholder. Jangan pernah mengisi nilai asli lalu melakukan commit.
 
**Konfigurasi Evolution API, di `docker-compose.yml`**
 
```yaml
AUTHENTICATION_API_KEY: CHANGE_THIS_TO_A_RANDOM_SECRET
```
 
**Konfigurasi Google Apps Script, di `Webhook_Bot.gs`**
 
```javascript
const CONFIG = {
  EVOLUTION_API_URL: 'https://nama-acak.trycloudflare.com',
  EVOLUTION_API_KEY: 'CHANGE_THIS_TO_A_RANDOM_SECRET',
  INSTANCE_NAME:     'pkl-collection',
  GROQ_API_KEY:      'GROQ_API_KEY_ANDA',
  GROQ_MODEL:        'openai/gpt-oss-20b',
  SHEET_NAME:        'Laporan Visit',
  DRIVE_FOLDER_ID:   'FOLDER_ID_TANPA_URL'
};
```
 
**Konfigurasi webhook, di `webhook.json`**
 
```json
{
  "webhook": {
    "enabled": true,
    "url": "GOOGLE_APPS_SCRIPT_WEB_APP_DEPLOY_URL",
    "webhookByEvents": false,
    "base64": true,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }
}
```
 
> **Penting.** Field yang dikirim di dalam body request bernama `base64`, sedangkan `webhookBase64` adalah nama field yang muncul pada **response** ketika Anda memanggil `webhook/find`. Keduanya merujuk pengaturan yang sama tetapi tidak boleh saling ditukar. Mengganti `base64` menjadi `webhookBase64` di dalam `webhook.json` akan membuat media Base64 tidak ikut terkirim.
 
Ambil `DRIVE_FOLDER_ID` dari potongan terakhir URL folder, bukan seluruh URL:
 
```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                       └───────────┬───────────┘
                                             DRIVE_FOLDER_ID
```
 
---
 
## Data yang Disimpan
 
Setiap laporan yang berhasil diproses menghasilkan satu baris pada sheet `Laporan Visit` dengan kolom berikut:
 
```
ID
Timestamp
Tanggal
Jenis Chat
Group ID
SCG
Nama Konsumen
No Kontrak
Past Due
Nomor WhatsApp
Product
Alamat Visit
Case Kategori
Keterangan
Rencana Penyelesaian
Pesan Asli
Ada Attachment
```
 
Jalankan fungsi `setupSheet()` satu kali dari editor Apps Script untuk membuat baris header secara otomatis, sehingga urutan kolom dijamin sesuai dengan yang ditulis oleh script.
 
---

## Batasan yang Diketahui
 
| Batasan | Dampak |
|---|---|
| Cloudflare Quick Tunnel menghasilkan URL acak | URL berubah setiap tunnel dijalankan ulang, sehingga `EVOLUTION_API_URL` harus diperbarui |
| Sesi WhatsApp bergantung pada perangkat tertaut | Jika sesi terputus atau perangkat dihapus, perlu pairing ulang |
| Groq memiliki rate limit | Lonjakan laporan dalam waktu singkat dapat menyebabkan kegagalan ekstraksi |
| Apps Script memiliki batas waktu eksekusi | Attachment berukuran besar berisiko gagal disimpan |
| Ekstraksi bergantung pada model bahasa | Format laporan yang sangat menyimpang dapat menghasilkan kolom kosong atau salah |
 
Gejala dan penanganan masing masing batasan tersebut dibahas di [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).
 
---

## Ringkasan

Project ini mengotomatisasi proses **Collection Visit Report melalui
WhatsApp** dengan alur:

``` text
WhatsApp
   ↓
Evolution API
   ↓
Google Apps Script
   ├── Text/Caption → Groq AI
   │                   ↓
   │               Google Sheets
   │
   └── Attachment → Google Drive
```

Dengan arsitektur tersebut, staff cukup mengirim laporan melalui
WhatsApp, sementara proses ekstraksi data, penyimpanan laporan,
penyimpanan attachment, dan pemberian respons dapat dilakukan secara
otomatis.
