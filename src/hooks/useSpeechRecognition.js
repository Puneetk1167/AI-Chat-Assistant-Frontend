import { useRef, useState, useCallback } from "react";

/**
 * Wraps the browser's built-in SpeechRecognition (Web Speech API).
 * Works best in Chrome / Edge. Returns transcribed text via onResult.
 */
export function useSpeechRecognition(onResult) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const startListening = useCallback(() => {
    if (!isSupported) {
      alert("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isSupported, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { startListening, stopListening, isListening, isSupported };
}
