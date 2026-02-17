/**
 * 02_RunControl.gs
 * STOP / anti-timeout / auto-continue helpers
 */

/** ===================== STOP HELPERS ===================== */
function shouldStop_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_STOP_SCAN) === '1';
}

function clearStopFlag_() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_STOP_SCAN);
}

/** ===================== TIME HELPERS ===================== */
function timeAlmostUp_(startMs) {
  return (Date.now() - startMs) > (TIME_BUDGET_MS - TIME_BUFFER_MS);
}

function clearContinueTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'continueScan') ScriptApp.deleteTrigger(t);
  }
}

function scheduleContinue_(ss, reason) {
  if (!AUTO_CONTINUE) return;
  if (shouldStop_()) return;

  clearContinueTriggers_();
  ScriptApp.newTrigger('continueScan')
    .timeBased()
    .after(CONTINUE_DELAY_MS)
    .create();

  const nextAt = new Date(Date.now() + CONTINUE_DELAY_MS);
  log_(ss, `CONTINUE scheduled (${reason}) at ~${nextAt.toISOString()}`, 'INFO');
}

