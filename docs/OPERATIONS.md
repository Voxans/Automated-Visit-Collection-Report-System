# Operasional dan Monitoring

Dokumen ini untuk sistem yang sudah berjalan, bukan untuk instalasi. Jika Anda baru memasang sistem, ikuti [`SETUP.md`](SETUP.md) dan [`TESTING.md`](TESTING.md) terlebih dahulu.

---

## Ringkasan tempat memantau

| Yang dipantau | Di mana | Untuk apa |
|---|---|---|
| Evolution API | `docker compose logs -f` | Status koneksi WhatsApp, event masuk, error gateway |
| Apps Script | Menu **Executions** di editor | Riwayat eksekusi `doPost`, durasi, dan galat |
| Cloudflare Tunnel | Terminal tempat `cloudflared` berjalan | URL aktif, status koneksi tunnel |
| Data laporan | Tab `Laporan Visit` | Hasil akhir yang dilihat pengguna |
| Attachment | Folder Google Drive | Kelengkapan berkas terhadap baris di Sheets |

---

## Monitoring Evolution API

### Melihat log secara langsung

```powershell
docker compose logs -f evolution-api
```

Perhatikan dua jenis baris log:

* Baris yang memuat `MESSAGES_UPSERT` menandakan pesan WhatsApp baru diterima dan diteruskan sebagai webhook.
* Baris yang memuat kegagalan HTTP saat mengirim webhook, biasanya berupa kode status 4xx atau 5xx, menandakan Apps Script menolak atau gagal memproses payload.

### Memeriksa status koneksi instance

Jalankan secara berkala, terutama setelah sistem idle dalam waktu lama:

```powershell
curl.exe -s -X GET "http://localhost:8080/instance/connectionState/pkl-collection" `
  -H "apikey: $env:EVOLUTION_API_KEY"
```

Nilai `state` yang bukan `open` berarti sesi WhatsApp terputus dan bot berhenti menerima pesan sampai dipasangkan ulang.

### Memeriksa resource container

```powershell
docker stats
```

Kenaikan penggunaan memori yang terus menerus pada container Evolution API, tanpa pernah turun, adalah indikasi awal yang patut diperhatikan meskipun belum tentu langsung menyebabkan gangguan.

---

## Monitoring Google Apps Script

### Membaca riwayat eksekusi

Buka proyek Apps Script, pilih menu **Executions** di panel kiri. Setiap baris menunjukkan satu kali `doPost` dipanggil, lengkap dengan status, durasi, dan waktu mulai.

Status yang perlu diperhatikan:

* **Completed** berarti eksekusi selesai tanpa exception, tetapi ini tidak menjamin data benar; tetap periksa hasil di Sheets sesekali.
* **Failed** berarti ada exception yang tidak tertangkap. Klik baris tersebut untuk melihat stack trace.
* Durasi yang mendekati batas waktu eksekusi Apps Script menandakan proses hampir timeout, biasanya karena attachment berukuran besar atau respons Groq yang lambat.

### Kuota yang perlu diperhatikan

Akun Google konsumen memiliki kuota harian untuk Apps Script, di antaranya jumlah pemanggilan URL Fetch dan total waktu eksekusi skrip. Pada volume laporan visit yang wajar untuk satu tim, kuota ini jarang tercapai, tetapi patut diperiksa jika terjadi lonjakan volume pesan mendadak atau jika beberapa instance bot berbagi akun Google yang sama.

---

## Monitoring Cloudflare Tunnel

Tunnel jenis Quick Tunnel tidak memiliki dashboard pemantauan. Cara memantaunya adalah menjaga jendela terminal tempat `cloudflared` berjalan tetap terbuka dan terlihat.

Yang perlu diperiksa secara berkala:

1. Proses `cloudflared` masih berjalan dan belum tertutup tanpa sengaja.
2. URL yang tercetak di terminal masih sama dengan yang tersimpan di `CONFIG.EVOLUTION_API_URL` pada Apps Script. Keduanya akan berbeda setelah tunnel di restart.

Jika sistem ini dipakai lebih dari sekadar uji coba, pertimbangkan berpindah ke Named Tunnel dengan domain tetap sebagaimana disinggung di `SETUP.md`, karena itu menghilangkan kebutuhan memantau perubahan URL sama sekali.

---

## Pemeliharaan rutin

| Frekuensi | Tindakan |
|---|---|
| Harian | Periksa beberapa baris terbaru di `Laporan Visit` secara sekilas, pastikan hasil ekstraksi masuk akal |
| Harian | Pastikan jendela `cloudflared` masih berjalan |
| Mingguan | Periksa `connectionState` instance WhatsApp |
| Mingguan | Periksa sisa kuota atau tagihan Groq API |
| Saat mesin dinyalakan ulang | Jalankan ulang `docker compose up -d` dan `cloudflared`, lalu perbarui `EVOLUTION_API_URL` jika memakai Quick Tunnel |
| Saat ada laporan pengguna gagal masuk | Ikuti alur diagnosis di `TROUBLESHOOTING.md` |

---

## Catatan tentang pembaruan konfigurasi

Beberapa perubahan memerlukan deployment ulang Web App agar berlaku, sementara yang lain cukup disimpan.

| Perubahan | Perlu deployment ulang? |
|---|---|
| Mengubah nilai di dalam `CONFIG`, misalnya `EVOLUTION_API_URL` | Ya |
| Mengubah logika di dalam fungsi yang sudah ada | Ya |
| Menambah fungsi baru yang belum dipanggil dari `doPost` | Tidak wajib, tetapi disarankan agar versi deployment tetap mencerminkan kode terbaru |

Setiap **New deployment** menghasilkan URL `/exec` yang bisa saja tetap sama jika Anda memilih **Manage deployments** dan melakukan **Edit** pada deployment yang sudah ada, dibandingkan membuat deployment baru dari awal. Menggunakan **Edit** pada deployment yang sama lebih disarankan agar `webhook.json` tidak perlu diperbarui setiap kali ada perubahan kecil pada kode.

Lihat [`SETUP.md` Langkah 14](SETUP.md#langkah-14-deploy-sebagai-web-app) untuk detail proses deployment.
