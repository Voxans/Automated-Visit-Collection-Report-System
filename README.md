# WhatsApp Collection Visit Report Bot

Sistem otomasi **Collection Visit Report** berbasis WhatsApp yang
menerima laporan dari WhatsApp Personal maupun WhatsApp Group, memproses
teks/caption menggunakan **Groq AI**, menyimpan hasil terstruktur ke
**Google Sheets**, serta menyimpan attachment gambar ke **Google
Drive**.

Sistem menggunakan:

-   **Evolution API v2.3.7** sebagai WhatsApp Gateway
-   **WhatsApp Web / Baileys** untuk koneksi nomor WhatsApp
-   **Docker Compose** untuk menjalankan Evolution API beserta
    database/cache
-   **Google Apps Script (GAS)** sebagai webhook dan backend pemrosesan
-   **Groq API** untuk ekstraksi informasi laporan visit
-   **Google Sheets** sebagai database laporan
-   **Google Drive** sebagai penyimpanan attachment
-   **Cloudflare Tunnel** untuk mengekspos Evolution API secara publik
    ketika diperlukan

------------------------------------------------------------------------

## Arsitektur Sistem

``` text
Staff Collection
      |
      | WhatsApp Text / Image + Caption
      v
WhatsApp
      |
      v
Evolution API v2.3.7
      |
      | MESSAGES_UPSERT
      v
Cloudflare Tunnel
      |
      v
Google Apps Script Web App
      |
      +----------------------+
      |                      |
      v                      v
   Groq API              Google Drive
      |                 (Attachment)
      v
Structured Report
      |
      v
Google Sheets
      |
      v
WhatsApp Reply
```

### Alur pesan

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
 
Gejala dan penanganan masing masing batasan tersebut dibahas di [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
 
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
