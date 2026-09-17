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

> **Catatan keamanan:** Jangan commit API key, access token, password
> database, atau credential lain ke repository GitHub. Gunakan
> placeholder seperti `CHANGE_THIS_TO_A_RANDOM_SECRET`.

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

Pastikan komputer/server sudah memiliki:

-   Docker Desktop
-   Docker Compose
-   PowerShell atau terminal
-   Akun WhatsApp untuk nomor bot
-   Akun Google
-   Google Apps Script
-   Google Sheets
-   Google Drive
-   Groq API Key
-   Cloudflare Tunnel (`cloudflared`) jika Evolution API perlu menerima
    webhook dari internet

------------------------------------------------------------------------
## Step by Step Set Up

### 1. Clone Repository

Clone repository GitHub:

``` powershell
git clone https://github.com/Voxans/Automated-Visit-Collection-Report-System.git
cd Automated-Visit-Collection-Report-System
```

Pastikan file utama tersedia, misalnya:

``` text
.
├── docker-compose.yaml
├── webhook.json
├── Google Apps Script
└── README.md
```

> Sesuaikan nama folder/file dengan struktur repository sebenarnya.

------------------------------------------------------------------------

### 2. Konfigurasi Docker

File `docker-compose.yaml` digunakan untuk menjalankan Evolution API
beserta service pendukungnya.

Sebelum menjalankan Docker, periksa konfigurasi:

``` powershell
docker compose config
```

Jika tidak terdapat error, jalankan:

``` powershell
docker compose up -d
```

Periksa container:

``` powershell
docker compose ps
```

Pastikan container Evolution API berada pada status `Up`.

Untuk melihat log:

``` powershell
docker logs -f evolution_api
```

Keluar dari log dengan:

``` text
Ctrl + C
```

------------------------------------------------------------------------

### 3. Membuat API Key Evolution API

Evolution API membutuhkan API key untuk mengamankan request API.

Pada `docker-compose.yaml`, gunakan secret sendiri, contoh:

``` yaml
AUTHENTICATION_API_KEY: CHANGE_THIS_TO_A_RANDOM_SECRET
```

Gunakan nilai random yang panjang.

Contoh:

``` yaml
AUTHENTICATION_API_KEY: "EvolutionBot-CHANGE-THIS-TO-RANDOM-SECRET"
```

**Jangan gunakan contoh tersebut pada production.**

Setelah mengubah environment variable, recreate container:

``` powershell
docker compose down
docker compose up -d
```

------------------------------------------------------------------------

### 4. Membuat Environment Variable di PowerShell

Agar API key tidak perlu ditulis berulang kali pada setiap command:

``` powershell
$EVOLUTION_API_KEY = "API_KEY_ANDA"
```

Periksa:

``` powershell
$EVOLUTION_API_KEY
```

Jika ingin environment variable tersedia untuk proses PowerShell
berikutnya:

``` powershell
$env:EVOLUTION_API_KEY = "API_KEY_ANDA"
```

Kemudian:

``` powershell
$env:EVOLUTION_API_KEY
```

> Jangan memasukkan API key asli ke `README.md` atau repository GitHub.

------------------------------------------------------------------------

### 5. Mengecek Evolution API

Setelah Docker aktif, cek instance:

``` powershell
curl.exe "http://localhost:8080/instance/fetchInstances" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Pastikan Evolution API dapat merespons request.

------------------------------------------------------------------------

### 6. Membuat Instance WhatsApp

Jika instance belum dibuat, buat instance dengan nama:

``` text
pkl-collection
```

Instance ini digunakan sebagai koneksi WhatsApp bot.

Setelah instance dibuat, cek status:

``` powershell
curl.exe "http://localhost:8080/instance/connectionState/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Status yang diharapkan:

``` json
{
  "instance": {
    "instanceName": "pkl-collection",
    "state": "open"
  }
}
```

Jika:

``` text
state = close
```

berarti nomor WhatsApp belum terhubung atau koneksi terputus.

------------------------------------------------------------------------

### 7. Menghubungkan Nomor WhatsApp

Generate koneksi/QR:

``` powershell
curl.exe -X GET "http://localhost:8080/instance/connect/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Evolution API akan memberikan informasi pairing/QR sesuai kondisi
instance.

Scan QR menggunakan:

``` text
WhatsApp
→ Perangkat tertaut
→ Tautkan perangkat
→ Scan QR
```

Setelah berhasil, cek:

``` powershell
curl.exe "http://localhost:8080/instance/connectionState/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Pastikan:

``` json
"state": "open"
```
------------------------------------------------------------------------

### 8. Cloudflare Tunnel

Google Apps Script harus dapat menerima webhook dari Evolution API.

Karena Evolution API saat ini hanya berjalan di:

``` text
http://localhost:8080
```

alamat tersebut tidak dapat diakses langsung dari internet.

Jalankan Cloudflare Quick Tunnel:

``` powershell
cloudflared tunnel --url http://localhost:8080
```

Cloudflare akan memberikan URL seperti:

``` text
https://random-name.trycloudflare.com
```

URL tersebut merupakan public endpoint menuju Evolution API. Masukkan URL tersebut di dalam Google Apps Script bagian **EVOLUTION_API_URL**

Contoh:

```javascript
EVOLUTION_API_URL:
    'https://random-name.trycloudflare.com'
```

> Quick Tunnel menghasilkan URL yang dapat berubah. Jika URL berubah,
> konfigurasi yang bergantung pada URL tersebut harus diperbarui.

------------------------------------------------------------------------

### 9. Menyiapkan Google Sheets

Buat sebuah Google Spreadsheet.

Buat sheet dengan nama:

``` text
Laporan Visit
```

Google Apps Script akan menggunakan sheet tersebut sebagai tempat
penyimpanan laporan.

Kolom yang digunakan sistem antara lain:

``` text
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
Case kategory
Keterangan
Rencana penyelesaian
Pesan Asli
Ada Attachment
```

Jika fungsi `setupSheet()` tersedia pada script, jalankan fungsi
tersebut satu kali dari Apps Script Editor untuk membuat header secara
otomatis.

------------------------------------------------------------------------

### 10. Menyiapkan Google Drive

Buat folder khusus untuk attachment, misalnya:

``` text
WhatsApp Collection Attachments
```

Ambil **Folder ID**, bukan seluruh URL folder.

Contoh URL:

``` text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
```

Maka:

``` text
DRIVE_FOLDER_ID
```

adalah:

``` text
1AbCdEfGhIjKlMnOpQrStUvWxYz
```

Pada konfigurasi Google Apps Script:

``` javascript
const CONFIG = {
  ...
  DRIVE_FOLDER_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz'
};
```

Google Apps Script membutuhkan akses ke folder tersebut.

------------------------------------------------------------------------

### 11. Menyiapkan Groq API

Buat API key Groq dan masukkan ke konfigurasi Google Apps Script:

``` javascript
GROQ_API_KEY: 'GROQ_API_KEY_ANDA'
```

Model yang digunakan project ini dikonfigurasi pada:

``` javascript
GROQ_MODEL: 'openai/gpt-oss-20b'
```

API endpoint:

``` text
https://api.groq.com/openai/v1/chat/completions
```

> API key Groq bersifat rahasia. Jangan commit key asli ke GitHub.

------------------------------------------------------------------------

### 12. Deploy Google Apps Script

Buka Google Apps Script yang berisi kode bot.

Pastikan script memiliki:

``` javascript
function doPost(e) {
    ...
}
```

dan:

``` javascript
function doGet() {
    ...
}
```

Kemudian:

1.  Klik **Deploy**

2.  Pilih **New deployment**

3.  Pilih tipe **Web app**

4.  Set **Execute as** → akun Anda

5.  Set akses sesuai kebutuhan webhook, umumnya:

    ``` text
    Anyone
    ```

6.  Klik **Deploy**

7.  Salin URL Web App.

Contoh:

``` text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

URL inilah yang digunakan sebagai destination webhook Evolution API.

------------------------------------------------------------------------

### 13. Memberikan Permission Google Apps Script

Pada deployment pertama, Google Apps Script biasanya meminta
authorization.

Jalankan fungsi yang memerlukan:

-   Google Sheets
-   Google Drive
-   UrlFetchApp

Kemudian berikan permission pada akun Google yang digunakan.

Jika Google menampilkan peringatan aplikasi belum diverifikasi,
lanjutkan sesuai akun/project yang digunakan dan pastikan script memang
milik Anda.

------------------------------------------------------------------------

### 14. Konfigurasi dan Verifikasi Webhook

Pada file bernama `webhook.json`, ubah bagian:

```json
"url": "GOOGLE_APPS_SCRIPT_WEB_APP_DEPLOY_URL",
```

dengan URL Web App anda

Contoh:

```json
"url": "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
```

Selanjutnya, jalankan

``` powershell
curl.exe -X POST "http://localhost:8080/webhook/set/pkl-collection" `
    -H "Content-Type: application/json" `
    -H "apikey: $EVOLUTION_API_KEY" `
    --data-binary "@webhook.json"
```

Jika berhasil, response akan menampilkan informasi seperti:

``` json
{
  "id": "...",
  "url": "https://script.google.com/macros/s/.../exec",
  "enabled": true,
  "events": [
    "MESSAGES_UPSERT"
  ],
  "webhookByEvents": false,
  "webhookBase64": true
}
```
untuk mengecek konfigurasi Webhook gunakan:

``` powershell
curl.exe -X GET "http://localhost:8080/webhook/find/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Pastikan:

``` json
"enabled": true
```

dan:

``` json
"events": [
  "MESSAGES_UPSERT"
]
```

Untuk attachment yang membutuhkan data media Base64, konfigurasi project
menggunakan:

``` json
"webhookBase64": true
```
------------------------------------------------------------------------


## Testing Google Apps Script

Sebelum menghubungkan WhatsApp, test Groq menggunakan fungsi:

``` javascript
testGroq()
```

Test group:

``` javascript
testGroupPayload()
```

Test personal:

``` javascript
testPersonalPayload()
```

Test attachment:

``` javascript
testAttachmentScenarios()
```

Jika tersedia pada script, test webhook:

``` javascript
testWebhookPayload()
```

------------------------------------------------------------------------

## Testing End-to-End

Setelah semua konfigurasi selesai:

### Step 1 --- Docker

``` powershell
docker compose ps
```

Pastikan Evolution API aktif.

### Step 2 --- WhatsApp

``` powershell
curl.exe "http://localhost:8080/instance/connectionState/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Pastikan:

``` text
state = open
```

### Step 3 --- Webhook

``` powershell
curl.exe -X GET "http://localhost:8080/webhook/find/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Pastikan:

``` text
enabled = true
events = MESSAGES_UPSERT
```

### Step 4 --- Kirim pesan

Kirim laporan dari WhatsApp Group:

``` text
FA MALANG
Nama: Ahmad
Kontrak: 123456789
Past Due: 10
Konsumen ada dan unit ada.
```

### Step 5 --- Periksa Google Apps Script

Buka:

``` text
Google Apps Script
→ Executions
```

Pastikan `doPost` dieksekusi.

### Step 6 --- Periksa Google Sheets

Pastikan laporan masuk ke:

``` text
Laporan Visit
```

### Step 7 --- Periksa Google Drive

Jika pesan mengandung attachment, periksa folder:

``` text
Google Drive
→ Folder Attachment
```

### Step 8 --- Periksa WhatsApp

Bot seharusnya mengirim konfirmasi:

``` text
✅ LAPORAN VISIT BERHASIL DISIMPAN
```

------------------------------------------------------------------------

## Monitoring

## Evolution API

``` powershell
docker logs -f evolution_api
```

Cari event:

``` text
messages.upsert
```

Payload akan menunjukkan informasi seperti:

``` text
remoteJid
participant
messageType
imageMessage
caption
```

------------------------------------------------------------------------

## Google Apps Script

Buka:

``` text
Apps Script
→ Executions
```

Periksa execution dari:

``` text
doPost
```

Log dapat digunakan untuk melihat:

``` text
FULL PAYLOAD
FINAL MESSAGE TO GROQ
ATTACHMENT INFO
CHAT INFO
GROQ RESULT
REPORT SAVED
REPLY SENT
```

## Security Checklist

Sebelum repository dibuat public:

-   [ ] Tidak ada `GROQ_API_KEY` asli.
-   [ ] Tidak ada `AUTHENTICATION_API_KEY` asli.
-   [ ] Tidak ada password database.
-   [ ] Tidak ada credential Google.
-   [ ] Tidak ada token WhatsApp.
-   [ ] Tidak ada URL webhook yang mengandung secret.
-   [ ] Tidak ada file service-account JSON.
-   [ ] Tidak ada `.env` berisi secret.
-   [ ] Gunakan `.gitignore`.

Contoh `.gitignore`:

``` gitignore
.env
*.env
credentials.json
service-account.json
*.pem
*.key
node_modules/
logs/
```


## Urutan Deployment Singkat

Jika melakukan deployment dari awal, urutannya:

``` text
1. Clone repository
        ↓
2. Konfigurasi docker-compose.yaml
        ↓
3. Buat Evolution API key
        ↓
4. docker compose up -d
        ↓
5. Buat instance pkl-collection
        ↓
6. Scan QR WhatsApp
        ↓
7. Pastikan state = open
        ↓
8. Buat Google Sheet
        ↓
9. Buat folder Google Drive
        ↓
10. Ambil DRIVE_FOLDER_ID
        ↓
11. Masukkan Groq API Key
        ↓
12. Deploy Google Apps Script sebagai Web App
        ↓
13. Salin URL /exec
        ↓
14. Update webhook.json
        ↓
15. Set webhook Evolution API
        ↓
16. Pastikan MESSAGES_UPSERT aktif
        ↓
17. Pastikan webhookBase64 = true
        ↓
18. Jalankan Cloudflare Tunnel jika diperlukan
        ↓
19. Kirim test message
        ↓
20. Kirim test image + caption
        ↓
21. Verifikasi Google Sheets
        ↓
22. Verifikasi Google Drive
        ↓
23. Verifikasi reply WhatsApp
```

------------------------------------------------------------------------

## Status Sistem yang Diharapkan

Sistem dianggap berhasil berjalan apabila seluruh komponen berikut
aktif:

  Komponen                    Kondisi
  --------------------------- -------------------------------
  Docker                      Running
  Evolution API               Running
  Instance `pkl-collection`   `open`
  WhatsApp                    Connected
  Webhook                     Enabled
  Event                       `MESSAGES_UPSERT`
  `webhookBase64`             `true`
  Google Apps Script          Deployed
  Google Sheets               Dapat ditulis
  Google Drive                Dapat ditulis
  Groq API                    Dapat menerima request
  Text report                 Masuk Sheets
  Image + caption             Caption → Groq, Image → Drive
  WhatsApp reply              Terkirim

------------------------------------------------------------------------

## Catatan Operasional

Evolution API berjalan sebagai gateway WhatsApp. Nomor WhatsApp yang
digunakan harus tetap memiliki sesi WhatsApp yang aktif pada Evolution
API.

Jika sesi terputus, periksa:

``` powershell
curl.exe "http://localhost:8080/instance/fetchInstances" `
    -H "apikey: $EVOLUTION_API_KEY"
```

dan:

``` powershell
docker logs -f evolution_api
```

Jika status kembali `close` atau terdapat `device_removed`, lakukan
proses pairing WhatsApp kembali.

Cloudflare Quick Tunnel juga dapat menghasilkan URL baru ketika tunnel
dihentikan dan dijalankan kembali. Jika URL yang digunakan sistem
berubah, periksa kembali konfigurasi yang menggunakan URL tersebut.

------------------------------------------------------------------------

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
