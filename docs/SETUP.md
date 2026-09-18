# Panduan Setup

Dokumen ini berisi instalasi dan konfigurasi lengkap dari nol hingga sistem menerima laporan pertama. Seluruh perintah ditulis untuk **PowerShell** di Windows. Jika Anda memakai bash, sesuaikan cara menetapkan environment variable dan penulisan tanda kutip pada `curl`.

Sebelum mulai, baca Prasyarat di README dan pastikan Docker Desktop sudah berjalan.

---

## Cara membaca dokumen ini

Panduan dibagi menjadi tujuh fase. Setiap fase diakhiri blok **Verifikasi**. Jangan lanjut ke fase berikutnya sebelum verifikasi berhasil, karena setiap fase bergantung pada hasil fase sebelumnya.

| Fase | Isi | Langkah |
|---|---|---|
| 1 | Menyiapkan Evolution API di Docker | 1 sampai 5 |
| 2 | Menghubungkan nomor WhatsApp | 6 sampai 7 |
| 3 | Menyiapkan Google Sheets dan Drive | 8 sampai 9 |
| 4 | Menyiapkan proyek Google Apps Script | 10 sampai 11 |
| 5 | Authorization dan uji fungsi | 12 |
| 6 | Cloudflare Tunnel dan deploy Web App | 13 sampai 14 |
| 7 | Menyambungkan webhook | 15 sampai 16 |

Urutan ini berbeda dari intuisi awal pada satu titik penting. Cloudflare Tunnel sengaja dijalankan **setelah** proyek Apps Script ada, bukan di tengah fase Docker. Alasannya, URL tunnel tidak dipakai oleh Evolution API sama sekali; URL tersebut ditempelkan ke dalam konfigurasi Apps Script. Menjalankannya lebih awal hanya membuat tunnel menganggur dan berisiko URL nya berubah sebelum sempat dipakai.

---

# Fase 1. Menyiapkan Evolution API di Docker

## Langkah 1. Clone repository

```powershell
git clone https://github.com/Voxans/Automated-Visit-Collection-Report-System.git
cd Automated-Visit-Collection-Report-System
```

## Langkah 2. Membuat API Key Evolution API

API Key adalah kredensial tunggal yang melindungi seluruh endpoint Evolution API. Siapa pun yang memilikinya dapat mengirim pesan atas nama nomor WhatsApp Anda, jadi jangan memakai nilai contoh dan jangan memakai kata yang mudah ditebak.

Bangkitkan nilai acak:

```powershell
# Menghasilkan API key acak sepanjang 32 karakter heksadesimal
-join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Salin hasilnya, lalu simpan sementara di tempat aman. Nilai yang sama akan dipakai dua kali: di `docker-compose.yml` dan di konfigurasi Apps Script.

## Langkah 3. Mengatur `docker-compose.yml`

Buka `docker-compose.yml`, lalu ganti nilai `AUTHENTICATION_API_KEY` dengan hasil Langkah 2.

```yaml
environment:
  AUTHENTICATION_API_KEY: TEMPEL_API_KEY_HASIL_LANGKAH_2
```

Periksa juga apakah port `8080` sudah dipakai aplikasi lain di mesin Anda. Jika ya, ubah pemetaan port di sisi host saja, misalnya `8081:8080`, dan ingat perubahan itu karena seluruh contoh perintah berikutnya memakai `8080`.

Validasi berkasnya sebelum dijalankan:

```powershell
docker compose config
```

Perintah ini akan menampilkan konfigurasi hasil parsing. Jika ada kesalahan indentasi YAML, kesalahan akan muncul di sini dan bukan di tengah proses pembuatan container.

> **Catatan urutan.** API key ditetapkan sebelum container pertama kali dijalankan. Menjalankan `docker compose up` terlebih dahulu lalu mengubah API key setelahnya akan memaksa Anda melakukan `down` dan `up` ulang tanpa manfaat apa pun.

## Langkah 4. Menjalankan container

```powershell
docker compose up -d
```

Perintah ini menjalankan Evolution API beserta database dan cache pendukungnya di latar belakang.

Pantau proses awalnya:

```powershell
docker compose logs -f
```

Tekan `Ctrl + C` untuk keluar dari mode mengikuti log. Menghentikan tampilan log tidak menghentikan container.

**Verifikasi Fase 1, bagian pertama**

```powershell
docker compose ps
```

Seluruh service harus berstatus `running`. Jika container Evolution API terus melakukan restart, hampir selalu penyebabnya adalah database atau cache yang belum siap atau gagal naik. Periksa log service tersebut secara spesifik sebelum melanjutkan.

## Langkah 5. Menyimpan API Key sebagai environment variable

Agar API key tidak ditulis berulang kali di dalam perintah dan tidak tertinggal di riwayat perintah dalam bentuk teks penuh, simpan sebagai variabel sesi.

```powershell
$env:EVOLUTION_API_KEY = "TEMPEL_API_KEY_HASIL_LANGKAH_2"
```

Variabel ini hanya berlaku pada jendela PowerShell yang sedang terbuka. Jika Anda menutup jendela tersebut, ulangi perintah di atas sebelum menjalankan perintah lain di panduan ini.

**Verifikasi Fase 1, bagian kedua**

```powershell
curl.exe -s -X GET "http://localhost:8080/instance/fetchInstances" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```

Hasil yang benar adalah sebuah array JSON, biasanya masih kosong karena belum ada instance. Jika yang muncul adalah pesan `Unauthorized`, berarti nilai variabel tidak sama dengan yang ada di `docker-compose.yml`. Jika koneksi ditolak sepenuhnya, berarti container belum siap atau port nya berbeda.

---

# Fase 2. Menghubungkan nomor WhatsApp

## Langkah 6. Membuat instance

Instance adalah representasi satu sesi WhatsApp di dalam Evolution API. Panduan ini memakai nama `pkl-collection`. Jika Anda mengubahnya, nama yang sama harus dipakai konsisten di konfigurasi Apps Script dan di seluruh perintah berikutnya.

```powershell
curl.exe -s -X POST "http://localhost:8080/instance/create" `
  -H "apikey: $env:EVOLUTION_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"instanceName\":\"pkl-collection\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}'
```

Respons akan berisi data instance yang baru dibuat beserta hash API key milik instance tersebut.

## Langkah 7. Memindai QR Code

Minta QR Code untuk instance yang baru dibuat:

```powershell
curl.exe -s -X GET "http://localhost:8080/instance/connect/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```

Respons memuat QR Code dalam bentuk data URI Base64. Cara termudah membacanya adalah membuka Evolution API Manager melalui peramban di `http://localhost:8080/manager`, masuk memakai API key, lalu memindai QR yang ditampilkan di sana.

Pemindaian dilakukan dari aplikasi WhatsApp pada nomor bot, melalui menu **Perangkat Tertaut**, lalu **Tautkan Perangkat**.

**Verifikasi Fase 2**

```powershell
curl.exe -s -X GET "http://localhost:8080/instance/connectionState/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```

Nilai `state` harus `open`. Nilai `connecting` berarti pemindaian belum selesai, sedangkan `close` berarti sesi terputus dan QR perlu diminta ulang. QR Code memiliki masa berlaku pendek, jadi jika kedaluwarsa cukup panggil kembali endpoint `connect`.

---

# Fase 3. Menyiapkan Google Sheets dan Drive

## Langkah 8. Membuat Google Sheet

Buat spreadsheet baru di Google Sheets, lalu ganti nama tab pertamanya menjadi persis:

```
Laporan Visit
```

Penulisan harus sama persis, termasuk spasi dan huruf kapitalnya, karena script mencari tab berdasarkan nama tersebut. Tab bernama `Sheet1` atau `laporan visit` tidak akan dikenali.

Baris header belum perlu dibuat manual. Script akan membuatnya sendiri di Langkah 12 sehingga urutan kolom dijamin sesuai dengan yang ditulis oleh kode.

## Langkah 9. Membuat folder Google Drive

Buat folder baru di Google Drive sebagai tempat penyimpanan attachment, lalu ambil `DRIVE_FOLDER_ID` dari URL nya:

```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                       └───────────┬───────────┘
                                             DRIVE_FOLDER_ID
```

Yang diambil hanya potongan terakhir, bukan seluruh URL.

**Verifikasi Fase 3**

Pastikan spreadsheet dan folder Drive berada pada akun Google yang sama dengan akun yang nanti dipakai membuat proyek Apps Script. Apps Script berjalan atas nama pemilik deployment, sehingga akun yang berbeda akan menimbulkan kegagalan akses yang sulit dibaca gejalanya.

---

# Fase 4. Menyiapkan proyek Google Apps Script

## Langkah 10. Membuat proyek dan menempelkan kode

1. Pada Google Sheets yang akan digunakan, klik bagian Extensions.
2. Klik bagian Apps Script dan Anda akan langsung dibawa ke project yang terhubung langsung dengan Google Sheets.
3. Beri nama proyek, misalnya `WhatsApp Visit Report Bot`.
4. Hapus seluruh isi berkas `Code.gs` bawaan.
5. Salin seluruh isi `Webhook_Bot.gs` dari repository ini, lalu tempelkan ke editor.
6. Simpan dengan `Ctrl + S`.

Kode tidak dijalankan dari repository. Repository hanya menyimpan sumbernya agar dapat diversioning; yang benar benar dieksekusi adalah salinan di dalam proyek Apps Script.

## Langkah 11. Mengisi CONFIG

Di bagian atas kode terdapat objek konfigurasi. Isi seluruh nilainya, kecuali `EVOLUTION_API_URL` yang sengaja dikosongkan dulu karena URL tunnel baru ada di Langkah 13.

```javascript
const CONFIG = {
  EVOLUTION_API_URL: '',                       // diisi pada Langkah 13
  EVOLUTION_API_KEY: 'API_KEY_HASIL_LANGKAH_2',
  INSTANCE_NAME:     'pkl-collection',
  GROQ_API_KEY:      'GROQ_API_KEY_ANDA',
  GROQ_MODEL:        'openai/gpt-oss-20b',
  SHEET_ID:          'SHEET_ID_HASIL_LANGKAH_8',
  SHEET_NAME:        'Laporan Visit',
  DRIVE_FOLDER_ID:   'DRIVE_FOLDER_ID_HASIL_LANGKAH_9'
};
```

Groq API Key diambil dari console Groq pada bagian API Keys. Kunci hanya ditampilkan sekali pada saat dibuat, jadi salin segera.

> Sesuaikan nama kunci di atas dengan nama yang benar benar dipakai di `Webhook_Bot.gs` Anda. Jika ada perbedaan penamaan, yang berlaku adalah yang ada di dalam kode.

**Verifikasi Fase 4**

Simpan proyek, lalu pastikan tidak ada penanda kesalahan sintaks di editor. Kesalahan sintaks akan membuat seluruh fungsi gagal dijalankan pada fase berikutnya.

---

# Fase 5. Authorization dan uji fungsi

## Langkah 12. Menjalankan fungsi uji dari editor

Fase ini punya dua tujuan sekaligus. Pertama, memicu permintaan authorization Google agar script memperoleh izin mengakses Sheets, Drive, dan layanan eksternal. Kedua, memastikan konfigurasi yang baru diisi memang bekerja.

Urutannya penting. Authorization dilakukan **sebelum** deploy sebagai Web App. Web App yang belum pernah diberi permission tetap menerima request webhook, tetapi eksekusinya gagal tanpa menghasilkan execution log yang jelas, dan gejala itu termasuk yang paling sulit didiagnosis pada sistem ini.

**Uji pertama, membuat header sheet**

Pada dropdown fungsi di toolbar editor, pilih `setupSheet`, lalu tekan **Run**.

Google akan menampilkan dialog authorization. Pilih akun Anda, lalu pada layar peringatan pilih **Advanced**, kemudian **Go to (nama proyek) (unsafe)**, lalu **Allow**. Peringatan tersebut muncul karena proyek belum melalui proses verifikasi Google, bukan karena ada masalah pada kode.

Setelah selesai, buka kembali spreadsheet Anda. Baris pertama pada tab `Laporan Visit` seharusnya sudah terisi header kolom.

**Uji kedua, memastikan Groq merespons**

Pilih fungsi `testGroq`, lalu tekan **Run**. Buka **Execution log** untuk melihat hasilnya.

Jika muncul galat `401`, berarti Groq API Key salah atau sudah dicabut. Jika muncul galat yang menyebut model tidak ditemukan, berarti nilai `GROQ_MODEL` perlu disesuaikan dengan daftar model yang masih tersedia di Groq. Jika muncul galat `429`, berarti rate limit sedang tercapai dan Anda cukup menunggu sebentar.

**Verifikasi Fase 5**

Header sheet sudah terbentuk dan `testGroq` mengembalikan hasil ekstraksi tanpa galat. Jangan lanjut ke fase berikutnya sebelum keduanya berhasil, karena kegagalan di sini akan terbawa dan menyamar sebagai masalah webhook.

---

# Fase 6. Cloudflare Tunnel dan deploy Web App

## Langkah 13. Menjalankan Cloudflare Tunnel

Evolution API berjalan di `localhost:8080` dan tidak dapat dijangkau dari luar mesin Anda. Google Apps Script berjalan di infrastruktur Google, sehingga tidak mungkin memanggil alamat lokal tersebut. Tunnel inilah yang memberi Apps Script alamat publik untuk memanggil Evolution API ketika mengirim balasan WhatsApp dan mengambil media dalam bentuk Base64.

Perhatikan bahwa tunnel **tidak** diperlukan untuk arah sebaliknya. Evolution API tetap bisa mengirim webhook ke Apps Script tanpa tunnel, karena Evolution API mampu melakukan koneksi keluar ke internet.

Jalankan pada jendela terminal terpisah, dan biarkan terbuka:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Output akan memuat sebuah URL publik dengan bentuk seperti berikut:

```
https://nama-acak-yang-dihasilkan.trycloudflare.com
```

Salin URL tersebut ke `CONFIG.EVOLUTION_API_URL` di editor Apps Script, tanpa garis miring di akhir, lalu simpan.

```javascript
EVOLUTION_API_URL: 'https://nama-acak-yang-dihasilkan.trycloudflare.com',
```

> **Batasan yang perlu diingat.** Quick Tunnel menghasilkan URL acak baru setiap kali dijalankan. Jika terminal ditutup atau tunnel di restart, URL lama mati dan `EVOLUTION_API_URL` harus diperbarui lalu Web App dideploy ulang. Untuk pemakaian jangka panjang, gunakan Named Tunnel dengan domain tetap.

## Langkah 14. Deploy sebagai Web App

1. Di editor Apps Script, pilih **Deploy**, lalu **New deployment**.
2. Pada ikon gerigi di sebelah **Select type**, pilih **Web app**.
3. Isi **Description**, misalnya `v1 webhook receiver`.
4. **Execute as** diisi **Me (akun Anda)**.
5. **Who has access** diisi **Anyone**.
6. Pilih **Deploy**, lalu salin **Web app URL** yang berakhiran `/exec`.

Pengaturan **Anyone** wajib, karena Evolution API memanggil endpoint ini tanpa sesi login Google. Konsekuensinya, siapa pun yang mengetahui URL tersebut dapat mengirim payload ke dalamnya, jadi perlakukan URL `/exec` sebagai kredensial dan jangan pernah menaruhnya di repository publik.

**Verifikasi Fase 6**

Buka URL `/exec` di peramban. Karena endpoint ini hanya menangani `doPost`, respons berupa halaman kosong atau pesan galat metode adalah hal yang wajar. Yang tidak wajar adalah halaman login Google, karena itu menandakan **Who has access** belum disetel ke **Anyone**.

---

# Fase 7. Menyambungkan webhook

## Langkah 15. Mengisi `webhook.json`

Buka `webhook.json`, lalu isi `url` dengan URL `/exec` hasil Langkah 14.

```json
{
  "webhook": {
    "enabled": true,
    "url": "TEMPEL_URL_EXEC_DI_SINI",
    "webhookByEvents": false,
    "base64": true,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }
}
```

Tiga hal yang sering keliru pada berkas ini:

1. Seluruh isi harus berada di dalam pembungkus objek `webhook`. Menaruh field di level teratas akan ditolak oleh Evolution API v2.
2. Nama field pada request adalah `base64`, bukan `webhookBase64`. Nama `webhookBase64` hanya muncul pada respons `webhook/find`. Menukar keduanya akan membuat media tidak terkirim dalam bentuk Base64.
3. Cukup daftarkan event `MESSAGES_UPSERT`. Mendaftarkan seluruh event membuat Apps Script menerima lalu lintas yang tidak perlu dan memperbesar peluang kena batas kuota eksekusi.

## Langkah 16. Mengirim konfigurasi webhook

```powershell
curl.exe -s -X POST "http://localhost:8080/webhook/set/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY" `
  -H "Content-Type: application/json" `
  -d "@webhook.json"
```

**Verifikasi Fase 7**

```powershell
curl.exe -s -X GET "http://localhost:8080/webhook/find/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```

Pada respons, pastikan `enabled` bernilai `true`, `url` sesuai dengan URL `/exec` Anda, `webhookBase64` bernilai `true`, dan `events` memuat `MESSAGES_UPSERT`. Perbedaan penamaan antara `base64` yang dikirim dan `webhookBase64` yang diterima di sini adalah perilaku normal, bukan tanda kegagalan.

---

## Setelah setup selesai

Sistem sekarang siap menerima laporan pertama. Lanjutkan ke [`TESTING.md`](TESTING.md) untuk pengujian end to end, lalu ke [`OPERATIONS.md`](OPERATIONS.md) untuk pemantauan harian.

Sebelum melakukan commit, jalankan checklist di [`SECURITY.md`](SECURITY.md). Pada titik ini repository lokal Anda kemungkinan besar memuat API key Evolution, Groq API Key, dan URL Web App produksi, yang ketiganya tidak boleh ikut terdorong ke GitHub.

Jika ada tahap yang gagal, gejala dan penanganannya dibahas di [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

---

## Ringkasan perintah

Bagian ini hanya untuk pengulangan setup pada mesin yang sudah familier. Pengguna baru sebaiknya mengikuti panduan lengkap di atas beserta seluruh verifikasinya.

```powershell
# 1. Menyiapkan dan menjalankan Evolution API
git clone https://github.com/Voxans/Automated-Visit-Collection-Report-System.git
cd Automated-Visit-Collection-Report-System
# edit docker-compose.yml, isi AUTHENTICATION_API_KEY
docker compose config
docker compose up -d
$env:EVOLUTION_API_KEY = "API_KEY_ANDA"

# 2. Membuat dan menghubungkan instance WhatsApp
curl.exe -s -X POST "http://localhost:8080/instance/create" `
  -H "apikey: $env:EVOLUTION_API_KEY" -H "Content-Type: application/json" `
  -d '{\"instanceName\":\"pkl-collection\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}'
# scan QR melalui http://localhost:8080/manager
curl.exe -s -X GET "http://localhost:8080/instance/connectionState/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"

# 3. Membuka jalur balik menuju Evolution API
cloudflared tunnel --url http://localhost:8080

# 4. Menyambungkan webhook setelah Web App dideploy
curl.exe -s -X POST "http://localhost:8080/webhook/set/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY" -H "Content-Type: application/json" `
  -d "@webhook.json"
curl.exe -s -X GET "http://localhost:8080/webhook/find/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```
