/**
 * 10_DriveRepo.gs
 * Drive: ROOT_FOLDER, обход дерева папок, поиск новых PDF
 */

function getRootFolderId_() {
  const rootId = (PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID') || '').trim();
  if (!rootId) {
    throw new Error('Не задан ROOT_FOLDER_ID. Меню: Разрешения → Указать папку с PDF (ROOT_FOLDER_ID)');
  }
  return rootId;
}

function collectFolderTreeIds_(rootFolder) {
  const set = new Set();
  (function walk_(folder) {
    set.add(folder.getId());
    if (!SCAN_SUBFOLDERS) return;
    const it = folder.getFolders();
    while (it.hasNext()) walk_(it.next());
  })(rootFolder);
  return set;
}

function isFileInFolderTree_(file, folderIdSet) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    const p = parents.next();
    if (folderIdSet.has(p.getId())) return true;
  }
  return false;
}

/**
 * Возвращает массив НОВЫХ PDF (которых ещё нет в таблице по fileId).
 * Сканирует дерево папок (если SCAN_SUBFOLDERS=true) и собирает до limit файлов.
 */
function listPdfFiles_(rootFolder, limit, existingIdToRowMap) {
  const out = [];

  function scanFolder_(folder) {
    if (out.length >= limit) return;

    // PDF в текущей папке
    const filesIt = folder.getFilesByType(MimeType.PDF);
    while (filesIt.hasNext()) {
      const f = filesIt.next();
      const id = f.getId();
      if (existingIdToRowMap && existingIdToRowMap.has(id)) continue;
      out.push(f);
      if (out.length >= limit) return;
    }

    if (!SCAN_SUBFOLDERS) return;

    // Подпапки
    const foldersIt = folder.getFolders();
    while (foldersIt.hasNext()) {
      scanFolder_(foldersIt.next());
      if (out.length >= limit) return;
    }
  }

  scanFolder_(rootFolder);
  return out;
}
