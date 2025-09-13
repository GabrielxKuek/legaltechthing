import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX, Mic, MicOff, AlertCircle } from 'lucide-react';

export default function PracticePage() {
  const [currentCharacter, setCurrentCharacter] = useState('phoenix');
  const [phoenixFrame, setPhoenixFrame] = useState(0);
  const [edgeworthFrame, setEdgeworthFrame] = useState(15);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [audio, setAudio] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [phoenixSpeech, setPhoenixSpeech] = useState('');
  
  const textTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Get API key from environment variables
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  // Phoenix Wright sprite frames (0-5)
  const phoenixFrames = Array.from({length: 6}, (_, i) => `/phoenix/pl10030a-0${i}.png`);
  // Edgeworth sprite frames (15-22)
  const edgeworthFrames = Array.from({length: 8}, (_, i) => `/edgeworth/bu_chr00_06_a-${i + 15}.png`);

  const edgeworthDialogue = "Miles Edgeworth, prosecutor. Hmph. I hope you're prepared, because these cases won't be easy. You'll need to think like a lawyer, analyze evidence carefully, and present compelling arguments. The pursuit of truth requires nothing less than perfection.";

  // Cleanup on component unmount
  useEffect(() => {
    const bgmAudio = new Audio('/courtroom-bgm.flac');
    bgmAudio.loop = true;
    bgmAudio.volume = 0.2;
    bgmAudio.muted = false;
    setAudio(bgmAudio);

    // Optional: play on first user gesture
    const playOnClick = () => {
        bgmAudio.play().catch(() => {});
        document.removeEventListener('click', playOnClick);
    };
    document.addEventListener('click', playOnClick);

    return () => {
        bgmAudio.pause();
        if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
        document.removeEventListener('click', playOnClick);
        if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };
  }, []);

  useEffect(() => {
    if (audio) {
      if (isAudioEnabled) audio.play().catch(console.error);
      else audio.pause();
    }
  }, [isAudioEnabled, audio]);

  // Character idle animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTransitioning) {
        if (currentCharacter === 'phoenix') setPhoenixFrame(prev => (prev + 1) % 6);
        else setEdgeworthFrame(prev => (prev === 22 ? 15 : prev + 1));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentCharacter, isTransitioning]);

  const typeText = (text) => {
    setCurrentText('');
    setIsTyping(true);
    setShowContinueButton(false);

    let index = 0;
    const typeChar = () => {
      if (index < text.length) {
        setCurrentText(text.substring(0, index + 1));
        index++;
        textTimeoutRef.current = setTimeout(typeChar, 35);
      } else {
        setIsTyping(false);
        setShowContinueButton(true);
      }
    };
    typeChar();
  };

  const startRecording = async () => {
    if (!apiKey) {
        setCurrentText("gabriel you forgot to add openai api key");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Mute or lower BGM while recording
        if (audio) audio.volume = 0;

        mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
        };
        
        mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);

        // Restore BGM volume after recording
        if (audio) audio.volume = 0.2;

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setCurrentText('');
        setPhoenixSpeech('');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        setCurrentText('❌ Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      const transcription = result.text;
      
      if (transcription.trim()) {
        setPhoenixSpeech(transcription);
        typeText(transcription);
      } else {
        setCurrentText("I didn't catch that. Please try speaking again.");
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      setCurrentText(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinue = () => {
    if (isTyping) {
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
      setCurrentText(phoenixSpeech);
      setIsTyping(false);
      setShowContinueButton(true);
      return;
    }

    setIsTransitioning(true);
    setShowContinueButton(false);

    setTimeout(() => {
      if (currentCharacter === 'phoenix') {
        setCurrentCharacter('edgeworth');
        typeText(edgeworthDialogue);
      } else {
        setCurrentCharacter('phoenix');
        setPhoenixSpeech('');
        setCurrentText('');
      }
      setIsTransitioning(false);
    }, 500);
  };

  const getButtonStyles = () => {
    const baseStyles = {
      padding: '16px 32px',
      borderRadius: '8px',
      fontWeight: 'bold',
      fontSize: '20px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      transition: 'all 0.2s',
      transform: 'scale(1)',
      border: '2px solid',
      cursor: 'pointer'
    };

    if (isRecording) {
      return {
        ...baseStyles,
        backgroundColor: '#ef4444',
        color: 'white',
        borderColor: '#dc2626'
      };
    } else if (apiKey) {
      return {
        ...baseStyles,
        backgroundColor: '#22c55e',
        color: 'white',
        borderColor: '#16a34a'
      };
    } else {
      return {
        ...baseStyles,
        backgroundColor: '#d1d5db',
        color: '#6b7280',
        borderColor: '#9ca3af',
        cursor: 'not-allowed'
      };
    }
  };

  const handleGoHome = () => alert('Navigation to home page would happen here');

  const toggleAudio = () => setIsAudioEnabled(v => !v);

  const getCurrentSprite = () => {
    return currentCharacter === 'phoenix' ? phoenixFrames[phoenixFrame] : edgeworthFrames[edgeworthFrame - 15];
  };

  const getCharacterName = () => currentCharacter === 'phoenix' ? 'Phoenix Wright' : 'Miles Edgeworth';

  return (
    <div
      className="h-screen flex flex-col relative"
      style={{
        backgroundImage: "url('/courtroom.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 border-b-4 border-yellow-400 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoHome}
              className="p-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors text-blue-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-yellow-400" style={{ fontFamily: 'serif' }}>
                LEGAL PRACTICE MODE
              </h1>
            </div>
          </div>

          {/* toggle audio */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAudio}
              className="p-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors text-blue-900"
            >
              {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {/* Chat navigation button */}
            <button
                onClick={() => window.location.href = '/'}
                className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors text-white flex items-center gap-1"
            >
                Chat
            </button>
        </div>
      </div>

      {/* Main courtroom area */}
      <div className="flex-1 relative">
        {/* background / stage is provided by parent */}
      </div>

      {/* Character Layer */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end z-10 pointer-events-none">
        {currentCharacter === 'phoenix' ? (
          <div className="transform -translate-x-32">
            <img
              src={getCurrentSprite()}
              alt="Phoenix Wright"
              className="h-[600px] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        ) : (
          <div className="transform translate-x-32 scale-125 -translate-y-8">
            <img
              src={getCurrentSprite()}
              alt="Miles Edgeworth"
              className="h-[700px] ml-130 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}
      </div>

      {/* Text box at bottom */}
      <div className="relative z-20 bg-gradient-to-r from-blue-900 to-blue-800 border-t-4 border-yellow-400 p-6">
        <div className="bg-white rounded-lg border-4 border-blue-900 p-6 relative">
          {/* Character name */}
          {currentText && !currentText.startsWith('❌') && (
            <div className="absolute -top-8 left-6">
              <div className="bg-blue-900 text-yellow-400 px-4 py-2 rounded-t-lg font-bold border-4 border-blue-900 border-b-0">
                {getCharacterName()}
              </div>
            </div>
          )}

          {/* Text content */}
          <div className="text-blue-900 text-lg leading-relaxed min-h-24 pt-2">
            {currentText}
            {isTyping && <span className="animate-pulse">|</span>}
            {isRecording && <span className="animate-pulse text-red-500"> Recording...</span>}
            {isProcessing && <span className="animate-pulse text-blue-500">...</span>}
          </div>

          {/* Recording Toggle Button */}
          {currentCharacter === 'phoenix' && (
            <div className="absolute bottom-4 left-6 pointer-events-auto">
                <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!apiKey && !isRecording}
                style={getButtonStyles()}
                onMouseEnter={(e) => {
                    if (!(!apiKey && !isRecording)) {
                    e.target.style.transform = 'scale(1.05)';
                    if (isRecording) e.target.style.backgroundColor = '#dc2626';
                    else if (apiKey) e.target.style.backgroundColor = '#16a34a';
                    }
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    if (isRecording) e.target.style.backgroundColor = '#ef4444';
                    else if (apiKey) e.target.style.backgroundColor = '#22c55e';
                }}
                >
                {isRecording ? (
                    <>
                    <MicOff size={24} />
                    STOP RECORDING
                    </>
                ) : (
                    <>
                    <Mic size={24} />
                    {apiKey ? 'START SPEAKING' : 'add api key chat'}
                    </>
                )}
                </button>
            </div>
          )}

          {/* Continue button */}
          <div className="absolute bottom-4 right-6">
            {showContinueButton && !isProcessing && (
              <button
                onClick={handleContinue}
                className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-6 py-3 rounded-lg font-bold border-2 border-blue-900 transition-all transform hover:scale-105"
              >
                {currentCharacter === 'edgeworth' ? '◀ BACK' : '▶ CONTINUE'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}