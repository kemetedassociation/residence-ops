import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "../lib/api";

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
  const audioRef = useRef(null);

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

  // Voix native du navigateur (de secours) — utilisée si la voix d'Isis (Azure) n'est pas
  // configurée côté serveur, ou si l'appel réseau échoue pour une raison quelconque.
  const speakNative = useCallback(
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

  // Voix d'Isis : synthétisée côté serveur via Azure AI Speech. Se dégrade silencieusement
  // vers la voix native si Azure n'est pas configuré (503) ou en cas d'échec réseau.
  const speak = useCallback(
    (text) => {
      if (!text) return;
      const token = getToken();
      if (!token) {
        speakNative(text);
        return;
      }
      audioRef.current?.pause();
      fetch("/api/assistant/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("speech-unavailable");
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => setIsSpeaking(true);
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.play();
        })
        .catch(() => speakNative(text));
    },
    [speakNative]
  );

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
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
