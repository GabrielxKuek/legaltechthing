import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';

export default function PracticePage() {
  const [currentCharacter, setCurrentCharacter] = useState('phoenix');
  const [phoenixFrame, setPhoenixFrame] = useState(0);
  const [edgeworthFrame, setEdgeworthFrame] = useState(15);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [audio, setAudio] = useState(null);
  const textTimeoutRef = useRef(null);

  // Phoenix Wright sprite frames (0-5)
  const phoenixFrames = Array.from({length: 6}, (_, i) => `/phoenix/pl10030a-0${i}.png`);
  // Edgeworth sprite frames (15-22)
  const edgeworthFrames = Array.from({length: 8}, (_, i) => `/edgeworth/bu_chr00_06_a-${i + 15}.png`);

  const phoenixDialogue = "Welcome to the courtroom! I'm Phoenix Wright, defense attorney. These legal practice scenarios will test your skills in cross-examination, evidence presentation, and logical reasoning. Are you ready to take on the challenge?";
  const edgeworthDialogue = "Miles Edgeworth, prosecutor. Hmph. I hope you're prepared, because these cases won't be easy. You'll need to think like a lawyer, analyze evidence carefully, and present compelling arguments. The pursuit of truth requires nothing less than perfection.";

  useEffect(() => {
    const bgmAudio = new Audio('/courtroom-bgm.flac');
    bgmAudio.loop = true;
    bgmAudio.volume = 0.2;
    setAudio(bgmAudio);

    return () => {
      if (bgmAudio) bgmAudio.pause();
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
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
    setShowStartButton(false);

    let index = 0;
    const typeChar = () => {
      if (index < text.length) {
        setCurrentText(text.substring(0, index + 1));
        index++;
        textTimeoutRef.current = setTimeout(typeChar, 50);
      } else {
        setIsTyping(false);
        setShowContinueButton(true);
      }
    };
    typeChar();
  };

  const handleStart = () => typeText(phoenixDialogue);

  const handleContinue = () => {
    if (isTyping) {
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
      setCurrentText(currentCharacter === 'phoenix' ? phoenixDialogue : edgeworthDialogue);
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
        typeText(phoenixDialogue);
      }
      setIsTransitioning(false);
    }, 500);
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
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAudio}
              className="p-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors text-blue-900"
            >
              {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main courtroom area (no characters here) */}
      <div className="flex-1 relative">
        {/* background / stage is provided by parent; you can add props/content here */}
      </div>

      {/* === CHARACTER LAYER ===
          Moved outside the flex-1 container so it can overlap the textbox.
          z-10 puts it behind the textbox (textbox has z-20 below).
          pointer-events-none ensures clicks go through to the textbox controls.
      */}
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

      {/* Text box at bottom - higher z-index to appear above characters */}
      <div className="relative z-20 bg-gradient-to-r from-blue-900 to-blue-800 border-t-4 border-yellow-400 p-6">
        <div className="bg-white rounded-lg border-4 border-blue-900 p-6 relative">
          {/* Character name - only show when there's text */}
          {currentText && (
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
          </div>

          {/* Start button - centered in textbox when Phoenix has no lines */}
          {showStartButton && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handleStart}
                className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-8 py-4 rounded-lg font-bold text-xl border-4 border-blue-900 transition-all transform hover:scale-105 animate-pulse shadow-lg"
              >
                ▶ START
              </button>
            </div>
          )}

          {/* Continue button */}
          <div className="absolute bottom-4 right-6">
            {showContinueButton && (
              <button
                onClick={handleContinue}
                className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-6 py-3 rounded-lg font-bold border-2 border-blue-900 transition-all transform hover:scale-105 animate-pulse"
              >
                {currentCharacter === 'edgeworth' ? '◀ BACK' : (isTyping ? '▶▶ SKIP' : '▶ CONTINUE')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}