# Troubleshooting
 
Setiap entri disusun dengan format yang sama: **Gejala**, **Penyebab umum**, **Cara verifikasi**, **Solusi**. Cari berdasarkan gejala yang paling mendekati yang Anda alami, bukan berdasarkan komponen yang Anda curigai, karena satu gejala pada sistem ini sering berasal dari komponen yang tidak terduga.
 
Sebelum menelusuri satu per satu, buka tiga sumber log sekaligus sebagaimana disarankan di [`docs/TESTING.md`](docs/TESTING.md#21-menyiapkan-pengamatan-sebelum-mengirim-pesan): log Docker, Executions Apps Script, dan tab Laporan Visit. Sebagian besar entri di bawah ini merujuk pada salah satu dari ketiganya.
 
---
 
## Daftar Isi
 
1. [Instance WhatsApp tidak mau connect atau QR terus muncul](#1-instance-whatsapp-tidak-mau-connect-atau-qr-terus-muncul)
2. [Webhook tidak diterima Apps Script sama sekali](#2-webhook-tidak-diterima-apps-script-sama-sekali)
3. [Apps Script menerima webhook tetapi Execution gagal](#3-apps-script-menerima-webhook-tetapi-execution-gagal)
4. [Media atau attachment tidak tersimpan ke Drive](#4-media-atau-attachment-tidak-tersimpan-ke-drive)
5. [Data yang tersimpan di Sheets salah atau kosong](#5-data-yang-tersimpan-di-sheets-salah-atau-kosong)
6. [Bot tidak membalas ke WhatsApp](#6-bot-tidak-membalas-ke-whatsapp)
7. [URL Cloudflare Tunnel berubah dan bot berhenti membalas](#7-url-cloudflare-tunnel-berubah-dan-bot-berhenti-membalas)
8. [Halaman login Google muncul saat memanggil URL /exec](#8-halaman-login-google-muncul-saat-memanggil-url-exec)
9. [Nama tab Sheet tidak dikenali](#9-nama-tab-sheet-tidak-dikenali)
10. [Groq mengembalikan galat](#10-groq-mengembalikan-galat)
11. [Container Evolution API terus restart](#11-container-evolution-api-terus-restart)
12. [Pesan diproses dua kali atau bot membalas pesannya sendiri](#12-pesan-diproses-dua-kali-atau-bot-membalas-pesannya-sendiri)
13. [Execution timeout atau attachment berukuran besar gagal](#13-execution-timeout-atau-attachment-berukuran-besar-gagal)
14. [Timestamp pada Sheets memakai zona waktu yang salah](#14-timestamp-pada-sheets-memakai-zona-waktu-yang-salah)
---
 
## 1. Instance WhatsApp tidak mau connect atau QR terus muncul
 
**Gejala.** QR Code sudah dipindai, tetapi `connectionState` tidak pernah berpindah ke `open`, atau kembali meminta QR baru setelah beberapa saat.
 
**Penyebab umum.**
- Sesi WhatsApp sebelumnya pada nomor yang sama masih tertaut di perangkat lain dan terjadi konflik sesi.
- QR Code sudah kedaluwarsa sebelum sempat dipindai.
- Nomor WhatsApp mengalami pembatasan sementara oleh WhatsApp karena aktivitas yang dianggap tidak wajar.
**Cara verifikasi.**
```powershell
curl.exe -s -X GET "http://localhost:8080/instance/connectionState/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```
Perhatikan juga log Docker pada saat yang bersamaan untuk pesan terkait Baileys atau `Connection Closed`.
 
**Solusi.**
1. Hapus instance lalu buat ulang jika sesi tampak rusak total: `POST /instance/logout/pkl-collection`, lalu `DELETE /instance/delete/pkl-collection`, lalu ulangi Langkah 6 dan 7 di `SETUP.md`.
2. Minta QR baru dengan memanggil ulang `GET /instance/connect/pkl-collection`, lalu segera pindai tanpa jeda.
3. Jika WhatsApp membatasi nomor, tunggu beberapa saat sebelum mencoba lagi, dan hindari mengirim pesan dalam volume besar segera setelah pairing.
---
 
## 2. Webhook tidak diterima Apps Script sama sekali
 
**Gejala.** Log Docker menunjukkan pesan WhatsApp diterima, tetapi tidak ada Execution baru yang muncul di Apps Script.
 
**Penyebab umum.**
- Konfigurasi webhook belum tersambung atau `enabled` bernilai `false`.
- URL pada `webhook.json` menunjuk deployment lama yang sudah tidak aktif.
- Event `MESSAGES_UPSERT` tidak termasuk dalam daftar `events` yang didaftarkan.
**Cara verifikasi.**
```powershell
curl.exe -s -X GET "http://localhost:8080/webhook/find/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```
Periksa `enabled: true`, `url` sesuai deployment yang aktif saat ini, dan `MESSAGES_UPSERT` ada di dalam `events`.
 
**Solusi.**
1. Jika `url` menunjuk deployment lama, ambil URL `/exec` yang sekarang aktif dari **Deploy > Manage deployments** di Apps Script, perbarui `webhook.json`, lalu kirim ulang dengan `POST /webhook/set/pkl-collection`.
2. Jika `enabled` bernilai `false`, set kembali menjadi `true` pada `webhook.json` dan kirim ulang.
3. Pastikan `events` memuat `MESSAGES_UPSERT` persis seperti itu, karena nama event bersifat case sensitive.
---
 
## 3. Apps Script menerima webhook tetapi Execution gagal
 
**Gejala.** Ada baris baru pada menu **Executions** dengan status **Failed**, atau tidak ada Execution baru sama sekali padahal webhook sudah terkonfirmasi terkirim melalui log Docker.
 
**Penyebab umum.**
- Apps Script belum pernah diberi authorization, sehingga permintaan gagal tanpa sempat menghasilkan log yang informatif.
- Ada kesalahan pada kode setelah pembaruan terakhir yang belum sempat diuji dari editor.
- Kuota harian Apps Script untuk akun tersebut sudah tercapai.
**Cara verifikasi.** Buka **Executions**, klik entri yang gagal, baca stack trace pada panel yang muncul. Jika tidak ada Execution sama sekali padahal webhook terkirim, ini pertanda kuat permission belum pernah diberikan.
 
**Solusi.**
1. Jalankan `setupSheet()` atau `testGroq()` langsung dari editor untuk memicu dialog authorization, lalu selesaikan prosesnya. Lihat [`SETUP.md` Langkah 12](docs/SETUP.md#langkah-12-menjalankan-fungsi-uji-dari-editor).
2. Jika stack trace menunjuk baris kode tertentu, uji fungsi tersebut secara terisolasi memakai pola pada [`TESTING.md` bagian 1.3](docs/TESTING.md#13-uji-manual-dopost-dengan-payload-tiruan).
3. Jika penyebabnya kuota, tunggu hingga kuota tereset, biasanya pada awal hari berikutnya menurut zona waktu akun Google tersebut.
---
 
## 4. Media atau attachment tidak tersimpan ke Drive
 
**Gejala.** Baris laporan tercatat di Sheets, tetapi kolom `Ada Attachment` tidak sesuai kenyataan, atau berkas tidak muncul di folder Drive yang dituju.
 
**Penyebab umum.**
- `DRIVE_FOLDER_ID` salah atau menunjuk folder yang sudah dipindahkan atau dihapus.
- Field `base64` pada `webhook.json` tidak bernilai `true`, sehingga Evolution API tidak menyertakan data media di payload webhook.
- Ukuran media melebihi batas yang wajar diproses dalam satu eksekusi Apps Script.
**Cara verifikasi.**
```powershell
curl.exe -s -X GET "http://localhost:8080/webhook/find/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```
Periksa `webhookBase64` bernilai `true` pada respons ini. Ingat bahwa nama field pada request yang dikirim adalah `base64`, sedangkan yang muncul di respons `find` bernama `webhookBase64`. Keduanya menunjuk pengaturan yang sama, hanya berbeda nama sesuai konteksnya.
 
**Solusi.**
1. Jika `webhookBase64` bernilai `false`, perbaiki `webhook.json` agar memuat `"base64": true` di dalam objek `webhook`, lalu kirim ulang konfigurasinya.
2. Verifikasi ulang `DRIVE_FOLDER_ID` dengan membuka folder di Drive dan membandingkan potongan terakhir URL nya dengan nilai di `CONFIG`.
3. Untuk media berukuran besar, lihat entri [13. Execution timeout atau attachment berukuran besar gagal](#13-execution-timeout-atau-attachment-berukuran-besar-gagal).
---
 
## 5. Data yang tersimpan di Sheets salah atau kosong
 
**Gejala.** Baris tercatat, tetapi sebagian kolom kosong, tertukar urutannya, atau berisi nilai yang tidak sesuai isi pesan.
 
**Penyebab umum.**
- Format pesan yang dikirim staff terlalu jauh menyimpang dari pola yang diharapkan prompt Groq.
- Header sheet belum pernah dibuat lewat `setupSheet()`, sehingga urutan kolom pada baris data tidak sinkron dengan urutan header manual yang mungkin berbeda.
- Model Groq yang dipakai sudah berganti perilaku atau tidak lagi sesuai dengan format yang diharapkan.
**Cara verifikasi.** Bandingkan hasil `testGroq()` di editor terhadap pesan asli yang menghasilkan baris bermasalah. Jalankan `testGroq()` dengan teks yang persis sama seperti pesan bermasalah tersebut jika memungkinkan.
 
**Solusi.**
1. Jika header belum pernah dibuat otomatis, jalankan `setupSheet()` pada sheet baru dan pindahkan data lama secara manual sesuai urutan kolom yang benar.
2. Tinjau kembali instruksi ekstraksi yang dikirim ke Groq, dan tambahkan lebih banyak contoh format pesan yang bervariasi.
3. Sosialisasikan kembali ke staff mengenai format pesan yang paling mudah diekstraksi dengan akurat, tanpa membatasi mereka menjadi terlalu kaku.
---
 
## 6. Bot tidak membalas ke WhatsApp
 
**Gejala.** Baris berhasil tercatat di Sheets, artinya seluruh pemrosesan berhasil, tetapi tidak ada balasan konfirmasi yang sampai ke WhatsApp pengirim.
 
**Penyebab umum.** Ini adalah gejala paling khas dari kegagalan pada jalur balik, yaitu Apps Script tidak berhasil memanggil Evolution API. Karena arah ini melewati Cloudflare Tunnel, penyebabnya hampir selalu salah satu dari:
- URL tunnel sudah berubah dan `EVOLUTION_API_URL` di Apps Script masih menyimpan URL lama.
- Proses `cloudflared` sudah berhenti berjalan.
- `EVOLUTION_API_KEY` yang dipakai Apps Script untuk memanggil balik Evolution API tidak sama dengan `AUTHENTICATION_API_KEY` di `docker-compose.yml`.
**Cara verifikasi.** Lihat stack trace pada Execution yang berstatus Failed di Apps Script; kegagalan memanggil URL eksternal biasanya tercatat sebagai galat koneksi atau timeout pada baris kode yang memanggil `EVOLUTION_API_URL`.
 
**Solusi.** Lihat entri berikutnya, [7. URL Cloudflare Tunnel berubah dan bot berhenti membalas](#7-url-cloudflare-tunnel-berubah-dan-bot-berhenti-membalas), karena penyebab paling umum untuk gejala ini ada di sana.
 
---
 
## 7. URL Cloudflare Tunnel berubah dan bot berhenti membalas
 
**Gejala.** Sistem sebelumnya berjalan normal, lalu tiba tiba berhenti membalas setelah komputer di-restart, `cloudflared` ditutup dan dibuka lagi, atau koneksi internet sempat putus.
 
**Penyebab umum.** Cloudflare Quick Tunnel menghasilkan subdomain acak baru setiap kali dijalankan. URL lama berhenti berfungsi begitu proses `cloudflared` yang lama berakhir, tetapi `CONFIG.EVOLUTION_API_URL` di Apps Script tidak otomatis mengikuti perubahan tersebut.
 
**Cara verifikasi.** Bandingkan URL yang tercetak di terminal `cloudflared` saat ini dengan nilai `EVOLUTION_API_URL` pada `CONFIG` di editor Apps Script.
 
**Solusi.**
1. Salin URL baru dari terminal `cloudflared`.
2. Perbarui `CONFIG.EVOLUTION_API_URL` di editor Apps Script.
3. Simpan, lalu buat deployment baru atau perbarui deployment yang ada melalui **Deploy > Manage deployments > Edit**.
4. Untuk menghindari gangguan ini berulang, pertimbangkan Named Tunnel dengan domain tetap sebagai pengganti Quick Tunnel, sebagaimana disinggung di `SETUP.md`.
---
 
## 8. Halaman login Google muncul saat memanggil URL /exec
 
**Gejala.** Membuka URL `/exec` di peramban, atau memanggilnya dari Evolution API, menghasilkan halaman login Google alih alih respons dari script.
 
**Penyebab umum.** Pengaturan **Who has access** pada deployment Web App tidak disetel ke **Anyone**, sehingga Google mewajibkan sesi login sebelum mengizinkan akses ke endpoint tersebut.
 
**Cara verifikasi.** Buka **Deploy > Manage deployments**, periksa pengaturan akses pada deployment yang sedang aktif dipakai.
 
**Solusi.**
1. Pilih ikon pensil pada deployment yang aktif, ubah **Who has access** menjadi **Anyone**, lalu simpan.
2. Jika URL berubah setelah langkah ini, perbarui `webhook.json` dan kirim ulang konfigurasi webhook.
3. Ingat bahwa pengaturan **Anyone** berarti URL tersebut menjadi satu satunya lapisan proteksi. Lihat [`SECURITY.md`](docs/SECURITY.md#kredensial-yang-ada-pada-sistem-ini) untuk pertimbangan menambahkan validasi token.
---
 
## 9. Nama tab Sheet tidak dikenali
 
**Gejala.** Execution berjalan tanpa galat menurut log, tetapi tidak ada baris baru yang muncul, atau muncul galat yang menyebut sheet atau range tidak ditemukan.
 
**Penyebab umum.** Nama tab pada spreadsheet tidak persis sama dengan `Laporan Visit`, termasuk kemungkinan ada spasi tambahan di awal atau akhir nama, huruf kapital yang berbeda, atau tab tersebut terhapus dan diganti nama tabnya.
 
**Cara verifikasi.** Klik dua kali nama tab pada spreadsheet untuk melihat nama persisnya, lalu bandingkan karakter demi karakter dengan `CONFIG.SHEET_NAME` di Apps Script.
 
**Solusi.** Samakan salah satunya, baik dengan mengganti nama tab agar sesuai `CONFIG`, atau mengubah `CONFIG.SHEET_NAME` agar sesuai nama tab yang sudah ada. Setelah disamakan, jalankan ulang `setupSheet()` untuk memastikan header tetap sesuai.
 
---
 
## 10. Groq mengembalikan galat
 
**Gejala.** `testGroq()` atau eksekusi sungguhan menghasilkan galat yang berasal dari pemanggilan Groq API.
 
**Penyebab umum berdasarkan kode galat.**
 
| Kode | Penyebab umum |
|---|---|
| 401 | `GROQ_API_KEY` salah, sudah dicabut, atau tertukar dengan kunci layanan lain |
| 404 pada model | Nama model di `GROQ_MODEL` sudah tidak tersedia atau salah ketik |
| 429 | Rate limit tercapai, baik karena kuota per menit maupun kuota harian |
| 5xx | Gangguan sementara pada sisi Groq |
 
**Cara verifikasi.** Jalankan `testGroq()` dari editor dan baca kode galat pada **Execution log** secara spesifik, jangan hanya membaca pesan galat umumnya.
 
**Solusi.**
1. Untuk galat 401, buat API key baru dari console Groq dan perbarui `CONFIG.GROQ_API_KEY`.
2. Untuk galat 404 pada model, periksa daftar model yang tersedia saat ini di dokumentasi Groq, lalu perbarui `CONFIG.GROQ_MODEL`.
3. Untuk galat 429, kurangi frekuensi pengiriman uji coba, dan pertimbangkan menambahkan retry dengan jeda pada kode jika volume laporan sungguhan memang tinggi.
4. Untuk galat 5xx, tunggu beberapa saat dan coba lagi, karena ini bukan masalah pada konfigurasi Anda.
---
 
## 11. Container Evolution API terus restart
 
**Gejala.** `docker compose ps` menunjukkan status container Evolution API berulang kali berpindah antara `starting` dan `restarting`, tidak pernah stabil di `running`.
 
**Penyebab umum.**
- Container database atau cache pendukung belum siap saat Evolution API mencoba terhubung.
- Port yang dipetakan di host, misalnya `8080`, sudah dipakai proses lain di komputer.
- Variabel lingkungan wajib pada `docker-compose.yml` belum lengkap terisi.
**Cara verifikasi.**
```powershell
docker compose logs evolution-api --tail 100
```
Baca pesan galat pada baris paling akhir sebelum container berhenti, biasanya menyebut kegagalan koneksi ke database atau kegagalan bind port secara eksplisit.
 
**Solusi.**
1. Jika penyebabnya database belum siap, jalankan `docker compose up -d` sekali lagi setelah beberapa saat, karena beberapa image database membutuhkan waktu inisialisasi lebih lama pada saat pertama kali dijalankan.
2. Jika port bentrok, ubah pemetaan port di sisi host pada `docker-compose.yml`, misalnya menjadi `8081:8080`, lalu sesuaikan seluruh contoh perintah di `SETUP.md` yang memakai `8080`.
3. Bandingkan variabel lingkungan yang terisi dengan daftar yang didokumentasikan, pastikan tidak ada yang tertinggal kosong.
---
 
## 12. Pesan diproses dua kali atau bot membalas pesannya sendiri
 
**Gejala.** Satu pesan menghasilkan dua baris di Sheets, atau bot terlihat membalas balasannya sendiri secara berulang.
 
**Penyebab umum.**
- Evolution API mengirim webhook lebih dari sekali untuk event yang sama, tergantung konfigurasi retry pada sisi gateway.
- Event `fromMe` pada payload, yang menandakan pesan berasal dari nomor bot sendiri, tidak difilter di dalam `doPost`, sehingga balasan konfirmasi bot ikut terbaca sebagai pesan masuk baru.
**Cara verifikasi.** Periksa apakah kode di `Webhook_Bot.gs` memeriksa nilai `fromMe` atau field setara pada payload sebelum memproses pesan sebagai laporan baru.
 
**Solusi.**
1. Tambahkan pemeriksaan di awal `doPost` untuk mengabaikan payload yang menandakan pesan berasal dari nomor bot sendiri.
2. Pertimbangkan menyimpan identifier pesan yang sudah diproses, misalnya dalam Cache Service milik Apps Script dengan masa berlaku singkat, untuk mencegah pemrosesan ganda jika Evolution API mengirim webhook duplikat dalam rentang waktu berdekatan.
---
 
## 13. Execution timeout atau attachment berukuran besar gagal
 
**Gejala.** Execution pada menu **Executions** berstatus **Failed** dengan durasi mendekati batas maksimum, khususnya pada pesan yang menyertakan gambar berukuran besar.
 
**Penyebab umum.** Apps Script memiliki batas waktu eksekusi per pemanggilan, dan proses mengunduh media Base64 berukuran besar dari Evolution API lalu mengunggahnya ke Drive dapat memakan waktu signifikan, terutama jika ditambah waktu pemanggilan Groq pada pesan yang sama.
 
**Cara verifikasi.** Bandingkan durasi Execution yang gagal dengan Execution lain yang berhasil pada pesan tanpa attachment atau dengan attachment berukuran kecil.
 
**Solusi.**
1. Sosialisasikan ke staff untuk mengirim foto dengan resolusi wajar, tidak perlu resolusi kamera penuh, karena WhatsApp sendiri biasanya sudah mengompresi gambar terkirim.
2. Jika memungkinkan, pisahkan proses penyimpanan attachment agar tidak menunggu proses ekstraksi Groq selesai terlebih dahulu, atau sebaliknya, sehingga total waktu tidak terakumulasi secara berurutan.
3. Untuk kasus yang berulang, pertimbangkan menambahkan penanganan khusus bagi attachment yang melebihi ukuran tertentu, misalnya tetap menyimpan ke Drive tetapi menandai baris di Sheets sebagai perlu ditinjau manual.
---
 
## 14. Timestamp pada Sheets memakai zona waktu yang salah
 
**Gejala.** Kolom `Timestamp` tercatat dengan jam yang bergeser dari waktu sebenarnya pesan dikirim, biasanya selisih dalam hitungan jam yang konsisten.
 
**Penyebab umum.** Zona waktu proyek Apps Script tidak diatur sesuai zona waktu yang diharapkan, sehingga fungsi seperti `new Date()` diformat menurut zona waktu default proyek, bukan zona waktu operasional tim.
 
**Cara verifikasi.** Buka **Project Settings** pada proyek Apps Script melalui ikon gerigi di panel kiri, periksa nilai **Time zone** yang tercantum di sana.
 
**Solusi.** Ubah **Time zone** pada Project Settings agar sesuai zona waktu operasional, misalnya `Asia/Jakarta`, lalu uji kembali dengan mengirim satu pesan baru untuk memastikan timestamp berikutnya sudah sesuai. Timestamp pada baris yang sudah tercatat sebelumnya tidak berubah secara otomatis dan perlu dikoreksi manual jika diperlukan.
 
---
 
## Jika tidak ada entri yang cocok
 
Kumpulkan tiga hal berikut sebelum mencari bantuan lebih lanjut, karena ketiganya adalah yang paling sering dibutuhkan untuk mendiagnosis gejala baru pada sistem ini:
 
1. Cuplikan **Execution log** dari Apps Script pada eksekusi yang bermasalah, lengkap dengan stack trace jika ada.
2. Cuplikan log Docker Evolution API pada rentang waktu yang sama.
3. Hasil `GET /webhook/find/pkl-collection` untuk memastikan konfigurasi webhook memang sesuai yang diharapkan pada saat kejadian.
 
