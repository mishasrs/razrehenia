/**
 * 21_DataFormat.gs
 * Форматирование листа "Разрешения"
 */

/** ===================== FORMAT "Разрешения" ===================== */
function applyDataSheetFormatting_(sh) {
  sh.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f3f4f6');

  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 3, sh.getLastRow() - 1, 1).setNumberFormat('0.##');
    sh.getRange(2, 4, sh.getLastRow() - 1, 1).setNumberFormat('0.##');
    sh.getRange(2, 5, sh.getLastRow() - 1, 1).setNumberFormat('dd.MM.yyyy');
  }

  const range = sh.getRange('E:E');
  const rules = [];

  // Истекло — светло-красный
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($E1<>"";$E1<TODAY())')
      .setBackground('#fee2e2')
      .setRanges([range])
      .build()
  );

  // Скоро истечёт — красный (как вы просили, не жёлтый)
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=AND($E1<>"";$E1>=TODAY();$E1<=TODAY()+${EXPIRING_DAYS})`)
      .setBackground('#fca5a5')
      .setRanges([range])
      .build()
  );

  sh.setConditionalFormatRules(rules);
}
