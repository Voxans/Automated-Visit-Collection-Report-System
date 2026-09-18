# Pengujian

Dokumen ini mencakup dua lapis pengujian. Lapis pertama menguji fungsi Apps Script secara terisolasi dari editor, tanpa melibatkan WhatsApp sama sekali. Lapis kedua menguji keseluruhan alur dari pesan WhatsApp asli hingga baris muncul di Google Sheets.

Kerjakan lapis pertama terlebih dahulu. Jika fungsi dasar saja sudah gagal dari editor, menelusuri kegagalan lewat WhatsApp akan jauh lebih lambat karena setiap percobaan melibatkan Evolution API, tunnel, dan webhook sekaligus.

---

## Lapis 1. Pengujian fungsi dari editor Apps Script

Pengujian ini sudah mulai dilakukan sebagai bagian dari [`SETUP.md` Fase 5](SETUP.md#fase-5-authorization-dan-uji-fungsi). Bagian ini mengulanginya secara lebih lengkap sebagai referensi kapan pun dibutuhkan, misalnya setelah mengubah kode atau mengganti API key.

### 1.1 `setupSheet()`

**Tujuan.** Memastikan header kolom pada tab `Laporan Visit` sesuai dengan yang ditulis oleh kode, dan sekaligus memicu authorization pertama kali.

**Cara menjalankan.** Pilih `setupSheet` pada dropdown fungsi di toolbar editor, lalu tekan **Run**.

**Hasil yang diharapkan.** Baris pertama pada tab `Laporan Visit` terisi header berikut, dalam urutan ini:

```
ID | Timestamp | Tanggal | Jenis Chat | Group ID | SCG | Nama Konsumen |
No Kontrak | Past Due | Nomor WhatsApp | Product | Alamat Visit |
Case Kategori | Keterangan | Rencana Penyelesaian | Pesan Asli | Ada Attachment
```

**Jika gagal.** Lihat entri **Header sheet tidak muncul atau salah** pada [`TROUBLESHOOTING.md`](../TROUBLESHOOTING.md).

### 1.2 `testGroq()`

**Tujuan.** Memastikan `GROQ_API_KEY` valid dan `GROQ_MODEL` masih tersedia, tanpa perlu mengirim pesan WhatsApp.

**Cara menjalankan.** Pilih `testGroq`, tekan **Run**, lalu buka **Execution log** melalui menu **View**.

**Hasil yang diharapkan.** Log menampilkan objek JSON hasil ekstraksi dari teks contoh yang ada di dalam fungsi tersebut, memuat field seperti `Nama Konsumen` dan `Case Kategori` terisi wajar sesuai teks contohnya.

**Jika gagal.** Lihat entri **Groq mengembalikan galat** pada `TROUBLESHOOTING.md`. Catat kode galatnya, karena 401, 404, dan 429 masing masing menunjuk penyebab yang berbeda.

### 1.3 Uji manual `doPost()` dengan payload tiruan

**Tujuan.** Menguji seluruh alur pemrosesan, mulai dari parsing payload, pemanggilan Groq, penulisan ke Sheets, hingga penyimpanan attachment, tanpa bergantung pada Evolution API maupun webhook.

**Cara menjalankan.** Tambahkan fungsi sementara berikut di editor, isi `payload` dengan bentuk event `MESSAGES_UPSERT` yang sesuai dengan yang diharapkan `doPost()`, lalu jalankan fungsi ini secara langsung.

```javascript
function ujiManualDoPost() {
  var payload = {
    // isi sesuai struktur event MESSAGES_UPSERT dari Evolution API,
    // ambil salah satu contoh nyata dari Execution log webhook
    // yang asli sebagai acuan bentuknya
  };

  var mockEvent = {
    postData: {
      contents: JSON.stringify(payload)
    }
  };

  var result = doPost(mockEvent);
  Logger.log(result.getContent());
}
```

**Hasil yang diharapkan.** Baris baru muncul di tab `Laporan Visit`, dan jika payload menyertakan attachment, berkas gambar muncul di folder Drive yang ditunjuk `DRIVE_FOLDER_ID`.

**Manfaat cara ini.** Karena tidak melibatkan jaringan luar, uji ini adalah cara tercepat untuk memastikan logika pemrosesan sudah benar sebelum mempersoalkan Evolution API atau tunnel sama sekali. Hapus fungsi `ujiManualDoPost` setelah selesai, atau biarkan sebagai alat bantu pengembangan asalkan tidak ikut terpanggil oleh trigger apa pun.

---

## Lapis 2. Pengujian end to end

Pengujian ini baru dilakukan setelah seluruh fase di `SETUP.md` selesai, termasuk webhook sudah tersambung dan terverifikasi melalui `webhook/find`.

### 2.1 Menyiapkan pengamatan sebelum mengirim pesan

Sebelum mengirim pesan uji, buka tiga hal berikut secara bersamaan supaya jika terjadi kegagalan Anda langsung tahu di titik mana:

1. **Execution log Apps Script**, melalui menu **Executions** di sisi kiri editor, bukan **View > Execution log** yang hanya menampilkan proses yang dijalankan manual dari editor.
2. **Log Evolution API**, dengan menjalankan `docker compose logs -f evolution-api` di terminal.
3. Tab `Laporan Visit` pada Google Sheets, dan folder Drive tujuan attachment.

### 2.2 Uji kirim pesan teks tanpa attachment

Dari WhatsApp lain, kirim pesan berikut ke nomor bot atau ke grup yang sudah memasukkan nomor bot sebagai anggota:

```
Visit ke Toko Makmur Jaya, kontrak 00123456, past due 30 hari.
Ketemu pemilik, janji bayar minggu depan. Kondisi toko masih buka normal.
```

**Yang harus terjadi, dalam urutan ini:**

1. Log Evolution API menampilkan event `MESSAGES_UPSERT` masuk.
2. Menu **Executions** di Apps Script menampilkan eksekusi baru berstatus `Completed`.
3. Baris baru muncul di `Laporan Visit`, dengan `Nama Konsumen` dan `Case Kategori` terisi wajar berdasarkan teks yang dikirim.
4. Balasan konfirmasi diterima kembali di WhatsApp pengirim.

Jika salah satu tahap tidak terjadi, tahap terakhir yang berhasil menunjukkan letak masalahnya. Misalnya jika tahap 1 dan 2 berhasil tetapi tahap 4 tidak, kemungkinan besar masalah ada pada tunnel atau `EVOLUTION_API_URL`, bukan pada Groq atau Sheets.

### 2.3 Uji kirim gambar dengan caption

Kirim sebuah foto dengan caption:

```
Visit Toko Sinar Abadi, kontrak 00987654, past due 15 hari, kondisi masih tutup
```

**Hasil yang diharapkan.** Baris baru muncul di `Laporan Visit` berdasarkan isi caption, kolom `Ada Attachment` bernilai `TRUE` atau setara, dan berkas gambar tersimpan di folder Drive tujuan dengan nama yang dapat ditelusuri kembali ke baris tersebut.

**Catatan penting.** Attachment tidak dikirim ke Groq. Hanya teks caption yang diekstrak. Jika Anda mengirim gambar tanpa caption sama sekali, seharusnya tidak ada pemanggilan Groq, dan baris yang tercatat akan memiliki kolom hasil ekstraksi kosong sementara `Ada Attachment` tetap terisi.

### 2.4 Uji dari grup WhatsApp

Ulangi 2.2 dari sebuah grup, bukan chat personal. Periksa kolom `Jenis Chat` dan `Group ID` terisi dengan benar, dan pastikan balasan konfirmasi dikirim ke grup tersebut, bukan ke chat personal pengirim.

### 2.5 Uji pesan yang tidak relevan

Kirim pesan yang jelas bukan laporan visit, misalnya:

```
Halo, tesss
```

**Hasil yang diharapkan.** Sistem sebaiknya tidak menghasilkan baris sampah di Sheets, atau jika tetap tercatat, kolom hasil ekstraksi sebagian besar kosong sehingga mudah dibedakan dari laporan asli saat direkap. Perilaku yang dipilih bergantung pada bagaimana prompt Groq di `Webhook_Bot.gs` dirancang. Catat perilaku aktualnya di sini agar tim yang memakai sistem tahu apa yang harus diharapkan.

---

## Checklist status sistem

Gunakan checklist berikut sebagai tanda sistem sudah siap dipakai untuk laporan sungguhan, sebagai pengganti tabel status yang sebelumnya ada di README.

```
[ ] docker compose ps menunjukkan seluruh service running
[ ] connectionState instance bernilai open
[ ] setupSheet() sudah dijalankan dan header sudah benar
[ ] testGroq() mengembalikan hasil tanpa galat
[ ] webhook/find menunjukkan enabled true dan url sesuai deployment aktif
[ ] Uji kirim teks tanpa attachment berhasil sampai ke balasan WhatsApp
[ ] Uji kirim gambar dengan caption tersimpan ke Sheets dan Drive
[ ] Uji dari grup mencatat Jenis Chat dan Group ID dengan benar
```

Jika seluruh kotak tercentang, lanjutkan ke [`OPERATIONS.md`](OPERATIONS.md) untuk pemantauan harian.
