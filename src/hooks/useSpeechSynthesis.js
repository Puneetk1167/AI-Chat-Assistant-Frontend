/**
 * Simple wrapper around the browser's built-in SpeechSynthesis (TTS).
 * No hook state needed since we just fire-and-forget speech.
 */
export function speakText(text) {
  if (!window.speechSynthesis) return;

  // Stop anything currently being spoken before starting new speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
