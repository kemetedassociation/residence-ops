import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor() {
  return typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
}

// Wraps the browser's Web Speech API (SpeechRecognition + SpeechSynthesis) so the
// chatbot can be used hands-free. Both are optional browser features — this hook
// degrades gracefully (isSupported=false) on browsers that don't implement them,
// falling back to text-only chat.
export function useSpeech({ lang = "fr-FR" } = {}) {
  const RecognitionCtor = getRecognitionCtor();
  const isRecognitionSupported = !!RecognitionCtor;
  const isSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!isRecognitionSupported) return;
    const recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [RecognitionCtor, isRecognitionSupported, lang]);

  const listen = useCallback(() => {
    return new Promise((resolve, reject) => {
      const recognition = recognitionRef.current;
      if (!recognition) return reject(new Error("La reconnaissance vocale n'est pas prise en charge par ce navigateur."));

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || "";
        resolve(transcript);
      };
      recognition.onerror = (event) => reject(new Error(event.error || "Erreur de reconnaissance vocale."));
      recognition.onend = () => setIsListening(false);

      setIsListening(true);
      try {
        recognition.start();
      } catch (err) {
        setIsListening(false);
        reject(err);
      }
    });
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    setIsListening(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!isSynthesisSupported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.02;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [isSynthesisSupported, lang]
  );

  const stopSpeaking = useCallback(() => {
    if (isSynthesisSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSynthesisSupported]);

  return {
    isRecognitionSupported,
    isSynthesisSupported,
    isListening,
    isSpeaking,
    listen,
    stopListening,
    speak,
    stopSpeaking,
  };
}
