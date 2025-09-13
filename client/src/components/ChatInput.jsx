import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import VoiceInput from './VoiceInput';

export default function ChatInput({ onSendMessage, apiKey, bgmAudio }) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (transcript) => {
    setMessage(prev => prev + transcript + ' ');
    setIsProcessing(false);
    setIsRecording(false);
  };

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
    }
  };

  useEffect(() => {
    autoResize();
  }, [message]);

  const micButtonStyle = {
    minWidth: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '2px solid',
    backgroundColor: isRecording ? '#ef4444' : '#22c55e',
    borderColor: isRecording ? '#dc2626' : '#16a34a',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
    padding: '12px', // extra padding
    position: 'relative',
  };

  const getSendButtonStyle = () => {
    const base = {
      padding: '16px 32px',
      borderRadius: '14px',
      fontWeight: 'bold',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      border: '2px solid',
      cursor: message.trim() && !isRecording ? 'pointer' : 'not-allowed',
      transition: 'all 0.2s',
      height: '64px',
    };

    if (isRecording || isProcessing) {
      return { ...base, backgroundColor: '#ef4444', color: '#fff', borderColor: '#dc2626' };
    }
    if (message.trim()) {
      return { ...base, backgroundColor: '#22c55e', color: '#fff', borderColor: '#16a34a' };
    }
    return { ...base, backgroundColor: '#d1d5db', color: '#6b7280', borderColor: '#9ca3af' };
  };

  return (
    <div className="border-t bg-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4" style={{ alignItems: 'center' }}>
          
          {/* Mic Button */}
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            isRecording={isRecording}
            onToggleRecording={(val) => {
              setIsRecording(val);
              setIsProcessing(val); // show processing when recording stops
            }}
            apiKey={apiKey}
            bgmAudio={bgmAudio}
            style={micButtonStyle}
          >
            {isRecording ? (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-18px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#ef4444',
                }}
              >
                STOP
              </span>
            ) : isProcessing ? (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-18px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#3b82f6',
                }}
              >
                PROCESSING...
              </span>
            ) : null}
          </VoiceInput>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about legal matters..."
            className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            rows={1}
            disabled={isRecording || isProcessing}
            style={{
              opacity: isRecording || isProcessing ? 0.6 : 1,
              height: '64px',
              lineHeight: '20px',
            }}
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || isRecording || isProcessing}
            style={getSendButtonStyle()}
            onMouseEnter={(e) => {
              if (!isRecording && !isProcessing && message.trim())
                e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            <Send className="w-5 h-5" />
            {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
