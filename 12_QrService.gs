/**
 * 12_QrService.gs
 * QR pipeline: получить thumbnail 1-й страницы PDF и распознать QR
 * (QuickChart + fallback goQR)
 */

/** ===================== QR PIPELINE ===================== */
function decodeQrFromPdf_(ss, file) {
  const thumb = getLargeThumbnail_(ss, file);
  if (!thumb) {
    log_(ss, `Нет поддерживаемого thumbnail для: ${file.getName()}`, 'WARN');
    return null;
  }
  return decodeFromImage_(ss, thumb);
}

function decodeFromImage_(ss, imageBlob) {
  let result = quickChartDecode_(ss, prepareForQuickChart_(imageBlob));
  result = postFilter_(result);
  if (result) return result;

  const crops = buildQrCropCandidates_(imageBlob);
  for (const c of crops) {
    result = quickChartDecode_(ss, prepareForQuickChart_(c));
    result = postFilter_(result);
    if (result) return result;
  }

  if (ENABLE_GOQR_FALLBACK) {
    result = goQrDecode_(ss, prepareForGoQr_(imageBlob));
    result = postFilter_(result);
    if (result) return result;

    for (const c of crops) {
      result = goQrDecode_(ss, prepareForGoQr_(c));
      result = postFilter_(result);
      if (result) return result;
    }
  }

  return null;
}

function postFilter_(s) {
  if (!s) return null;
  const v = String(s).trim();
  if (!v) return null;
  if (STRICT_SAFE_ROUTE && !v.includes('safe-route')) return null;
  return v;
}

/** ===================== THUMBNAIL FETCH ===================== */
function getLargeThumbnail_(ss, file) {
  const fileId = file.getId();

  for (const size of [2000, 1200]) {
    const b = fetchDriveThumbnailByIdEndpoint_(ss, fileId, size);
    if (b) return b;
    Utilities.sleep(120);
  }

  for (const size of [2000, 1200]) {
    const b = fetchDriveThumbnailFromThumbnailLink_(ss, fileId, size);
    if (b) return b;
    Utilities.sleep(120);
  }

  for (let i = 0; i < 2; i++) {
    try {
      const raw = file.getThumbnail();
      if (!raw) continue;
      const fixed = forceSupportedImageBlob_(ss, raw, `getThumbnail()`);
      if (fixed) return fixed;
    } catch (e) {}
    Utilities.sleep(400);
  }

  return null;
}

function fetchDriveThumbnailByIdEndpoint_(ss, fileId, size) {
  const urls = [
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`,
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=s${size}`,
  ];
  for (const url of urls) {
    const blob = fetchImageUrlAsBlob_(ss, url, `driveThumbnail sz=${size}`);
    if (blob) return blob;
  }
  return null;
}

function fetchDriveThumbnailFromThumbnailLink_(ss, fileId, size) {
  try {
    // Требует Advanced Google Service: Drive API (Drive.Files)
    const meta = Drive.Files.get(fileId, { fields: "thumbnailLink" });
    const thumbUrl0 = meta && meta.thumbnailLink ? String(meta.thumbnailLink) : "";
    if (!thumbUrl0) return null;

    let thumbUrl = thumbUrl0;
    if (thumbUrl.includes("=s")) thumbUrl = thumbUrl.replace(/=s\d+(-c)?/i, `=s${size}$1`);
    else thumbUrl = thumbUrl + `=s${size}`;

    return fetchImageUrlAsBlob_(ss, thumbUrl, `thumbLink s=${size}`);
  } catch (e) {
    if (DEBUG) log_(ss, `thumbLink exception: ${String(e)}`, 'DEBUG');
    return null;
  }
}

function fetchImageUrlAsBlob_(ss, url, tag) {
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      Accept: "image/jpeg,image/png,image/gif;q=0.9,*/*;q=0.8",
      "Accept-Encoding": "identity"
    },
    muteHttpExceptions: true,
    followRedirects: true,
  });

  const code = resp.getResponseCode();
  if (code !== 200) {
    if (DEBUG) log_(ss, `${tag}: HTTP ${code}`, 'DEBUG');
    return null;
  }

  const raw = resp.getBlob();
  return forceSupportedImageBlob_(ss, raw, tag);
}

function forceSupportedImageBlob_(ss, blob, tag) {
  try {
    const bytes0 = blob.getBytes();
    let bytes = maybeUngzipBytes_(bytes0);
    bytes = maybeDecodeBase64ImageBytes_(bytes);

    const type = sniffType_(bytes);
    if (type !== 'image/png' && type !== 'image/jpeg' && type !== 'image/gif') return null;

    const name = (type === 'image/png') ? 'thumb.png' : (type === 'image/gif' ? 'thumb.gif' : 'thumb.jpg');
    return Utilities.newBlob(bytes, type, name);
  } catch (e) {
    if (DEBUG) log_(ss, `${tag}: forceSupportedImageBlob_ exception: ${String(e)}`, 'DEBUG');
    return null;
  }
}

function maybeUngzipBytes_(bytes) {
  if (!bytes || bytes.length < 3) return bytes;
  if ((bytes[0] & 0xFF) === 0x1F && (bytes[1] & 0xFF) === 0x8B && (bytes[2] & 0xFF) === 0x08) {
    try {
      return Utilities.ungzip(Utilities.newBlob(bytes)).getBytes();
    } catch (e) {
      return bytes;
    }
  }
  return bytes;
}

function maybeDecodeBase64ImageBytes_(bytes) {
  if (!bytes || bytes.length < 12) return bytes;

  const prefix = bytesToAsciiPrefix_(bytes, 120).trim();
  if (!prefix) return bytes;

  if (prefix.startsWith('data:image/')) {
    const all = Utilities.newBlob(bytes).getDataAsString().trim();
    const comma = all.indexOf(',');
    if (comma > 0) {
      const b64 = all.slice(comma + 1).replace(/\s+/g, '');
      try { return Utilities.base64Decode(b64); } catch (e) {}
    }
    return bytes;
  }

  if (prefix.startsWith('iVBOR') || prefix.startsWith('/9j/') || prefix.startsWith('R0lGOD')) {
    const all = Utilities.newBlob(bytes).getDataAsString().replace(/\s+/g, '');
    try { return Utilities.base64Decode(all); } catch (e) {}
    return bytes;
  }

  return bytes;
}

function bytesToAsciiPrefix_(bytes, n) {
  const len = Math.min(n, bytes.length);
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = bytes[i] & 0xFF;
    if (c === 0) return '';
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) s += String.fromCharCode(c);
    else return '';
  }
  return s;
}

function sniffType_(bytes) {
  if (!bytes || bytes.length < 12) return 'unknown';
  if ((bytes[0] & 0xFF) === 0xFF && (bytes[1] & 0xFF) === 0xD8 && (bytes[2] & 0xFF) === 0xFF) return 'image/jpeg';
  if ((bytes[0] & 0xFF) === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  return 'unknown';
}

/** ===================== CROPS ===================== */
function buildQrCropCandidates_(pageBlob) {
  const out = [];
  try {
    const img = ImagesService.openImage(pageBlob);
    const w = img.getWidth();
    const h = img.getHeight();
    if (w <= 0 || h <= 0) return [];

    // кандидаты (правый верх)
    out.push(cropRel_(pageBlob, w, h, 0.58, 0.05, 0.38, 0.36));
    out.push(cropRel_(pageBlob, w, h, 0.55, 0.03, 0.42, 0.42));
    out.push(cropRel_(pageBlob, w, h, 0.52, 0.02, 0.46, 0.50));
  } catch (e) {}
  return out.filter(Boolean);
}

function cropRel_(blob, w, h, rx, ry, rw, rh) {
  try {
    const x = Math.floor(w * rx);
    const y = Math.floor(h * ry);
    const ww = Math.floor(w * rw);
    const hh = Math.floor(h * rh);
    return ImagesService.openImage(blob).crop(x, y, ww, hh).getBlob();
  } catch (e) {
    return null;
  }
}

/** ===================== PREP IMAGES ===================== */
function prepareForQuickChart_(blob) {
  return normalizeImage_(blob, 1100, QUICKCHART_MAX_BYTES);
}

function prepareForGoQr_(blob) {
  return normalizeImage_(blob, 1000, GOQR_MAX_BYTES);
}

function normalizeImage_(blob, maxDim, maxBytes) {
  try {
    let img = ImagesService.openImage(blob);
    let w = img.getWidth();
    let h = img.getHeight();
    if (w <= 0 || h <= 0) return blob;

    const m = Math.max(w, h);
    if (m > maxDim) {
      const scale = maxDim / m;
      img = img.resize(Math.floor(w * scale), Math.floor(h * scale));
      w = img.getWidth();
      h = img.getHeight();
    }

    // делаем квадрат (часто лучше для распознавания)
    const sq = Math.max(w, h);
    img = img.resize(sq, sq);

    let out = img.getBlob().getAs(MimeType.JPEG);
    out.setName('qr.jpg');

    let bytes = out.getBytes().length;
    const steps = [900, 800, 700, 600, 500];
    let cur = ImagesService.openImage(out);

    for (const s of steps) {
      if (bytes <= maxBytes) break;
      cur = cur.resize(s, s);
      out = cur.getBlob().getAs(MimeType.JPEG);
      out.setName('qr.jpg');
      bytes = out.getBytes().length;
    }

    return out;
  } catch (e) {
    return blob;
  }
}

/** ===================== QuickChart ===================== */
function quickChartDecode_(ss, imageBlob) {
  const b64 = Utilities.base64Encode(imageBlob.getBytes());

  for (let attempt = 1; attempt <= QC_TRIES; attempt++) {
    const resp = UrlFetchApp.fetch('https://quickchart.io/qr-read', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ image: b64 }),
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() === 200) {
      try {
        const json = JSON.parse(resp.getContentText());
        const r = (json && json.result) ? String(json.result).trim() : '';
        if (r) return r;
      } catch (e) {}
    }

    Utilities.sleep(400 * attempt);
  }

  return null;
}

/** ===================== goQR ===================== */
function goQrDecode_(ss, imageBlob) {
  for (let attempt = 1; attempt <= GOQR_TRIES; attempt++) {
    const resp = UrlFetchApp.fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'post',
      payload: { file: imageBlob },
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() === 200) {
      try {
        const json = JSON.parse(resp.getContentText());
        const data = json && json[0] && json[0].symbol && json[0].symbol[0] ? json[0].symbol[0].data : null;
        if (data) return String(data).trim();
      } catch (e) {}
    }

    Utilities.sleep(500 * attempt);
  }

  return null;
}
