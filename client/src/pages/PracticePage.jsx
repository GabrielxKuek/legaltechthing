import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX, Mic, MicOff, AlertCircle, Award, X, RotateCcw } from 'lucide-react';

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
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [showObjection, setShowObjection] = useState(false);
  
  const textTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Get API key from environment variables
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  // Phoenix Wright sprite frames (0-5)
  const phoenixFrames = Array.from({length: 6}, (_, i) => `/phoenix/pl10030a-0${i}.png`);
  // Edgeworth sprite frames (15-22)
  const edgeworthFrames = Array.from({length: 8}, (_, i) => `/edgeworth/bu_chr00_06_a-${i + 15}.png`);

  const edgeworthDialogue = "...";

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

  const triggerObjection = () => {
    setShowObjection(true);

    // Play objection audio
    const objectionAudio = new Audio('/objection-audio.flac');
    objectionAudio.volume = 0.6;
    objectionAudio.play().catch(() => {});

    // Hide after 1s
    setTimeout(() => {
        setShowObjection(false);
        setCurrentCharacter("edgeworth"); // switch after effect
    }, 1000);
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
        setCurrentText('Error accessing microphone. Please check permissions.');
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

        // after Phoenix is done, trigger Edgeworth's OpenAI reply
        setTimeout(() => {
            getEdgeworthResponse(transcription);
        }, 2000);
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      setCurrentText(`Error: ${error.message}`);
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

  const getEdgeworthResponse = async (userInput) => {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // or "gpt-4o"
            messages: [
            {
                role: "system",
                content: `You are Miles Edgeworth, a sharp and antagonistic prosecutor. 
                Respond like a rival lawyer in a courtroom duel.
                
                Legal Context:
                Fenoscadia Limited is in arbitration against Kronos. Kronos revoked their license citing environmental harm.
                Kronos is now filing an environmental counterclaim (contamination of Rhea River, health impacts, cleanup costs).
                Your role: challenge Phoenix Wright's arguments aggressively, exposing weaknesses and pressing the tribunal to favor Kronos.`,
            },
            {
                role: "user",
                content: userInput,
            },
            ],
            temperature: 0.7,
            max_tokens: 400,
        }),
        });

        if (!response.ok) {
        throw new Error("Failed to fetch Edgeworth's response.");
        }

        const data = await response.json();
        const reply = data.choices[0].message.content.trim();

        setTimeout(() => {
            triggerObjection();
            typeText(reply);
        }, 1000);

    } catch (err) {
        console.error(err);
        
        setTimeout(() => {
            triggerObjection();
            typeText("Hmph. It seems your words falter before the weight of evidence.");
        }, 1000);
    }
  };

  const getArgumentScore = async () => {
    if (!apiKey || !phoenixSpeech) {
        return;
    }

    setIsLoadingScore(true);
    
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert legal coach analyzing courtroom arguments. 
                        
                        Legal Context: Fenoscadia Limited vs. Kronos arbitration case. Kronos revoked Fenoscadia's license citing environmental harm. Kronos filed environmental counterclaim for Rhea River contamination, health impacts, and cleanup costs.
                        
                        Evaluate the user's argument and provide:
                        1. A score out of 100
                        2. Specific strengths (2-3 points)
                        3. Areas for improvement (2-3 points)
                        4. Concrete suggestions for stronger legal arguments
                        5. Specific legal points they could bring up next time
                        
                        Format your response as JSON:
                        {
                          "score": 75,
                          "strengths": ["Point 1", "Point 2"],
                          "improvements": ["Area 1", "Area 2"],
                          "suggestions": ["Suggestion 1", "Suggestion 2"],
                          "legalPoints": ["Legal point 1", "Legal point 2"]
                        }`,
                    },
                    {
                        role: "user",
                        content: `Please analyze this legal argument: "${phoenixSpeech}"`,
                    },
                ],
                temperature: 0.3,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to get argument analysis.");
        }

        const data = await response.json();
        const analysisText = data.choices[0].message.content.trim();
        
        try {
            const scoreData = JSON.parse(analysisText);
            setScoreData(scoreData);
        } catch (parseError) {
            // Fallback if JSON parsing fails
            setScoreData({
                score: 70,
                strengths: ["Your argument was clearly articulated"],
                improvements: ["Could use more specific legal precedents"],
                suggestions: ["Research case law related to environmental licensing"],
                legalPoints: ["Consider citing environmental protection statutes", "Reference precedent cases on license revocation"]
            });
        }

    } catch (error) {
        console.error('Score analysis error:', error);
        setScoreData({
            score: 65,
            strengths: ["Argument was presented"],
            improvements: ["Analysis unavailable due to technical error"],
            suggestions: ["Try again later"],
            legalPoints: ["Technical error prevented analysis"]
        });
    } finally {
        setIsLoadingScore(false);
    }
  };

  const handleShowFeedback = async () => {
    setShowScoreModal(true);
    await getArgumentScore();
  };

  const handleRetry = () => {
    setShowScoreModal(false);
    setIsTransitioning(true);
    setShowContinueButton(false);

    setTimeout(() => {
      setCurrentCharacter('phoenix');
      setPhoenixSpeech('');
      setCurrentText('');
      setScoreData(null);
      setIsTransitioning(false);
    }, 500);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGrade = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
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

      {/* Objection Overlay */}
      {showObjection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
            <img
            src="/objection.png"
            alt="Objection!"
            className="w-[900px] h-auto"
            style={{ imageRendering: 'pixelated' }}
            />
        </div>
      )}

      {/* Feedback Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="bg-white border-4 border-blue-900 max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-blue-900 border-b-4 border-yellow-400 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="text-yellow-400" size={32} />
                  <h2 className="text-2xl font-bold text-yellow-400" style={{ fontFamily: 'serif' }}>
                    ARGUMENT ANALYSIS
                  </h2>
                </div>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="text-yellow-400 hover:text-yellow-300 p-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              {isLoadingScore ? (
                <div className="flex flex-col items-center justify-center mt-4">
                    <img
                        src="/judge-gavel.gif"
                        alt="Judge deciding"
                        className="w-32 h-32"
                    />
                    <p className="text-gray-700 font-semibold">Judge is deciding...</p>
                </div>
              ) : scoreData ? (
                <div className="space-y-8">
                  {/* Score */}
                  <div className="text-center bg-blue-50 border-4 border-blue-900 p-8">
                    <div className="text-blue-900 text-lg font-bold mb-3">FINAL SCORE</div>
                    <div className={`text-6xl font-bold ${getScoreColor(scoreData.score)} mb-2`}>
                      {scoreData.score}
                    </div>
                    <div className="text-xl text-blue-900">
                      Grade: <span className={`font-bold ${getScoreColor(scoreData.score)}`}>
                        {getScoreGrade(scoreData.score)}
                      </span>
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="space-y-6">
                    {/* Strengths */}
                    <div className="border-4 border-blue-900 bg-white">
                      <div className="bg-blue-900 text-yellow-400 p-4 border-b-4 border-yellow-400">
                        <h3 className="text-lg font-bold">! STRENGTHS</h3>
                      </div>
                      <div className="p-6 space-y-3">
                        {scoreData.strengths.map((strength, index) => (
                          <div key={index} className="text-blue-900">
                            • {strength}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Areas for Improvement */}
                    <div className="border-4 border-blue-900 bg-white">
                      <div className="bg-blue-900 text-yellow-400 p-4 border-b-4 border-yellow-400">
                        <h3 className="text-lg font-bold">! AREAS FOR IMPROVEMENT</h3>
                      </div>
                      <div className="p-6 space-y-3">
                        {scoreData.improvements.map((improvement, index) => (
                          <div key={index} className="text-blue-900">
                            • {improvement}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggestions */}
                    <div className="border-4 border-blue-900 bg-white">
                      <div className="bg-blue-900 text-yellow-400 p-4 border-b-4 border-yellow-400">
                        <h3 className="text-lg font-bold">! SUGGESTIONS</h3>
                      </div>
                      <div className="p-6 space-y-3">
                        {scoreData.suggestions.map((suggestion, index) => (
                          <div key={index} className="text-blue-900">
                            • {suggestion}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Legal Points */}
                    {scoreData.legalPoints && (
                      <div className="border-4 border-blue-900 bg-white">
                        <div className="bg-blue-900 text-yellow-400 p-4 border-b-4 border-yellow-400">
                          <h3 className="text-lg font-bold">! LEGAL POINTS TO CONSIDER</h3>
                        </div>
                        <div className="p-6 space-y-3">
                          {scoreData.legalPoints.map((point, index) => (
                            <div key={index} className="text-blue-900">
                              • {point}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-4 justify-center pt-6 border-t-4 border-blue-200">
                    <button
                      onClick={handleRetry}
                      className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-blue-900 border-2 border-yellow-300 font-bold transition-colors flex items-center gap-2"
                    >
                      <RotateCcw size={20} />
                      TRY AGAIN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="text-blue-900 mx-auto mb-4" size={48} />
                  <p className="text-blue-900 text-lg font-bold mb-4">No argument to analyze yet.</p>
                  <p className="text-blue-700 mb-6">Make an argument first, then return for feedback.</p>
                  <button
                    onClick={() => setShowScoreModal(false)}
                    className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-yellow-400 border-2 border-blue-700 font-bold transition-colors"
                  >
                    UNDERSTOOD
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

          {/* Continue/Feedback button */}
          <div className="absolute bottom-4 right-6">
            {showContinueButton && !isProcessing && (
              <>
                {currentCharacter === 'phoenix' ? (
                  <button
                    onClick={handleContinue}
                    className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-6 py-3 rounded-lg font-bold border-2 border-blue-900 transition-all transform hover:scale-105"
                  >
                    ▶ CONTINUE
                  </button>
                ) : (
                  <button
                    onClick={handleShowFeedback}
                    className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-6 py-3 rounded-lg font-bold border-2 border-blue-900 transition-all transform hover:scale-105"
                  >
                    ▶ GET FEEDBACK
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}