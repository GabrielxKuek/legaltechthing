import React, { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceInput({ onTranscript, isRecording, onToggleRecording, bgmAudio }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const startRecording = async () => {
    if (!apiKey) {
      alert("No OpenAI API key found. Please add it.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Mute BGM while recording
      if (bgmAudio) bgmAudio.volume = 0;

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);

        // Restore BGM
        if (bgmAudio) bgmAudio.volume = 0.2;

        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      onToggleRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Cannot access microphone. Check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      onToggleRecording(false);
      setIsProcessing(true);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Unknown API error');
      }

      const data = await response.json();
      const transcription = data.text.trim();

      if (transcription) onTranscript(transcription);
      else onTranscript("I didn't catch that. Please speak again.");
    } catch (err) {
      console.error("Transcription error:", err);
      onTranscript(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // inline styles similar to PracticePage
  const micButtonStyle = {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '2px solid',
    borderColor: isRecording ? '#dc2626' : '#16a34a',
    backgroundColor: isRecording ? '#ef4444' : '#22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s',
    flexShrink: 0,
    fontSize: '28px',
    boxShadow: isRecording ? '0 0 10px rgba(239,68,68,0.6)' : '0 0 10px rgba(34,197,94,0.5)',
  };

  const labelStyle = {
    position: 'absolute',
    bottom: '-22px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: isRecording ? '#ef4444' : isProcessing ? '#3b82f6' : '#fff',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '8px' }}>
      <button
        style={micButtonStyle}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
      >
        {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
      </button>
      {isRecording && <span style={labelStyle}>STOP</span>}
      {isProcessing && <span style={labelStyle}>PROCESSING...</span>}
    </div>
  );
}
