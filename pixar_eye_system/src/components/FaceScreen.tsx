import React, { useState, useRef, useCallback } from 'react';
import { Windshield } from './Windshield';
import { ControlPanel } from './ControlPanel';
import { MessageBar } from './MessageBar';
import { VisionHUD } from './VisionHUD';
import type { EmotionalState } from '../types/eye';
import { EMOTIONS } from '../constants/emotions';
import { useEyeMotion } from '../hooks/useEyeMotion';
import { useBlinkSystem } from '../hooks/useBlinkSystem';
import { useAIWebSocket } from '../hooks/useAIWebSocket';
import { useLocalTTS } from '../hooks/useLocalTTS';
import { useVisionPerception } from '../hooks/useVisionPerception';
import type { AttentionOutput } from '../types/vision';

const McQueenAIResponses: Record<string, string> = {
  'Are you ready to race?':
    "You bet I'm ready! Lightning McQueen is always first off the starting line!",
  'Float like a Cadillac, sting like a Beemer!':
    "That's Guido and Luigi's favorite phrase! Float like a Cadillac, sting like a Beemer!",
  'Turn right to go left!':
    "Doc Hudson taught me that trick on the dirt track! Turn right to go left!",
};

export const FaceScreen: React.FC = () => {
  const [currentEmotionState, setCurrentEmotionState] = useState<EmotionalState>('neutral');
  const [showPhoneFrame, setShowPhoneFrame] = useState<boolean>(false);
  const [isVisionTracking, setIsVisionTracking] = useState<boolean>(true);
  const [enableMicroSaccades, setEnableMicroSaccades] = useState<boolean>(true);
  const [customPupilScale, setCustomPupilScale] = useState<number>(1.0);
  const [activeVoice, setActiveVoice] = useState<string>('vits_lite');
  const [curiositySensitivity, setCuriositySensitivity] = useState<number>(0.65);
  const [isVisionHUDOpen, setIsVisionHUDOpen] = useState<boolean>(false);

  const [isReceiving, setIsReceiving] = useState(false);
  const [receivedWords, setReceivedWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const totalWordsRef = useRef<number>(0);
  const streamedTextRef = useRef<string>('');

  const { gazeX, gazeY, parallaxX, parallaxY, setGaze, releaseGaze } = useEyeMotion({
    enableMicroSaccades,
    enableBreathing: true,
    enableIdleLookAround: !isVisionTracking && !isReceiving,
    saccadeSpeedMultiplier: 1.0,
  });

  // MULTI-MODAL COMPUTER VISION & ATTENTION ARBITRATOR HOOK
  const handleAttentionUpdate = useCallback(
    (output: AttentionOutput) => {
      if (isVisionTracking && output.confidence > 0.15) {
        setGaze(output.smoothedPoint, false);
      }
    },
    [isVisionTracking, setGaze]
  );

  const {
    isLoading: isVisionLoading,
    isReady: isVisionReady,
    error: visionError,
    cameraActive,
    attentionData,
  } = useVisionPerception({
    enabled: isVisionTracking,
    enablePose: true,
    enableCuriosity: true,
    curiositySensitivity,
    onAttentionUpdate: handleAttentionUpdate,
  });

  // Emotional Pupil Modulation + Curiosity Dilation Boost
  const emotionBase = EMOTIONS[currentEmotionState] || EMOTIONS.neutral;
  const curiosityDilation = attentionData?.curiosityDilation ?? 0.0;
  const emotionConfig = {
    ...emotionBase,
    pupilScale: emotionBase.pupilScale * customPupilScale * (1.0 + curiosityDilation),
  };

  const { blinkProgress, triggerBlink } = useBlinkSystem({
    enabled: false,
    frequencyMultiplier: emotionConfig.blinkFrequencyMultiplier,
  });

  // LOCAL TTS ENGINE
  const { isReady: isTTSReady, progressInfo: ttsProgressInfo, initLocalTTS, speakText } = useLocalTTS();

  React.useEffect(() => {
    initLocalTTS();
  }, [initLocalTTS]);

  const handleEmotionChange = useCallback((emotion: EmotionalState) => {
    setCurrentEmotionState(emotion);
  }, []);

  const handleTextChunk = useCallback((token: string, emotion: EmotionalState) => {
    setIsReceiving(true);
    setCurrentEmotionState(emotion);
    streamedTextRef.current += token;
    const words = streamedTextRef.current.trim().split(/\s+/);
    totalWordsRef.current = words.length;
    setReceivedWords(words);
  }, []);

  const handleStreamEnd = useCallback(() => {
    if (isTTSReady && streamedTextRef.current) {
      speakText(
        streamedTextRef.current,
        () => {
          let idx = -1;
          const words = streamedTextRef.current.trim().split(/\s+/);
          const interval = setInterval(() => {
            idx++;
            if (idx < words.length) {
              setCurrentWordIndex(idx);
            } else {
              clearInterval(interval);
            }
          }, 200);
        },
        () => {
          setIsReceiving(false);
          setCurrentEmotionState('happy');
        }
      );
    } else {
      setTimeout(() => {
        setIsReceiving(false);
        setCurrentEmotionState('happy');
      }, 1500);
    }
  }, [isTTSReady, speakText]);

  const { isConnected: isAIConnected, sendSpeechToAI, sendRawMessage } = useAIWebSocket({
    onEmotionChange: handleEmotionChange,
    onTextChunk: handleTextChunk,
    onStreamEnd: handleStreamEnd,
    onWordSync: (wordIdx: number) => setCurrentWordIndex(wordIdx),
    totalWordsRef,
    shouldPlayBackendAudio: true,
  });

  const handleVoiceChange = useCallback((voiceId: string) => {
    if (voiceId === 'xtts_original') {
      alert("WARNING: XTTS Original (5.6GB) requires a PC connection. Running in fallback mode.");
    }
    setActiveVoice(voiceId);
    sendRawMessage({ type: 'set_voice', voice_id: voiceId });
  }, [sendRawMessage]);

  const streamLocalFallback = useCallback((fullText: string, tryRealAudio: boolean = false) => {
    const words = fullText.split(' ');
    setReceivedWords(words);
    setCurrentWordIndex(-1);
    setIsReceiving(true);
    setCurrentEmotionState('thinking');

    const animateWords = () => {
      let idx = -1;
      const interval = setInterval(() => {
        idx++;
        if (idx < words.length) {
          setCurrentWordIndex(idx);
          setCurrentEmotionState(idx % 2 === 0 ? 'talking' : 'excited');
        } else {
          clearInterval(interval);
          if (!tryRealAudio || activeVoice !== 'vits_lite') {
            setTimeout(() => {
              setIsReceiving(false);
              setCurrentEmotionState('happy');
            }, 1200);
          }
        }
      }, 200);
    };

    if (tryRealAudio && activeVoice === 'vits_lite' && isTTSReady) {
      speakText(fullText, 
        () => {
          animateWords();
        }, 
        () => {
          setIsReceiving(false);
          setCurrentEmotionState('happy');
        }
      );
    } else {
      setTimeout(animateWords, 400);
    }
  }, [activeVoice, isTTSReady, speakText]);

  const handleSendMessage = (userText: string) => {
    streamedTextRef.current = '';
    setReceivedWords([]);
    setCurrentWordIndex(-1);
    setCurrentEmotionState('thinking');
    
    const sent = sendSpeechToAI(userText);
    if (!sent) {
      const matched =
        McQueenAIResponses[userText] ||
        `Ka-chow! You said "${userText}"! Lightning McQueen is powered up and ready!`;
      streamLocalFallback(matched, true);
    }
  };

  // Manual Pointer Override (for touching/mouse dragging on screen)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (cameraActive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      
      const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      setGaze({ x: normX, y: normY }, isTouch);
    },
    [cameraActive, setGaze]
  );

  const handlePointerUp = useCallback(() => {
    if (!cameraActive) {
      releaseGaze();
    }
  }, [cameraActive, releaseGaze]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 w-screen h-[100dvh] overflow-hidden select-none touch-none bg-black"
    >
      <Windshield
        emotion={emotionConfig}
        gazeX={gazeX}
        gazeY={gazeY}
        parallaxX={parallaxX}
        parallaxY={parallaxY}
        blinkProgress={blinkProgress}
      />

      <MessageBar
        onSendMessage={handleSendMessage}
        isReceiving={isReceiving}
        receivedWords={receivedWords}
        currentWordIndex={currentWordIndex}
        onSelectPreset={(preset) => handleSendMessage(preset)}
      />

      {/* Vision Real-Time Status & Radar HUD */}
      <VisionHUD
        attentionData={attentionData}
        cameraActive={cameraActive}
        isLoading={isVisionLoading}
        error={visionError}
        isOpen={isVisionHUDOpen}
        onToggleOpen={() => setIsVisionHUDOpen(!isVisionHUDOpen)}
      />

      <ControlPanel
        currentEmotion={currentEmotionState}
        onSelectEmotion={setCurrentEmotionState}
        onTriggerBlink={triggerBlink}
        isVisionTracking={isVisionTracking}
        onToggleVisionTracking={() => setIsVisionTracking(!isVisionTracking)}
        enableMicroSaccades={enableMicroSaccades}
        onToggleMicroSaccades={() => setEnableMicroSaccades(!enableMicroSaccades)}
        showPhoneFrame={showPhoneFrame}
        onTogglePhoneFrame={() => setShowPhoneFrame(!showPhoneFrame)}
        customPupilScale={customPupilScale}
        onChangePupilScale={setCustomPupilScale}
        activeVoice={activeVoice}
        onVoiceChange={handleVoiceChange}
        curiositySensitivity={curiositySensitivity}
        onChangeCuriositySensitivity={setCuriositySensitivity}
        isVisionHUDOpen={isVisionHUDOpen}
        onToggleVisionHUD={() => setIsVisionHUDOpen(!isVisionHUDOpen)}
        isVisionReady={isVisionReady}
      />

      {/* Connection & Status Badges */}
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/70 backdrop-blur-md rounded-full border border-white/10 text-[11px] text-slate-300">
          <span className={`w-2 h-2 rounded-full ${isAIConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{isAIConnected ? 'Emiot AI Active' : 'AI Offline (Fallback)'}</span>
        </div>
        
        {ttsProgressInfo && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-950/70 backdrop-blur-md rounded-full border border-blue-500/30 text-[11px] text-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>{ttsProgressInfo}</span>
          </div>
        )}
      </div>
    </div>
  );
};
