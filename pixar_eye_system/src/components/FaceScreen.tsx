import React, { useState, useRef, useCallback } from 'react';
import { Windshield } from './Windshield';
import { ControlPanel } from './ControlPanel';
import { MessageBar } from './MessageBar';
import type { EmotionalState } from '../types/eye';
import { EMOTIONS } from '../constants/emotions';
import { useEyeMotion } from '../hooks/useEyeMotion';
import { useBlinkSystem } from '../hooks/useBlinkSystem';
import { useAIWebSocket } from '../hooks/useAIWebSocket';

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
  const [isFaceTracking, setIsFaceTracking] = useState<boolean>(true);
  const [enableMicroSaccades, setEnableMicroSaccades] = useState<boolean>(true);
  const [customPupilScale, setCustomPupilScale] = useState<number>(1.0);
  const [activeVoice, setActiveVoice] = useState<string>('vits_lite');

  const [isReceiving, setIsReceiving] = useState(false);
  const [receivedWords, setReceivedWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const totalWordsRef = useRef<number>(0);
  const streamedTextRef = useRef<string>('');

  const emotionBase = EMOTIONS[currentEmotionState] || EMOTIONS.neutral;
  const emotionConfig = {
    ...emotionBase,
    pupilScale: emotionBase.pupilScale * customPupilScale,
  };

  const { gazeX, gazeY, parallaxX, parallaxY, setGaze, releaseGaze } = useEyeMotion({
    enableMicroSaccades,
    enableBreathing: true,
    enableIdleLookAround: !isFaceTracking && !isReceiving,
    saccadeSpeedMultiplier: emotionConfig.saccadeSpeed,
  });

  const { blinkProgress, triggerBlink } = useBlinkSystem({
    enabled: false,
    frequencyMultiplier: emotionConfig.blinkFrequencyMultiplier,
  });

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
    // DO NOT aggressively advance the index here! Wait for audio sync.
  }, []);

  const handleStreamEnd = useCallback(() => {
    setTimeout(() => {
      setIsReceiving(false);
      setCurrentEmotionState('happy');
    }, 1500);
  }, []);

  const { isConnected: isAIConnected, sendSpeechToAI, sendRawMessage } = useAIWebSocket({
    onEmotionChange: handleEmotionChange,
    onTextChunk: handleTextChunk,
    onStreamEnd: handleStreamEnd,
    onWordSync: (wordIdx: number) => setCurrentWordIndex(wordIdx),
    totalWordsRef,
  });

  // Voice selection — send set_voice to backend
  const handleVoiceChange = useCallback((voiceId: string) => {
    setActiveVoice(voiceId);
    sendRawMessage({ type: 'set_voice', voice_id: voiceId });
  }, [sendRawMessage]);

  const streamLocalFallback = useCallback((fullText: string) => {
    const words = fullText.split(' ');
    setReceivedWords(words);
    setCurrentWordIndex(-1);
    setIsReceiving(true);
    setCurrentEmotionState('thinking');
    setTimeout(() => {
      let idx = -1;
      const interval = setInterval(() => {
        idx++;
        if (idx < words.length) {
          setCurrentWordIndex(idx);
          setCurrentEmotionState(idx % 2 === 0 ? 'talking' : 'excited');
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setIsReceiving(false);
            setCurrentEmotionState('happy');
          }, 1200);
        }
      }, 160);
    }, 400);
  }, []);

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
      streamLocalFallback(matched);
    }
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isFaceTracking || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      
      const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      setGaze({ x: normX, y: normY }, isTouch);
    },
    [isFaceTracking, setGaze]
  );

  const handlePointerUp = useCallback(() => {
    if (isFaceTracking) {
      releaseGaze();
    }
  }, [isFaceTracking, releaseGaze]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-screen h-screen overflow-hidden select-none touch-none"
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

      <ControlPanel
        currentEmotion={currentEmotionState}
        onSelectEmotion={setCurrentEmotionState}
        onTriggerBlink={triggerBlink}
        isFaceTracking={isFaceTracking}
        onToggleFaceTracking={() => setIsFaceTracking(!isFaceTracking)}
        enableMicroSaccades={enableMicroSaccades}
        onToggleMicroSaccades={() => setEnableMicroSaccades(!enableMicroSaccades)}
        showPhoneFrame={showPhoneFrame}
        onTogglePhoneFrame={() => setShowPhoneFrame(!showPhoneFrame)}
        customPupilScale={customPupilScale}
        onChangePupilScale={setCustomPupilScale}
        activeVoice={activeVoice}
        onVoiceChange={handleVoiceChange}
      />

      {/* AI connection badge */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-1 bg-slate-950/70 backdrop-blur-md rounded-full border border-white/10 text-[11px] text-slate-300">
        <span className={`w-2 h-2 rounded-full ${isAIConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        <span>{isAIConnected ? 'Emiot AI Active' : 'AI Offline (Fallback)'}</span>
      </div>
    </div>
  );
};
