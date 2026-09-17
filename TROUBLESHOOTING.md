
# Troubleshooting

## A. Instance `close`

Cek:

``` powershell
curl.exe "http://localhost:8080/instance/connectionState/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Jika:

``` text
close
```

hubungkan kembali nomor WhatsApp menggunakan QR/pairing.

Jika terjadi:

``` text
device_removed
```

berarti sesi WhatsApp pada Evolution API telah terputus dan perlu
dilakukan pairing ulang.

------------------------------------------------------------------------

## B. Webhook `null`

Cek:

``` powershell
curl.exe -X GET "http://localhost:8080/webhook/find/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

Jika:

``` text
null
```

berarti webhook belum terkonfigurasi pada instance tersebut.

Jalankan kembali:

``` powershell
curl.exe -X POST "http://localhost:8080/webhook/set/pkl-collection" `
    -H "Content-Type: application/json" `
    -H "apikey: $EVOLUTION_API_KEY" `
    --data-binary "@webhook.json"
```

------------------------------------------------------------------------

## C. Error `instance requires property "webhook"`

Pastikan struktur `webhook.json` memiliki wrapper:

``` json
{
  "webhook": {
    ...
  }
}
```

Bukan:

``` json
{
  "enabled": true,
  "url": "...",
  "events": []
}
```

------------------------------------------------------------------------

## D. `webhookBase64` tetap `false`

Pastikan `webhook.json`:

``` json
"webhookBase64": true
```

Kemudian jalankan POST konfigurasi ulang:

``` powershell
curl.exe -X POST "http://localhost:8080/webhook/set/pkl-collection" `
    -H "Content-Type: application/json" `
    -H "apikey: $EVOLUTION_API_KEY" `
    --data-binary "@webhook.json"
```

Verifikasi:

``` powershell
curl.exe -X GET "http://localhost:8080/webhook/find/pkl-collection" `
    -H "apikey: $EVOLUTION_API_KEY"
```

------------------------------------------------------------------------

## E. Foto terdeteksi tetapi tidak masuk Google Drive

Periksa:

1.  `DRIVE_FOLDER_ID` benar.
2.  Yang dimasukkan adalah **Folder ID**, bukan URL lengkap.
3.  Google Apps Script memiliki permission Google Drive.
4.  Payload Evolution API benar-benar menyediakan media/Base64.
5.  Fungsi penyimpanan attachment dipanggil dari `doPost()`.
6.  MIME type dan data Base64 berhasil dibaca.
7.  Periksa `Executions` pada Apps Script.

Contoh Folder ID:

``` text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      Folder ID
```

------------------------------------------------------------------------

## F. Google Apps Script tidak memiliki execution log

Pastikan request benar-benar sampai ke Web App.

Periksa:

``` text
Apps Script
→ Executions
```

Kemudian periksa log Evolution API:

``` powershell
docker logs -f evolution_api
```

Cari:

``` text
WebhookController
messages.upsert
destination
```

Jika Evolution API menunjukkan destination webhook tetapi Apps Script
tidak menunjukkan execution, periksa URL deployment dan akses Web App.

------------------------------------------------------------------------
