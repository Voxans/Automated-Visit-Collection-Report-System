# Keamanan

Sistem ini menangani dua kategori hal sensitif sekaligus: kredensial yang membuka akses ke layanan (API key, URL deployment), dan data konsumen (nama, nomor kontrak, nomor telepon, alamat, status tunggakan). Dokumen ini membahas keduanya.

---

## Checklist sebelum commit atau push

Jalankan checklist ini setiap kali sebelum melakukan `git push`, bukan hanya sekali di awal proyek.

```
[ ] Tidak ada GROQ_API_KEY asli di Webhook_Bot.gs atau file mana pun
[ ] Tidak ada AUTHENTICATION_API_KEY asli di docker-compose.yml
[ ] Tidak ada URL Web App /exec dengan deployment ID asli di webhook.json
[ ] Tidak ada SHEET_ID atau DRIVE_FOLDER_ID milik data produksi di contoh dokumentasi
[ ] Tidak ada file .env, service account JSON, atau kredensial OAuth
[ ] .gitignore sudah mencakup seluruh pola di atas
[ ] git status tidak menampilkan file kredensial sebagai staged
```

### Memeriksa riwayat commit yang sudah terlanjur ada

Jika salah satu nilai di atas pernah ter-commit sebelumnya, mengganti nilainya di commit baru **tidak menghapusnya dari riwayat**. Nilai lama tetap bisa diambil siapa pun dari histori Git.

```powershell
git log -p -- docker-compose.yml | Select-String "AUTHENTICATION_API_KEY"
```

Jika perintah ini menampilkan nilai asli pada commit lama, langkah yang benar adalah:

1. Anggap kredensial tersebut sudah bocor.
2. Cabut dan buat ulang kredensial itu di sisi layanannya, misalnya generate ulang Groq API Key dari console Groq, dan ganti `AUTHENTICATION_API_KEY` lalu restart Evolution API.
3. Baru kemudian bersihkan riwayat Git jika repository akan dipublikasikan, menggunakan `git filter-repo` atau BFG Repo-Cleaner.

Mengganti nilai tanpa mencabut kredensial lama sama saja dengan mengunci pintu baru sementara kunci lama masih beredar.

---

## Contoh `.gitignore`

```gitignore
# Environment dan kredensial
.env
.env.local
*.pem
*.key
service-account*.json

# Konfigurasi berisi nilai asli, simpan hanya versi contohnya
docker-compose.override.yml

# Artefak Docker
volumes/
data/

# Umum
node_modules/
.DS_Store
```

Karena `docker-compose.yml` dan `webhook.json` pada repository ini memang dirancang untuk memuat nilai asli setelah dikonfigurasi, keduanya **sengaja tidak dimasukkan ke `.gitignore`**. Konsekuensinya, kedisiplinan menjaga isi keduanya tetap berupa placeholder sebelum commit menjadi tanggung jawab manual, bukan tanggung jawab `.gitignore`. Pertimbangkan menyediakan `docker-compose.example.yml` dan `webhook.example.json` berisi placeholder, lalu memasukkan nama file aslinya ke `.gitignore` sebagai alternatif yang lebih aman.

---

## Kredensial yang ada pada sistem ini

| Kredensial | Lokasi | Risiko jika bocor |
|---|---|---|
| `AUTHENTICATION_API_KEY` | `docker-compose.yml` | Siapa pun dapat mengirim atau membaca pesan WhatsApp melalui Evolution API |
| `GROQ_API_KEY` | `CONFIG` di Apps Script | Pemakaian kuota Groq oleh pihak lain, atas biaya akun Anda |
| URL Web App `/exec` | `webhook.json`, `CONFIG.EVOLUTION_API_URL` tidak relevan di sini | Siapa pun yang tahu URL dapat mengirim payload palsu ke `doPost`, berpotensi menulis baris palsu ke Sheets |
| URL Cloudflare Tunnel | Terminal, `CONFIG.EVOLUTION_API_URL` | Selama masih aktif, siapa pun yang tahu URL dapat memanggil Evolution API secara langsung tanpa melalui Google |

Baris ketiga pada tabel di atas perlu perhatian khusus karena sifatnya berbeda dari kredensial lain: **endpoint Web App tidak dilindungi API key**. Web App dideploy dengan **Who has access: Anyone** agar Evolution API dapat memanggilnya tanpa sesi login Google, dan pengaturan itu berarti proteksi satu satunya adalah kerahasiaan URL itu sendiri.

### Menambahkan validasi token pada `doPost`

Untuk pemakaian di luar sekadar uji coba, pertimbangkan menambahkan token rahasia yang diperiksa di awal `doPost`, dikirim sebagai bagian dari `webhook.json` atau sebagai header kustom dari Evolution API jika versi yang dipakai mendukungnya. Contoh pola sederhana di sisi Apps Script:

```javascript
function doPost(e) {
  var body = JSON.parse(e.postData.contents);

  if (body.token !== CONFIG.WEBHOOK_SECRET) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // lanjutkan pemrosesan seperti biasa
}
```

Ini bukan pengganti kerahasiaan URL, melainkan lapisan tambahan jika URL tersebut pada akhirnya bocor atau tertebak.

---

## Data konsumen

Data yang tercatat di `Laporan Visit` mencakup informasi yang tergolong sensitif dari sisi privasi konsumen: nama, nomor kontrak, nomor telepon, alamat, dan status tunggakan pembayaran. Beberapa hal yang perlu dipertimbangkan, tanpa mengasumsikan regulasi tertentu berlaku pada penggunaan Anda:

1. **Akses ke spreadsheet.** Batasi sharing Google Sheet hanya kepada pihak yang memang berwenang melihat data konsumen, dan hindari pengaturan sharing berupa "siapa saja dengan link ini".
2. **Akses ke folder Drive.** Berlaku pengaturan yang sama seperti pada spreadsheet, mengingat attachment dapat memuat foto lokasi atau dokumen yang menyertakan identitas.
3. **Retensi.** Pertimbangkan kebijakan berapa lama data laporan disimpan, dan apakah perlu ada proses penghapusan atau pengarsipan berkala.
4. **Pesan asli.** Kolom `Pesan Asli` pada `Laporan Visit` menyimpan teks mentah dari WhatsApp. Jika teks tersebut kebetulan memuat informasi di luar konteks laporan visit, informasi itu ikut tersimpan apa adanya.

---

## Sebelum repository dipublikasikan sebagai open source

Jika repository ini akan dibuka untuk umum, bukan hanya untuk portofolio dengan akses terbatas, tambahkan langkah berikut di luar checklist commit:

1. Pastikan tidak ada nama institusi, nama staff sungguhan, atau contoh data konsumen asli tertinggal di mana pun, termasuk di dalam screenshot pada dokumentasi.
2. Pertimbangkan menyamarkan nama proyek Apps Script dan judul spreadsheet pada contoh dokumentasi, karena judul yang khas dapat membantu pihak lain menebak keberadaan sistem serupa.
3. Tinjau kembali riwayat commit sebagaimana dibahas di bagian awal dokumen ini, bukan hanya isi commit terbaru.
