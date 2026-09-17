/**
 * ============================================================
 * BOT WHATSAPP -> GOOGLE SHEETS
 * COLLECTION VISIT REPORT
 * ============================================================
 *
 * Integration:
 * - Fonnte WhatsApp API
 * - Google Apps Script
 * - Groq AI
 * - Google Sheets
 *
 * SUPPORT:
 * - WhatsApp Personal
 * - WhatsApp Group
 * - Text message
 * - Image + caption
 * - Attachment + caption
 *
 * IMPORTANT:
 * - Attachment TIDAK diproses oleh Groq.
 * - Hanya message/caption yang diproses.
 * - Jika foto tidak memiliki caption/text -> diabaikan.
 * - Jika foto memiliki caption/text -> caption diproses.
 * ============================================================
 */

const CONFIG = {

  // ==========================================================
  // EVOLUTION API
  // ==========================================================

  EVOLUTION_API_URL:
    'YOUR_URL_FROM_CLOUDFLARETUNNEL',

  EVOLUTION_API_KEY:
    'YOUR_API_KEY',

  EVOLUTION_INSTANCE:
    'pkl-collection',


  // ==========================================================
  // GROQ
  // ==========================================================

  GROQ_API_KEY:
    'YOUR_AI_KEY',

  GROQ_MODEL:
    'YOUR_AI_MODEL_NAME',


  // ==========================================================
  // GOOGLE SHEETS
  // ==========================================================

  SHEET_NAME:
    'YOUR_GOOGLE_sHEETS_NAME',


  // ==========================================================
  // GOOGLE DRIVE
  // ==========================================================

  DRIVE_FOLDER_ID:
    'YOUR_GOOGLE_DRIVE_FOLDER_ID',


  // ==========================================================
  // SYSTEM
  // ==========================================================

  TIME_ZONE:
    'Asia/Jakarta',


  // ==========================================================
  // API URL
  // ==========================================================

  GROQ_API_URL:
    'YOUR_AI_URL',


  // ==========================================================
  // WEBHOOK
  // ==========================================================

  CACHE_EXPIRATION_SECONDS:
    120

};


/**
 * ============================================================
 * WEBHOOK POST - EVOLUTION API
 * ============================================================
 */
function doPost(e) {

  try {

    console.log(
      '================================================'
    );

    console.log(
      'EVOLUTION WEBHOOK START'
    );

    console.log(
      '================================================'
    );


    // ========================================================
    // 1. GET PAYLOAD
    // ========================================================

    const payload =
      getWebhookPayload(e);


    console.log(
      'FULL PAYLOAD: ' +
      JSON.stringify(
        payload
      )
    );


    // ========================================================
    // 2. FILTER EVENT
    // ========================================================

    const event =
      String(
        payload.event || ''
      ).toUpperCase();


    if (
      event &&
      event !== 'MESSAGES_UPSERT' &&
      event !== 'MESSAGES.UPSERT'
    ) {

      console.log(
        'EVENT IGNORED: ' +
        event
      );

      return jsonResponse({

        success:
          true,

        ignored:
          'event_' + event

      });

    }


    // ========================================================
    // 3. IGNORE MESSAGE SENT BY BOT ITSELF
    // ========================================================

    if (
      payload.data &&
      payload.data.key &&
      payload.data.key.fromMe === true
    ) {

      console.log(
        'MESSAGE FROM BOT - IGNORED'
      );

      return jsonResponse({

        success:
          true,

        ignored:
          'from_me'

      });

    }


    // ========================================================
    // 4. EXTRACT
    // ========================================================

    const message =
      extractMessageText(
        payload
      );


    const attachmentInfo =
      getAttachmentInfo(
        payload
      );


    const chatInfo =
      getChatInfo(
        payload
      );


    console.log(
      'MESSAGE: ' +
      message
    );


    console.log(
      'ATTACHMENT: ' +
      JSON.stringify(
        attachmentInfo
      )
    );


    console.log(
      'CHAT: ' +
      JSON.stringify(
        chatInfo
      )
    );


    // ========================================================
    // 5. DUPLICATE CHECK
    // ========================================================

    if (
      isDuplicateWebhook(
        payload,
        message,
        attachmentInfo
      )
    ) {

      console.log(
        'DUPLICATE WEBHOOK'
      );

      return jsonResponse({

        success:
          true,

        duplicate:
          true

      });

    }


    // ========================================================
    // 6. SAVE ATTACHMENT
    //
    // Foto/file disimpan terlebih dahulu.
    //
    // TIDAK dikirim ke Groq.
    // ========================================================

    let attachmentFile = null;


    if (
      attachmentInfo.hasAttachment
    ) {

      console.log(
        'ATTACHMENT DETECTED'
      );


      try {

        attachmentFile =
          saveAttachmentToDrive(
            payload,
            attachmentInfo
          );


      } catch (attachmentError) {

        console.error(
          'ATTACHMENT SAVE ERROR: ' +
          attachmentError.message
        );

        // Jangan langsung menghentikan proses.
        // Caption masih bisa diproses oleh Groq.

        attachmentFile = {

          saved:
            false,

          fileId:
            '',

          url:
            '',

          error:
            attachmentError.message

        };

      }

    }


    // ========================================================
    // 7. NO TEXT
    //
    // Foto tanpa caption:
    // tetap disimpan ke Drive,
    // tetapi tidak diproses Groq.
    // ========================================================

    if (!message) {

      console.log(
        'NO TEXT/CAPTION'
      );


      return jsonResponse({

        success:
          true,

        ignored:
          'no_text_or_caption',

        attachment_saved:
          attachmentFile
            ? attachmentFile.saved
            : false

      });

    }


    // ========================================================
    // 8. GROQ
    //
    // HANYA TEXT/CAPTION.
    //
    // FILE TIDAK DIKIRIM.
    // ========================================================

    console.log(
      'SEND TEXT/CAPTION TO GROQ'
    );


    const report =
      analyzeVisitReportWithGroq(
        message
      );


    console.log(
      'GROQ RESULT: ' +
      JSON.stringify(
        report
      )
    );


    // ========================================================
    // 9. NOT VISIT REPORT
    // ========================================================

    if (
      !report.is_report
    ) {

      console.log(
        'MESSAGE IS NOT VISIT REPORT'
      );


      return jsonResponse({

        success:
          true,

        ignored:
          'not_visit_report',

        attachment_saved:
          attachmentFile
            ? attachmentFile.saved
            : false

      });

    }


    // ========================================================
    // 10. SAVE REPORT
    // ========================================================

    const id =
      saveVisitReport(

        report,

        message,

        chatInfo,

        attachmentInfo,

        attachmentFile

      );


    console.log(
      'REPORT SAVED: ' +
      id
    );


    // ========================================================
    // 11. CREATE REPLY
    // ========================================================

    const reply =

      '✅ *LAPORAN VISIT BERHASIL DISIMPAN*\n' +

      '━━━━━━━━━━━━━━━━━━\n' +

      '🆔 ID Report: ' +
      id +
      '\n' +

      '👤 Nama: ' +
      safeText(
        report.nama_konsumen
      ) +
      '\n' +

      '📄 Kontrak: ' +
      safeText(
        report.no_kontrak
      ) +
      '\n' +

      '⚠️ Past Due: ' +
      safeText(
        report.past_due
      ) +
      '\n' +

      '🏷️ Kategori: ' +
      safeText(
        report.case_kategory
      ) +
      '\n' +

      '📝 Keterangan: ' +
      safeText(
        report.keterangan
      );


    // ========================================================
    // 12. SEND REPLY
    // ========================================================

    sendWhatsAppMessage(

      chatInfo.chatTarget,

      reply

    );


    console.log(
      'REPLY SENT TO: ' +
      chatInfo.chatTarget
    );


    // ========================================================
    // 13. RESPONSE
    // ========================================================

    return jsonResponse({

      success:
        true,

      id:
        id,

      chat_type:
        chatInfo.chatType,

      target:
        chatInfo.chatTarget,

      member:
        chatInfo.member,

      has_attachment:
        attachmentInfo.hasAttachment,

      attachment_saved:
        attachmentFile
          ? attachmentFile.saved
          : false

    });


  } catch (error) {


    console.error(
      '================================================'
    );

    console.error(
      'WEBHOOK ERROR'
    );

    console.error(
      error.message
    );

    console.error(
      error.stack || ''
    );

    console.error(
      '================================================'
    );


    return jsonResponse({

      success:
        false,

      error:
        error.message

    });

  }

}


/**
 * ============================================================
 * GET
 * ============================================================
 */
function doGet() {

  return ContentService

    .createTextOutput(
      'Bot WhatsApp -> Laporan Visit Collection aktif.'
    )

    .setMimeType(
      ContentService.MimeType.TEXT
    );
}


/**
 * ============================================================
 * GET WEBHOOK PAYLOAD
 * ============================================================
 *
 * Mendukung:
 * - application/json
 * - form-urlencoded
 * - parameter webhook
 * ============================================================
 */
function getWebhookPayload(e) {

  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {

    return {};

  }


  const raw =
    e.postData.contents;


  console.log(
    'CONTENT TYPE: ' +
    e.postData.type
  );


  console.log(
    'RAW CONTENTS: ' +
    raw
  );


  try {

    const payload =
      JSON.parse(
        raw
      );


    return payload;


  } catch (error) {

    console.error(
      'Webhook body bukan JSON: ' +
      error.message
    );


    return {};

  }

}


/**
 * ============================================================
 * CHAT INFORMATION
 * ============================================================
 *
 * SUPPORT:
 * - WhatsApp Personal
 * - WhatsApp Group
 *
 * PERSONAL:
 * sender = nomor pengirim
 *
 * GROUP:
 * sender = group ID
 * member = nomor anggota yang mengirim
 *
 * PERSONAL:
 * data.key.remoteJid
 *
 * GROUP:
 * data.key.remoteJid = group ID
 * data.key.participant = member/pengirim
 * ============================================================
 */
function getChatInfo(payload) {

  let remoteJid = '';
  let participant = '';

  // ==========================================================
  // EVOLUTION API
  // ==========================================================

  if (
    payload.data &&
    typeof payload.data === 'object'
  ) {

    const data =
      payload.data;

    if (
      data.key &&
      typeof data.key === 'object'
    ) {

      remoteJid =
        data.key.remoteJid || '';

      participant =
        data.key.participant || '';

    }

  }

  // ==========================================================
  // FALLBACK
  // ==========================================================

  if (!remoteJid) {

    remoteJid =
      firstPayloadValue(
        payload,
        [
          'remoteJid',
          'sender',
          'from',
          'phone'
        ]
      );

  }

  if (!participant) {

    participant =
      firstPayloadValue(
        payload,
        [
          'participant',
          'member',
          'author'
        ]
      );

  }

  remoteJid =
    String(
      remoteJid || ''
    ).trim();

  participant =
    String(
      participant || ''
    ).trim();


  // ==========================================================
  // DETEKSI GROUP
  // ==========================================================

  const isGroup =
    remoteJid
      .toLowerCase()
      .indexOf('@g.us') !== -1;


  // ==========================================================
  // GROUP
  // ==========================================================

  if (isGroup) {

    const staffNumber =
      normalizePhoneNumber(
        participant
      );

    return {

      chatType:
        'GROUP',

      chatTarget:
        remoteJid,

      groupId:
        remoteJid,

      member:
        staffNumber,

      rawSender:
        remoteJid,

      rawMember:
        participant

    };

  }


  // ==========================================================
  // PERSONAL
  // ==========================================================

  const personalNumber =
    normalizePhoneNumber(
      remoteJid
    );

  return {

    chatType:
      'PERSONAL',

    chatTarget:
      personalNumber,

    groupId:
      '',

    member:
      personalNumber,

    rawSender:
      remoteJid,

    rawMember:
      participant

  };

}


/**
 * ============================================================
 * EXTRACT MESSAGE TEXT
 * ============================================================
 *
 * PRIORITAS:
 *
 * message
 * text
 * body
 * caption
 *
 * ATTACHMENT:
 * url / filename / extension TIDAK DIPROSES.
 *
 * Jika:
 *
 * 📷 foto + caption
 *
 * maka hanya caption/message yang dikirim ke Groq.
 *
 * Jika:
 *
 * 📷 foto tanpa caption
 *
 * maka kosong -> ignore.
 * ============================================================
 */

/**
 * ============================================================
 * EXTRACT MESSAGE / CAPTION
 * ============================================================
 *
 * Tujuan:
 * - Text biasa -> diproses
 * - Foto + caption -> caption diproses
 * - Foto tanpa caption -> diabaikan
 * - File + caption -> caption diproses
 *
 * EVOLUTION API
 *
 * TEXT:
 * data.message.conversation
 *
 * IMAGE:
 * data.message.imageMessage.caption
 *
 * DOCUMENT:
 * data.message.documentMessage.caption
 *
 * MEDIA TIDAK DIKIRIM KE GROQ.
 * HANYA TEXT/CAPTION.
 * ============================================================
 */
function extractMessageText(payload) {

  console.log(
    '========== EXTRACT EVOLUTION MESSAGE =========='
  );

  if (
    !payload.data ||
    typeof payload.data !== 'object'
  ) {

    return '';

  }

  const data =
    payload.data;

  const message =
    data.message;

  if (
    !message ||
    typeof message !== 'object'
  ) {

    return '';

  }


  // ==========================================================
  // TEXT BIASA
  // ==========================================================

  if (
    message.conversation
  ) {

    return String(
      message.conversation
    ).trim();

  }


  // ==========================================================
  // EXTENDED TEXT
  // ==========================================================

  if (
    message.extendedTextMessage &&
    message.extendedTextMessage.text
  ) {

    return String(
      message.extendedTextMessage.text
    ).trim();

  }


  // ==========================================================
  // IMAGE + CAPTION
  // ==========================================================

  if (
    message.imageMessage &&
    message.imageMessage.caption
  ) {

    return String(
      message.imageMessage.caption
    ).trim();

  }


  // ==========================================================
  // DOCUMENT + CAPTION
  // ==========================================================

  if (
    message.documentMessage &&
    message.documentMessage.caption
  ) {

    return String(
      message.documentMessage.caption
    ).trim();

  }


  // ==========================================================
  // VIDEO + CAPTION
  // ==========================================================

  if (
    message.videoMessage &&
    message.videoMessage.caption
  ) {

    return String(
      message.videoMessage.caption
    ).trim();

  }


  // ==========================================================
  // AUDIO
  //
  // Tidak diproses karena tidak ada text.
  // ==========================================================

  return '';

}


/**
 * ============================================================
 * ATTACHMENT INFO
 * ============================================================
 *
 * HANYA untuk logging/status.
 *
 * TIDAK dikirim ke Groq.
 * TIDAK disimpan sebagai URL attachment.
 * ============================================================
 */
/**
 * ============================================================
 * ATTACHMENT INFO - EVOLUTION API
 * ============================================================
 */
function getAttachmentInfo(payload) {

  const result = {

    hasAttachment:
      false,

    type:
      '',

    filename:
      '',

    mimetype:
      '',

    messageId:
      '',

    caption:
      ''

  };


  if (
    !payload.data ||
    typeof payload.data !== 'object'
  ) {

    return result;

  }


  const data =
    payload.data;


  // ==========================================================
  // MESSAGE ID
  // ==========================================================

  if (
    data.key &&
    data.key.id
  ) {

    result.messageId =
      String(
        data.key.id
      );

  }


  // ==========================================================
  // IMAGE
  // ==========================================================

  if (
    data.message &&
    data.message.imageMessage
  ) {

    const image =
      data.message.imageMessage;

    result.hasAttachment =
      true;

    result.type =
      'image';

    result.mimetype =
      image.mimetype || '';

    result.caption =
      image.caption || '';

    result.filename =
      image.fileName || '';

    return result;

  }


  // ==========================================================
  // DOCUMENT
  // ==========================================================

  if (
    data.message &&
    data.message.documentMessage
  ) {

    const document =
      data.message.documentMessage;

    result.hasAttachment =
      true;

    result.type =
      'document';

    result.mimetype =
      document.mimetype || '';

    result.caption =
      document.caption || '';

    result.filename =
      document.fileName || '';

    return result;

  }


  // ==========================================================
  // VIDEO
  // ==========================================================

  if (
    data.message &&
    data.message.videoMessage
  ) {

    const video =
      data.message.videoMessage;

    result.hasAttachment =
      true;

    result.type =
      'video';

    result.mimetype =
      video.mimetype || '';

    result.caption =
      video.caption || '';

    return result;

  }


  // ==========================================================
  // AUDIO
  // ==========================================================

  if (
    data.message &&
    data.message.audioMessage
  ) {

    const audio =
      data.message.audioMessage;

    result.hasAttachment =
      true;

    result.type =
      'audio';

    result.mimetype =
      audio.mimetype || '';

    return result;

  }


  return result;

}

/**
 * ============================================================
 * GET MEDIA FROM EVOLUTION API
 * ============================================================
 *
 * Mengambil attachment dari Evolution API sebagai Base64.
 *
 * Attachment:
 * - image
 * - document
 * - video
 * - audio
 *
 * File TIDAK dikirim ke Groq.
 * ============================================================
 */
function getMediaFromEvolution(payload) {

  if (
    !payload.data ||
    !payload.data.key ||
    !payload.data.key.id
  ) {

    throw new Error(
      'Message key / message ID tidak ditemukan.'
    );
  }

  const data =
    payload.data;

  const key =
    data.key;

  const messageId =
    key.id;

  console.log(
    'GET MEDIA MESSAGE ID: ' +
    messageId
  );

  // ==========================================================
  // URL
  // ==========================================================

  const url =
    CONFIG.EVOLUTION_API_URL.replace(/\/$/, '') +
    '/chat/getBase64FromMediaMessage/' +
    encodeURIComponent(
      CONFIG.EVOLUTION_INSTANCE
    );

  console.log(
    'GET MEDIA URL: ' +
    url
  );

  // ==========================================================
  // REQUEST BODY
  // ==========================================================

  const requestBody = {

    message: {

      key: {

        id:
          key.id,

        remoteJid:
          key.remoteJid || '',

        fromMe:
          key.fromMe === true

      }

    },

    convertToMp4:
      false

  };

  console.log(
    'GET MEDIA REQUEST: ' +
    JSON.stringify(
      requestBody
    )
  );

  // ==========================================================
  // CALL EVOLUTION API
  // ==========================================================

  const response =
    UrlFetchApp.fetch(
      url,
      {

        method:
          'post',

        contentType:
          'application/json',

        headers: {

          apikey:
            CONFIG.EVOLUTION_API_KEY

        },

        payload:
          JSON.stringify(
            requestBody
          ),

        muteHttpExceptions:
          true

      }
    );

  const status =
    response.getResponseCode();

  const body =
    response.getContentText();

  console.log(
    'GET MEDIA STATUS: ' +
    status
  );

  console.log(
    'GET MEDIA RESPONSE: ' +
    body.substring(
      0,
      500
    )
  );

  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    status < 200 ||
    status >= 300
  ) {

    throw new Error(

      'Evolution API gagal mengambil media. ' +

      'HTTP ' +
      status +
      ': ' +
      body

    );
  }

  // ==========================================================
  // PARSE RESPONSE
  // ==========================================================

  let result;

  try {

    result =
      JSON.parse(
        body
      );

  } catch (error) {

    throw new Error(
      'Response getBase64FromMediaMessage bukan JSON valid: ' +
      body
    );
  }

  // ==========================================================
  // LOG RESPONSE STRUCTURE
  // ==========================================================

  console.log(
    'MEDIA RESPONSE KEYS: ' +
    Object.keys(
      result || {}
    ).join(', ')
  );

  return result;
}

/**
 * ============================================================
 * SAVE ATTACHMENT TO GOOGLE DRIVE
 * ============================================================
 */
function saveAttachmentToDrive(
  payload,
  attachmentInfo
) {

  console.log(
    '========== SAVE ATTACHMENT =========='
  );

  // ==========================================================
  // 1. VALIDASI
  // ==========================================================

  if (
    !attachmentInfo ||
    !attachmentInfo.hasAttachment
  ) {

    console.log(
      'Tidak ada attachment.'
    );

    return {

      saved:
        false,

      fileId:
        '',

      url:
        ''

    };
  }

  if (
    !CONFIG.DRIVE_FOLDER_ID
  ) {

    throw new Error(
      'DRIVE_FOLDER_ID belum diisi.'
    );
  }

  // ==========================================================
  // 2. AMBIL FOLDER
  // ==========================================================

  console.log(
    'DRIVE FOLDER ID: ' +
    CONFIG.DRIVE_FOLDER_ID
  );

  let folder;

  try {

    folder =
      DriveApp.getFolderById(
        CONFIG.DRIVE_FOLDER_ID
      );

  } catch (error) {

    throw new Error(
      'Folder Google Drive tidak dapat diakses: ' +
      error.message
    );
  }

  console.log(
    'DRIVE FOLDER: ' +
    folder.getName()
  );

  // ==========================================================
  // 3. AMBIL BASE64 DARI EVOLUTION
  // ==========================================================

  const media =
    getMediaFromEvolution(
      payload
    );

  console.log(
    'MEDIA RESPONSE BERHASIL DITERIMA.'
  );

  // ==========================================================
  // 4. CARI BASE64
  // ==========================================================

  const base64 =
    media.base64 ||
    (
      media.response &&
      media.response.base64
    ) ||
    (
      media.data &&
      media.data.base64
    ) ||
    '';

  if (!base64) {

    console.error(
      'MEDIA RESPONSE FULL: ' +
      JSON.stringify(
        media
      ).substring(
        0,
        3000
      )
    );

    throw new Error(
      'Base64 media tidak ditemukan dalam response Evolution API.'
    );
  }

  console.log(
    'BASE64 DITERIMA. LENGTH: ' +
    base64.length
  );

  // ==========================================================
  // 5. MIME TYPE
  // ==========================================================

  const mimeType =
    media.mimetype ||
    media.mimeType ||
    attachmentInfo.mimetype ||
    'application/octet-stream';

  console.log(
    'MIME TYPE: ' +
    mimeType
  );

  // ==========================================================
  // 6. FILE NAME
  // ==========================================================

  let fileName =
    attachmentInfo.filename;

  if (!fileName) {

    const extension =
      getExtensionFromMimeType(
        mimeType
      );

    fileName =
      'WA_' +
      attachmentInfo.messageId +
      (
        extension
          ? '.' + extension
          : ''
      );
  }

  console.log(
    'FILE NAME: ' +
    fileName
  );

  // ==========================================================
  // 7. BASE64 -> BYTES
  // ==========================================================

  let bytes;

  try {

    bytes =
      Utilities.base64Decode(
        base64
      );

  } catch (error) {

    throw new Error(
      'Gagal decode Base64 media: ' +
      error.message
    );
  }

  console.log(
    'DECODED BYTES: ' +
    bytes.length
  );

  // ==========================================================
  // 8. BYTES -> BLOB
  // ==========================================================

  const blob =
    Utilities.newBlob(
      bytes,
      mimeType,
      fileName
    );

  console.log(
    'BLOB BERHASIL DIBUAT.'
  );

  // ==========================================================
  // 9. GOOGLE DRIVE
  // ==========================================================

  let file;

  try {

    file =
      folder.createFile(
        blob
      );

  } catch (error) {

    throw new Error(
      'Gagal membuat file di Google Drive: ' +
      error.message
    );
  }

  // ==========================================================
  // 10. HASIL
  // ==========================================================

  const fileId =
    file.getId();

  const fileUrl =
    file.getUrl();

  console.log(
    '================================================'
  );

  console.log(
    'ATTACHMENT BERHASIL DISIMPAN'
  );

  console.log(
    'FILE NAME: ' +
    file.getName()
  );

  console.log(
    'FILE ID: ' +
    fileId
  );

  console.log(
    'FILE URL: ' +
    fileUrl
  );

  console.log(
    '================================================'
  );

  return {

    saved:
      true,

    fileId:
      fileId,

    url:
      fileUrl,

    fileName:
      file.getName(),

    mimeType:
      mimeType

  };
}

function getExtensionFromMimeType(
  mimeType
) {

  const map = {

    'image/jpeg':
      'jpg',

    'image/png':
      'png',

    'image/webp':
      'webp',

    'application/pdf':
      'pdf',

    'video/mp4':
      'mp4',

    'audio/ogg':
      'ogg',

    'audio/mpeg':
      'mp3'

  };

  return (
    map[mimeType] ||
    ''
  );

}

function updateSheetHeaders() {

  const sheet =
    getOrCreateSheet();

  const headers =
    getHeaders();

  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ]);

  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setFontWeight(
      'bold'
    );

  sheet.setFrozenRows(1);

  console.log(
    'Sheet headers berhasil diperbarui.'
  );

}

/**
 * ============================================================
 * FIRST PAYLOAD VALUE
 * ============================================================
 */
function firstPayloadValue(
  payload,
  keys
) {

  for (
    let i = 0;
    i < keys.length;
    i++
  ) {

    const key =
      keys[i];

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        key
      ) &&
      payload[key] !== null &&
      payload[key] !== undefined &&
      payload[key] !== ''
    ) {

      return payload[key];
    }
  }

  return '';
}


/**
 * ============================================================
 * NORMALIZE PHONE
 * ============================================================
 */
function normalizePhoneNumber(phone) {

  return String(phone || '')
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace(/[^\d]/g, '');

}


/**
 * ============================================================
 * DUPLICATE WEBHOOK
 * ============================================================
 *
 * PRIORITAS ID:
 *
 * id
 * message_id
 * messageId
 * msg_id
 * wamid
 * inboxid
 *
 * Jika ID tidak ada:
 * gunakan kombinasi:
 *
 * sender
 * member
 * message
 * timestamp
 * ============================================================
 */
function isDuplicateWebhook(
  payload,
  message,
  attachmentInfo
) {

  const cache =
    CacheService.getScriptCache();


  let explicitId = '';


  // ==========================================================
  // EVOLUTION MESSAGE ID
  // ==========================================================

  if (
    payload.data &&
    payload.data.key &&
    payload.data.key.id
  ) {

    explicitId =
      payload.data.key.id;

  }


  // ==========================================================
  // FALLBACK
  // ==========================================================

  if (!explicitId) {

    explicitId =
      firstPayloadValue(
        payload,
        [
          'id',
          'message_id',
          'messageId'
        ]
      );

  }


  let source;


  if (explicitId) {

    source =
      'EVOLUTION_ID|' +
      String(
        explicitId
      );

  } else {

    const chatInfo =
      getChatInfo(
        payload
      );

    source =
      'FALLBACK|' +
      chatInfo.chatTarget +
      '|' +
      chatInfo.member +
      '|' +
      String(
        message || ''
      ) +
      '|' +
      String(
        attachmentInfo.messageId || ''
      );

  }


  const digest =
    Utilities.computeDigest(

      Utilities.DigestAlgorithm.SHA_256,

      source

    );


  const fingerprint =
    'WEBHOOK_' +
    Utilities.base64EncodeWebSafe(
      digest
    );


  console.log(
    'DUPLICATE FINGERPRINT: ' +
    fingerprint
  );


  if (
    cache.get(
      fingerprint
    )
  ) {

    return true;

  }


  cache.put(

    fingerprint,

    '1',

    CONFIG.CACHE_EXPIRATION_SECONDS

  );


  return false;

}

/**
 * ============================================================
 * GROQ AI
 * ============================================================
 */
function analyzeVisitReportWithGroq(message) {

  if (
    !CONFIG.GROQ_API_KEY ||
    CONFIG.GROQ_API_KEY ===
    'MASUKKAN_API_KEY_GROQ'
  ) {

    throw new Error(
      'GROQ_API_KEY belum diisi.'
    );
  }

  const today =
    Utilities.formatDate(
      new Date(),
      CONFIG.TIME_ZONE,
      'yyyy-MM-dd'
    );

  // ----------------------------------------------------------
  // SYSTEM PROMPT
  // ----------------------------------------------------------

  const systemPrompt =

  'Kamu adalah "Collection Visit Report Data Extraction Assistant".\n' +

  'Tugasmu membaca pesan WhatsApp dari staff Collection dan mengubahnya menjadi JSON terstruktur.\n' +

  'Tanggal hari ini: ' +
  today +
  '.\n\n' +

  'Balas HANYA JSON valid tanpa markdown atau teks tambahan apapun.\n\n' +

  'ATURAN UMUM:\n' +

  '1. WAJIB isi "is_report": true jika pesan mengandung informasi laporan visit, termasuk jika terdapat label seperti "Nama", "Kontrak", "Past Due", "Alamat", atau keterangan hasil kunjungan.\n' +

  '2. Jika pesan tidak berisi laporan visit, isi "is_report": false.\n' +

  '3. Jangan pernah mengarang data.\n' +

  '4. Jika informasi tidak tersedia, gunakan string kosong "".\n' +

  '5. Pertahankan data persis seperti yang diberikan staff jika memungkinkan.\n' +

  '6. Nomor kontrak harus diperlakukan sebagai STRING agar tidak berubah format.\n' +

  '7. Past Due harus diperlakukan sebagai STRING.\n' +

  '8. Baris tanpa label di awal pesan dapat berisi informasi Product dan SCG. Ekstrak jika informasinya dapat dikenali dengan jelas.\n\n' +

  'ATURAN CASE_KATEGORY:\n\n' +

  'Field "case_kategory" WAJIB berisi tepat salah satu dari 5 nilai berikut:\n\n' +

  '1. "Konsumen Ada Unit Ada"\n' +
  '   Gunakan jika staff berhasil bertemu/menemukan konsumen DAN unit/kendaraan juga ditemukan atau tersedia.\n\n' +

  '2. "Konsumen Ada Unit Tidak Ada"\n' +
  '   Gunakan jika staff berhasil bertemu/menemukan konsumen TETAPI unit/kendaraan tidak ditemukan, tidak berada di lokasi, atau tidak tersedia.\n\n' +

  '3. "Konsumen Tidak Ada Unit Ada"\n' +
  '   Gunakan jika staff TIDAK berhasil bertemu/menemukan konsumen TETAPI unit/kendaraan ditemukan atau tersedia.\n\n' +

  '4. "Konsumen Tidak Ada Unit Tidak Ada"\n' +
  '   Gunakan jika staff TIDAK berhasil bertemu/menemukan konsumen DAN unit/kendaraan juga tidak ditemukan atau tidak tersedia.\n\n' +

  '5. "Belum Diketahui"\n' +
  '   Gunakan jika informasi tentang keberadaan konsumen dan unit tidak cukup untuk menentukan salah satu dari empat kategori di atas.\n\n' +

  'ATURAN PENTING CASE_KATEGORY:\n' +

  '- Jangan membuat nama kategori baru.\n' +
  '- Jangan menggunakan kategori selain 5 nilai yang diberikan.\n' +
  '- Jangan menggunakan "Other".\n' +
  '- Jangan menyimpulkan konsumen atau unit ditemukan jika informasi tersebut tidak tersedia.\n' +
  '- Jika ragu atau informasinya tidak cukup, gunakan "Belum Diketahui".\n\n' +

  'CONTOH KLASIFIKASI:\n\n' +

  'Contoh 1:\n' +
  'Staff bertemu langsung dengan konsumen dan unit motor ada di rumah.\n' +
  '=> case_kategory = "Konsumen Ada Unit Ada"\n\n' +

  'Contoh 2:\n' +
  'Staff bertemu konsumen tetapi unit dibawa oleh orang lain dan tidak ada di rumah.\n' +
  '=> case_kategory = "Konsumen Ada Unit Tidak Ada"\n\n' +

  'Contoh 3:\n' +
  'Konsumen tidak ada di rumah tetapi unit motor ditemukan di rumah.\n' +
  '=> case_kategory = "Konsumen Tidak Ada Unit Ada"\n\n' +

  'Contoh 4:\n' +
  'Konsumen tidak ada dan unit juga tidak ditemukan.\n' +
  '=> case_kategory = "Konsumen Tidak Ada Unit Tidak Ada"\n\n' +

  'Contoh 5:\n' +
  'Pesan hanya menyebutkan "sudah visit" tanpa menjelaskan apakah konsumen dan unit ditemukan.\n' +
  '=> case_kategory = "Belum Diketahui"\n\n' +

  'FORMAT JSON:\n' +

  '{\n' +

  '  "is_report": true,\n' +

  '  "scg": "Malang",\n' +

  '  "nama_konsumen": "Ahmad Bahrul Alam",\n' +

  '  "no_kontrak": "4662502863",\n' +

  '  "past_due": "29",\n' +

  '  "product": "Motor",\n' +

  '  "alamat_visit": "Rumah",\n' +

  '  "case_kategory": "Konsumen Ada Unit Ada",\n' +

  '  "keterangan": "Bertemu langsung dengan konsumen dan unit motor ada di rumah.",\n' +

  '  "rencana_penyelesaian": "Pembayaran angsuran",\n' +

  '  "tanggal_visit": "' +
  today +
  '"\n' +

  '}';

  // ----------------------------------------------------------
  // REQUEST
  // ----------------------------------------------------------

  const requestBody = {

    model:
      CONFIG.GROQ_MODEL,

    messages: [

      {
        role: 'system',
        content: systemPrompt
      },

      {
        role: 'user',

        // PENTING:
        // HANYA TEXT.
        // Tidak ada URL gambar.
        // Tidak ada attachment.
        content: message
      }

    ],

    temperature: 0.1,

    max_tokens: 800,

    response_format: {
      type: 'json_object'
    }

  };

  // ----------------------------------------------------------
  // CALL GROQ
  // ----------------------------------------------------------

  const response =
    UrlFetchApp.fetch(
      CONFIG.GROQ_API_URL,
      {

        method: 'post',

        contentType:
          'application/json',

        headers: {

          Authorization:
            'Bearer ' +
            CONFIG.GROQ_API_KEY

        },

        payload:
          JSON.stringify(
            requestBody
          ),

        muteHttpExceptions:
          true

      }
    );

  const status =
    response.getResponseCode();

  const text =
    response.getContentText();

  if (
    status < 200 ||
    status >= 300
  ) {

    throw new Error(
      'Groq API error ' +
      status +
      ': ' +
      text
    );
  }

  const outer =
    JSON.parse(text);

  if (
    !outer.choices ||
    !outer.choices[0] ||
    !outer.choices[0].message
  ) {

    throw new Error(
      'Respons Groq tidak valid.'
    );
  }

  const content =
    outer
      .choices[0]
      .message
      .content;

  const reportData =
    JSON.parse(
      extractJson(content)
    );

  return normalizeReport(
    reportData
  );
}


/**
 * ============================================================
 * EXTRACT JSON
 * ============================================================
 */
function extractJson(text) {

  const raw =
    String(text || '').trim();

  const first =
    raw.indexOf('{');

  const last =
    raw.lastIndexOf('}');

  if (
    first === -1 ||
    last === -1 ||
    last < first
  ) {

    throw new Error(
      'JSON tidak ditemukan dalam respons Groq.'
    );
  }

  return raw.substring(
    first,
    last + 1
  );
}


/**
 * ============================================================
 * VALID CASE CATEGORY
 * ============================================================
 */
const VALID_CASE_CATEGORIES = [
  'Konsumen Ada Unit Ada',
  'Konsumen Ada Unit Tidak Ada',
  'Konsumen Tidak Ada Unit Ada',
  'Konsumen Tidak Ada Unit Tidak Ada',
  'Belum Diketahui'
];


/**
 * ============================================================
 * NORMALIZE REPORT
 * ============================================================
 */
function normalizeReport(report) {

  const isReport =
    report &&
    (
      report.is_report === true ||
      String(
        report.is_report
      ).toLowerCase() === 'true'
    );

  // ----------------------------------------------------------
  // Bukan laporan visit
  // ----------------------------------------------------------

  if (!isReport) {

    return {
      is_report: false
    };
  }

  // ----------------------------------------------------------
  // Tanggal visit
  // ----------------------------------------------------------

  let date =
    String(
      report.tanggal_visit || ''
    ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {

    date =
      Utilities.formatDate(
        new Date(),
        CONFIG.TIME_ZONE,
        'yyyy-MM-dd'
      );
  }

  // ----------------------------------------------------------
  // Case Category
  // ----------------------------------------------------------

  let caseCategory =
    cleanValue(
      report.case_kategory
    );

  // ----------------------------------------------------------
  // Validasi category
  // ----------------------------------------------------------

  if (
    VALID_CASE_CATEGORIES.indexOf(
      caseCategory
    ) === -1
  ) {

    console.log(
      'INVALID CASE CATEGORY: ' +
      caseCategory +
      ' -> Belum Diketahui'
    );

    caseCategory =
      'Belum Diketahui';
  }

  // ----------------------------------------------------------
  // Return normalized report
  // ----------------------------------------------------------

  return {

    is_report: true,

    scg:
      cleanValue(
        report.scg
      ),

    nama_konsumen:
      cleanValue(
        report.nama_konsumen
      ),

    no_kontrak:
      cleanValue(
        report.no_kontrak
      ),

    past_due:
      cleanValue(
        report.past_due
      ),

    product:
      cleanValue(
        report.product
      ),

    alamat_visit:
      cleanValue(
        report.alamat_visit
      ),

    case_kategory:
      caseCategory,

    keterangan:
      cleanValue(
        report.keterangan
      ),

    rencana_penyelesaian:
      cleanValue(
        report.rencana_penyelesaian
      ),

    tanggal_visit:
      date

  };
}


/**
 * ============================================================
 * CLEAN VALUE
 * ============================================================
 */
function cleanValue(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';
  }

  return String(value).trim();
}


/**
 * ============================================================
 * SAFE TEXT
 * ============================================================
 */
function safeText(value) {

  const text =
    cleanValue(value);

  return text || '-';
}


/**
 * ============================================================
 * SHEET HEADERS
 * ============================================================
 */
function getHeaders() {

  return [

    'ID',

    'Timestamp',

    'Tanggal',

    'Jenis Chat',

    'Group ID',

    'SCG',

    'Nama Konsumen',

    'No Kontrak',

    'Past Due',

    'Nomor WhatsApp',

    'Product',

    'Alamat Visit',

    'Case kategory',

    'Keterangan',

    'Rencana penyelesaian',

    'Pesan Asli',

    'Ada Attachment',

    'Attachment Type',

    'Attachment Filename',

    'Attachment File ID',

    'Attachment URL'

  ];

}


/**
 * ============================================================
 * SETUP SHEET
 * ============================================================
 */
function setupSheet() {

  getOrCreateSheet();

  console.log(
    'Sheet Laporan Visit siap.'
  );
}


/**
 * ============================================================
 * GET OR CREATE SHEET
 * ============================================================
 */
function getOrCreateSheet() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      CONFIG.SHEET_NAME
    );

  if (!sheet) {

    sheet =
      ss.insertSheet(
        CONFIG.SHEET_NAME
      );
  }

  if (
    sheet.getLastRow() === 0
  ) {

    const headers =
      getHeaders();

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setFontWeight(
        'bold'
      );

    sheet.setFrozenRows(1);
  }

  return sheet;
}


/**
 * ============================================================
 * SAVE VISIT REPORT
 * ============================================================
 */
function saveVisitReport(
  report,
  originalMessage,
  chatInfo,
  attachmentInfo,
  attachmentFile
) {

  const sheet =
    getOrCreateSheet();

  const date =
    parseYmdDate(
      report.tanggal_visit
    );

  const id =
    generateReportId(
      date
    );


  const whatsappNumber =
    chatInfo.member || '';


  sheet.appendRow([

    id,

    new Date(),

    date,

    chatInfo.chatType,

    chatInfo.groupId,

    report.scg,

    report.nama_konsumen,

    report.no_kontrak,

    report.past_due,

    whatsappNumber,

    report.product,

    report.alamat_visit,

    report.case_kategory,

    report.keterangan,

    report.rencana_penyelesaian,

    originalMessage,

    attachmentInfo.hasAttachment
      ? 'YA'
      : 'TIDAK',

    attachmentInfo.type,

    attachmentFile
      ? attachmentFile.fileName || ''
      : '',

    attachmentFile
      ? attachmentFile.fileId || ''
      : '',

    attachmentFile
      ? attachmentFile.url || ''
      : ''

  ]);


  const row =
    sheet.getLastRow();


  sheet
    .getRange(row, 2)
    .setNumberFormat(
      'dd/MM/yyyy HH:mm:ss'
    );


  sheet
    .getRange(row, 3)
    .setNumberFormat(
      'dd/MM/yyyy'
    );


  return id;

}


/**
 * ============================================================
 * GENERATE REPORT ID
 * ============================================================
 */
function generateReportId(date) {

  const day =
    Utilities.formatDate(
      date,
      CONFIG.TIME_ZONE,
      'yyyyMMdd'
    );

  const random =
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  return (
    'VST-' +
    day +
    '-' +
    random
  );
}


/**
 * ============================================================
 * SEND WHATSAPP MESSAGE - EVOLUTION API
 * ============================================================
 *
 * Target dapat berupa:
 *
 * 1. Nomor WA
 *
 * 2. Group ID
 *    contoh:
 *    120363xxxxxxxx@g.us
 * ============================================================
 */

function sendWhatsAppMessage(target, message) {

  if (!CONFIG.EVOLUTION_API_URL) {
    throw new Error(
      'EVOLUTION_API_URL belum diisi.'
    );
  }

  if (!CONFIG.EVOLUTION_API_KEY) {
    throw new Error(
      'EVOLUTION_API_KEY belum diisi.'
    );
  }

  if (!CONFIG.EVOLUTION_INSTANCE) {
    throw new Error(
      'EVOLUTION_INSTANCE belum diisi.'
    );
  }

  if (!target) {
    throw new Error(
      'Target WhatsApp kosong.'
    );
  }

  const url =
    CONFIG.EVOLUTION_API_URL.replace(/\/$/, '') +
    '/message/sendText/' +
    encodeURIComponent(
      CONFIG.EVOLUTION_INSTANCE
    );

  const requestBody = {

    number:
      target,

    textMessage: {

      text:
        message

    },

    options: {

      delay:
        1200,

      presence:
        'composing'

    }

  };

  const response =
    UrlFetchApp.fetch(
      url,
      {

        method:
          'post',

        contentType:
          'application/json',

        headers: {

          apikey:
            CONFIG.EVOLUTION_API_KEY

        },

        payload:
          JSON.stringify(
            requestBody
          ),

        muteHttpExceptions:
          true

      }
    );

  const status =
    response.getResponseCode();

  const body =
    response.getContentText();

  console.log(
    'EVOLUTION SEND RESPONSE: ' +
    body
  );

  if (
    status < 200 ||
    status >= 300
  ) {

    throw new Error(
      'Evolution API error ' +
      status +
      ': ' +
      body
    );

  }

  return body;
}


/**
 * ============================================================
 * PARSE DATE
 * ============================================================
 */
function parseYmdDate(ymd) {

  const match =
    String(ymd || '')
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!match) {

    return new Date();
  }

  return new Date(

    Number(match[1]),

    Number(match[2]) - 1,

    Number(match[3]),

    12,
    0,
    0

  );
}


/**
 * ============================================================
 * JSON RESPONSE
 * ============================================================
 */
function jsonResponse(data) {

  return ContentService

    .createTextOutput(
      JSON.stringify(data)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/**
 * ============================================================
 * TEST GROQ
 * ============================================================
 */
function testGroq() {

  const result =
    analyzeVisitReportWithGroq(

      'MOTOR MALANG\n' +

      'Nama: Ahmad Bahrul Alam\n' +

      'Kontrak: 4662502863\n' +

      'Past Due: 29\n' +

      'Alamat: Rumah\n' +

      'Bertemu langsung dengan konsumen. ' +

      'Konsumen belum bisa bayar karena menunggu gaji. ' +

      'Janji bayar tanggal 20 Agustus.'

    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}


/**
 * ============================================================
 * TEST GROUP PAYLOAD
 * ============================================================
 *
 * Simulasi:
 * Staff mengirim foto + caption
 * di dalam WhatsApp Group.
 * ============================================================
 */
function testGroupImageCaptionPayload() {

  const payload = {

    sender:
      '120363123456789@g.us',

    member:
      '6282251134789',

    message:
      'MOTOR MALANG\n' +
      'Nama: Ahmad Bahrul Alam\n' +
      'Kontrak: 4662502863\n' +
      'Past Due: 29\n' +
      'Bertemu langsung dengan konsumen.',

    url:
      'https://example.com/foto.jpg',

    filename:
      'foto.jpg',

    extension:
      'jpg',

    timestamp:
      new Date().getTime(),

    id:
      'TEST-GROUP-IMAGE-001'

  };

  const chatInfo =
    getChatInfo(payload);

  const message =
    extractMessageText(payload);

  const attachment =
    getAttachmentInfo(payload);

  console.log(
    'CHAT INFO:',
    JSON.stringify(
      chatInfo,
      null,
      2
    )
  );

  console.log(
    'MESSAGE:',
    message
  );

  console.log(
    'ATTACHMENT:',
    JSON.stringify(
      attachment,
      null,
      2
    )
  );
}


/**
 * ============================================================
 * TEST PERSONAL PAYLOAD
 * ============================================================
 */
function testPersonalPayload() {

  const payload = {

    sender:
      '6282251134789',

    message:
      'Nama: Ahmad\n' +
      'Kontrak: 123456789\n' +
      'Past Due: 10\n' +
      'Konsumen janji bayar tanggal 20',

    id:
      'TEST-PERSONAL-001'

  };

  const chatInfo =
    getChatInfo(payload);

  const message =
    extractMessageText(payload);

  console.log(
    'CHAT INFO:',
    JSON.stringify(
      chatInfo,
      null,
      2
    )
  );

  console.log(
    'MESSAGE:',
    message
  );
}

/**
 * ============================================================
 * TEST CASE CATEGORY
 * ============================================================
 */
function testCaseCategories() {

  const tests = [

    {
      name: 'A - Konsumen Ada Unit Ada',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad\n' +
        'Kontrak: 123456789\n' +
        'Past Due: 10\n' +
        'Bertemu langsung dengan konsumen. ' +
        'Unit motor ada di rumah.'
    },

    {
      name: 'B - Konsumen Ada Unit Tidak Ada',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad\n' +
        'Kontrak: 123456789\n' +
        'Past Due: 10\n' +
        'Bertemu langsung dengan konsumen. ' +
        'Unit motor sedang dibawa anaknya dan tidak ada di lokasi.'
    },

    {
      name: 'C - Konsumen Tidak Ada Unit Ada',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad\n' +
        'Kontrak: 123456789\n' +
        'Past Due: 10\n' +
        'Konsumen tidak ada di rumah. ' +
        'Unit motor ditemukan di rumah.'
    },

    {
      name: 'D - Konsumen Tidak Ada Unit Tidak Ada',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad\n' +
        'Kontrak: 123456789\n' +
        'Past Due: 10\n' +
        'Konsumen tidak ada di rumah dan ' +
        'unit motor juga tidak ditemukan.'
    },

    {
      name: 'E - Belum Diketahui',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad\n' +
        'Kontrak: 123456789\n' +
        'Past Due: 10\n' +
        'Sudah dilakukan visit.'
    }

  ];

  tests.forEach(function(test) {

    console.log(
      '========================================'
    );

    console.log(
      'TEST: ' +
      test.name
    );

    const result =
      analyzeVisitReportWithGroq(
        test.message
      );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

  });

}

/**
 * ============================================================
 * TEST ATTACHMENT / CAPTION
 * ============================================================
 */
function testAttachmentScenarios() {

  console.log(
    '========================================'
  );

  console.log(
    'TEST 1: TEXT ONLY'
  );

  const textOnly = {

    sender:
      '6282251134789',

    message:
      'Nama: Ahmad\n' +
      'Kontrak: 123456789\n' +
      'Past Due: 10'

  };

  console.log(
    'MESSAGE: ' +
    extractMessageText(
      textOnly
    )
  );

  console.log(
    'ATTACHMENT: ' +
    JSON.stringify(
      getAttachmentInfo(
        textOnly
      )
    )
  );


  console.log(
    '========================================'
  );

  console.log(
    'TEST 2: PHOTO + CAPTION'
  );

  const photoWithCaption = {

    sender:
      '6282251134789',

    message:
      'Nama: Ahmad\n' +
      'Kontrak: 123456789\n' +
      'Past Due: 10\n' +
      'Bertemu konsumen.',

    url:
      'https://example.com/foto.jpg',

    filename:
      'foto.jpg',

    extension:
      'jpg'

  };

  console.log(
    'MESSAGE: ' +
    extractMessageText(
      photoWithCaption
    )
  );

  console.log(
    'ATTACHMENT: ' +
    JSON.stringify(
      getAttachmentInfo(
        photoWithCaption
      )
    )
  );


  console.log(
    '========================================'
  );

  console.log(
    'TEST 3: PHOTO WITHOUT CAPTION'
  );

  const photoWithoutCaption = {

    sender:
      '6282251134789',

    message:
      '',

    url:
      'https://example.com/foto.jpg',

    filename:
      'foto.jpg',

    extension:
      'jpg'

  };

  console.log(
    'MESSAGE: ' +
    JSON.stringify(
      extractMessageText(
        photoWithoutCaption
      )
    )
  );

  console.log(
    'ATTACHMENT: ' +
    JSON.stringify(
      getAttachmentInfo(
        photoWithoutCaption
      )
    )
  );


  console.log(
    '========================================'
  );

  console.log(
    'TEST 4: FILE + CAPTION'
  );

  const fileWithCaption = {

    sender:
      '6282251134789',

    caption:
      'Nama: Ahmad\n' +
      'Kontrak: 123456789\n' +
      'Past Due: 10\n' +
      'Konsumen janji bayar.',

    url:
      'https://example.com/laporan.pdf',

    filename:
      'laporan.pdf',

    extension:
      'pdf'

  };

  console.log(
    'MESSAGE: ' +
    extractMessageText(
      fileWithCaption
    )
  );

  console.log(
    'ATTACHMENT: ' +
    JSON.stringify(
      getAttachmentInfo(
        fileWithCaption
      )
    )
  );


  console.log(
    '========================================'
  );

}

function testWebhookPayload() {

  const mockEvent = {

    parameter: {

      sender:
        '6282251134789',

      member:
        '',

      message:
        'MOTOR MALANG\n' +
        'Nama: Ahmad Bahrul Alam\n' +
        'Kontrak: 4662502863\n' +
        'Past Due: 29\n' +
        'Bertemu langsung dengan konsumen. Unit motor ada di rumah.',

      id:
        'TEST-WEBHOOK-001'

    },

    postData: {

      type:
        'application/x-www-form-urlencoded',

      contents:
        'sender=6282251134789&' +
        'message=MOTOR%20MALANG'
    }

  };

  const payload =
    getWebhookPayload(
      mockEvent
    );

  console.log(
    'TEST WEBHOOK PAYLOAD:'
  );

  console.log(
    JSON.stringify(
      payload,
      null,
      2
    )
  );

}
