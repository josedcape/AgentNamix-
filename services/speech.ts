
// Types definition for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition;

export const isSpeechRecognitionSupported = !!SpeechRecognitionAPI;
export const isSpeechSynthesisSupported = 'speechSynthesis' in window;

let recognition: any = null;

export const startListening = (
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void,
  onError: (error: string) => void
) => {
  if (!isSpeechRecognitionSupported) {
    onError("El reconocimiento de voz no es soportado en este navegador.");
    return;
  }

  if (recognition) {
    recognition.abort();
  }

  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'es-ES'; // Spanish by default

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Speech Error", event.error);
    if (event.error === 'not-allowed') {
        onError("Permiso de micrófono denegado.");
    } else {
        onError(`Error de voz: ${event.error}`);
    }
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
};

export const stopListening = () => {
  if (recognition) {
    recognition.stop();
  }
};

// --- SYNTHESIS (TTS) ---

/**
 * Removes Markdown symbols to make the text sound natural when spoken.
 */
const cleanMarkdownForSpeech = (markdown: string): string => {
  if (!markdown) return "";
  return markdown
    // Remove links but keep text: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images: ![alt](url) -> ""
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove bold/italic: **text** -> text
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove headers: ### Title -> Title
    .replace(/^#+\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' Código omitido. ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    .trim();
};

export const speakText = (text: string) => {
  if (!isSpeechSynthesisSupported) return;

  // Stop any previous speech
  window.speechSynthesis.cancel();

  const cleanText = cleanMarkdownForSpeech(text);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'es-ES';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Try to find a good Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.startsWith('es') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('es'));
  
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = () => {
  if (isSpeechSynthesisSupported) {
    window.speechSynthesis.cancel();
  }
};
