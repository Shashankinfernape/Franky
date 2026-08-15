import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { AttentionOutput, VisionTarget } from '../types/vision';
import { AttentionArbitrator } from '../services/attentionArbitrator';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface UseVisionPerceptionOptions {
  enabled: boolean;
  onAttentionUpdate?: (output: AttentionOutput) => void;
}

export function useVisionPerception(options: UseVisionPerceptionOptions) {
  const { enabled, onAttentionUpdate } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attentionData, setAttentionData] = useState<AttentionOutput | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const arbitratorRef = useRef<AttentionArbitrator>(new AttentionArbitrator());

  const animFrameRef = useRef<number | null>(null);
  const lastFaceTimeRef = useRef<number>(0);

  const onAttentionUpdateRef = useRef(onAttentionUpdate);
  onAttentionUpdateRef.current = onAttentionUpdate;

  // Initialize MediaPipe FaceLandmarker with Iris Refinement
  useEffect(() => {
    let isCancelled = false;

    async function initVision() {
      if (!enabled) return;
      setIsLoading(true);
      setError(null);

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (isCancelled) return;

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        if (isCancelled) return;
        faceLandmarkerRef.current = faceLandmarker;
        setIsReady(true);
        setIsLoading(false);
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('[Vision] Failed to initialize MediaPipe FaceLandmarker:', err);
          setError(err instanceof Error ? err.message : 'Failed to load eye tracking model');
          setIsLoading(false);
        }
      }
    }

    initVision();

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        videoRef.current = video;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setError(null);
    } catch (camErr: unknown) {
      console.error('[Vision] Camera access error:', camErr);
      setError('Camera access denied or unavailable');
      setCameraActive(false);
    }
  }, []);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    arbitratorRef.current.reset();
  }, []);

  useEffect(() => {
    if (enabled && isReady) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [enabled, isReady, startCamera, stopCamera]);

  // Main High-Precision Eye Tracking Loop
  useEffect(() => {
    if (!cameraActive || !isReady) return;

    let isRunning = true;

    const processVisionLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = performance.now();

      if (video && video.readyState >= 2 && !video.paused) {
        const targets: VisionTarget[] = [];

        // Run Eye/Iris Landmarking (~30-60 FPS)
        if (faceLandmarkerRef.current && now - lastFaceTimeRef.current >= 24) {
          lastFaceTimeRef.current = now;
          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              const landmarks = faceResult.faceLandmarks[0];

              // Landmark Indices:
              // Left Iris: Center 468 (Boundary: 469, 470, 471, 472)
              // Right Iris: Center 473 (Boundary: 474, 475, 476, 477)
              // Left Eye: Inner 133, Outer 33, Top 159, Bottom 145
              // Right Eye: Inner 362, Outer 263, Top 386, Bottom 374

              const hasIris = landmarks.length >= 478;

              if (hasIris) {
                const leftIris = landmarks[468];
                const rightIris = landmarks[473];

                const leftInner = landmarks[133];
                const leftOuter = landmarks[33];
                const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x) || 0.01;
                const leftEyeCenterX = (leftInner.x + leftOuter.x) / 2;
                const leftEyeCenterY = (landmarks[159].y + landmarks[145].y) / 2;
                const leftEyeHeight = Math.abs(landmarks[145].y - landmarks[159].y) || 0.01;

                const rightInner = landmarks[362];
                const rightOuter = landmarks[263];
                const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x) || 0.01;
                const rightEyeCenterX = (rightInner.x + rightOuter.x) / 2;
                const rightEyeCenterY = (landmarks[386].y + landmarks[374].y) / 2;
                const rightEyeHeight = Math.abs(landmarks[374].y - landmarks[386].y) || 0.01;

                // Eye aspect ratio (open eye check)
                const leftEAR = leftEyeHeight / leftEyeWidth;
                const rightEAR = rightEyeHeight / rightEyeWidth;
                const isEyesOpen = leftEAR > 0.12 && rightEAR > 0.12;

                if (isEyesOpen && leftIris && rightIris) {
                  // Normalized displacement within eye socket [-1, 1]
                  const leftOffsetX = (leftIris.x - leftEyeCenterX) / (leftEyeWidth * 0.42);
                  const leftOffsetY = (leftIris.y - leftEyeCenterY) / (leftEyeHeight * 0.42);

                  const rightOffsetX = (rightIris.x - rightEyeCenterX) / (rightEyeWidth * 0.42);
                  const rightOffsetY = (rightIris.y - rightEyeCenterY) / (rightEyeHeight * 0.42);

                  const avgIrisX = (leftOffsetX + rightOffsetX) / 2;
                  const avgIrisY = (leftOffsetY + rightOffsetY) / 2;

                  // Eye position in webcam screen frame [-1, 1]
                  const eyeScreenX = -((leftEyeCenterX + rightEyeCenterX) / 2 - 0.5) * 2.0;
                  const eyeScreenY = ((leftEyeCenterY + rightEyeCenterY) / 2 - 0.5) * 2.0;

                  // Calibrated Gaze Fusion: Iris displacement (65%) + Eye Screen Position (35%)
                  const rawGazeX = -(avgIrisX * 0.65) + eyeScreenX * 0.35;
                  const rawGazeY = avgIrisY * 0.65 + eyeScreenY * 0.35;

                  const clampedX = Math.max(-1.0, Math.min(1.0, rawGazeX));
                  const clampedY = Math.max(-1.0, Math.min(1.0, rawGazeY));

                  targets.push({
                    source: 'iris',
                    point: { x: clampedX, y: clampedY },
                    confidence: 0.98,
                    timestamp: now,
                    metadata: {
                      irisLeft: { x: leftIris.x, y: leftIris.y },
                      irisRight: { x: rightIris.x, y: rightIris.y },
                      earLeft: leftEAR,
                      earRight: rightEAR,
                    },
                  });
                }
              }
            }
          } catch (fErr) {
            console.warn('[Vision] Eye tracking tick error:', fErr);
          }
        }

        // Arbitrate Attention (Eyes Only)
        const output = arbitratorRef.current.update(targets, now);
        setAttentionData(output);
        if (onAttentionUpdateRef.current) {
          onAttentionUpdateRef.current(output);
        }
      }

      animFrameRef.current = requestAnimationFrame(processVisionLoop);
    };

    animFrameRef.current = requestAnimationFrame(processVisionLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, isReady]);

  return {
    isLoading,
    isReady,
    error,
    cameraActive,
    attentionData,
    videoElement: videoRef.current,
    startCamera,
    stopCamera,
  };
}
