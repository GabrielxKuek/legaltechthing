import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceInput({ onTranscript, isRecording, onToggleRecording }) {
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const speechRecognition = new window.webkitSpeechRecognition();
      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      
      speechRecognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          onTranscript(finalTranscript);
        }
      };
      
      speechRecognition.onend = () => {
        onToggleRecording(false);
      };
      
      setRecognition(speechRecognition);
    }
  }, [onTranscript, onToggleRecording]);

  const toggleRecording = () => {
    if (!recognition) return;
    
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
    onToggleRecording(!isRecording);
  };

  return (
    <button
      onClick={toggleRecording}
      className={`p-3 rounded-xl transition-all duration-200 shadow-sm ${
        isRecording 
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-200' 
          : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:shadow-md'
      }`}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}