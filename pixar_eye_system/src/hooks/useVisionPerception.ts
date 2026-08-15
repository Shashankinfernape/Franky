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

  // Adaptive Vertical Baseline Auto-Calibrator (Mona Lisa Eye Level)
  const baselineYRef = useRef<number>(0.44);
  const isBaselineCalibratedRef = useRef<boolean>(false);
  const sampleCountRef = useRef<number>(0);

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
      // Reset baseline calibration on new camera session
      isBaselineCalibratedRef.current = false;
      sampleCountRef.current = 0;
      baselineYRef.current = 0.44;
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

  // Recalibrate eye baseline manually or automatically
  const recalibrateBaseline = useCallback(() => {
    isBaselineCalibratedRef.current = false;
    sampleCountRef.current = 0;
  }, []);

  // Main Mona-Lisa Direct Eye Contact Tracking Loop
  useEffect(() => {
    if (!cameraActive || !isReady) return;

    let isRunning = true;

    const processVisionLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = performance.now();

      if (video && video.readyState >= 2 && !video.paused) {
        const targets: VisionTarget[] = [];

        // High-Precision Eye Tracking Tick (~30-60 FPS)
        if (faceLandmarkerRef.current && now - lastFaceTimeRef.current >= 24) {
          lastFaceTimeRef.current = now;
          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              const landmarks = faceResult.faceLandmarks[0];

              // Key Iris & Eye Landmarks
              // Left Iris: 468, Right Iris: 473
              // Left Eyelids: Top 159, Bottom 145, Inner 133, Outer 33
              // Right Eyelids: Top 386, Bottom 374, Inner 362, Outer 263
              // Inter-Eye Nose Bridge: 168 / 6

              const hasIris = landmarks.length >= 478;

              if (hasIris) {
                const leftIris = landmarks[468];
                const rightIris = landmarks[473];

                const leftEyeWidth = Math.abs(landmarks[133].x - landmarks[33].x) || 0.01;
                const leftEyeHeight = Math.abs(landmarks[145].y - landmarks[159].y) || 0.01;

                const rightEyeWidth = Math.abs(landmarks[263].x - landmarks[362].x) || 0.01;
                const rightEyeHeight = Math.abs(landmarks[374].y - landmarks[386].y) || 0.01;

                const leftEAR = leftEyeHeight / leftEyeWidth;
                const rightEAR = rightEyeHeight / rightEyeWidth;
                const isEyesOpen = leftEAR > 0.10 && rightEAR > 0.10;

                if (isEyesOpen && leftIris && rightIris) {
                  // Physical 3D pupil midpoint
                  const pupilMidX = (leftIris.x + rightIris.x) / 2;
                  const pupilMidY = (leftIris.y + rightIris.y) / 2;

                  // Adaptive Baseline Calibration (learns user's sitting eye height over first 30 frames)
                  if (!isBaselineCalibratedRef.current) {
                    sampleCountRef.current++;
                    baselineYRef.current =
                      baselineYRef.current * 0.85 + pupilMidY * 0.15;
                    if (sampleCountRef.current > 35) {
                      isBaselineCalibratedRef.current = true;
                    }
                  }

                  // Inter-pupil distance in camera frame for depth scaling
                  const pupilDistance = Math.abs(rightIris.x - leftIris.x) || 0.08;
                  const depthFactor = Math.max(0.75, Math.min(1.35, 0.11 / pupilDistance));

                  // 1. HORIZONTAL TRAJECTORY (Natural Selfie Alignment):
                  // In camera: moving to user's RIGHT produces pupilMidX < 0.5.
                  // Negative sign ensures when you move RIGHT, Franky turns eyes to the RIGHT to look into your eyes!
                  // When you move LEFT, Franky turns eyes to the LEFT!
                  const rawGazeX = -(pupilMidX - 0.5) * 1.95 * depthFactor;

                  // 2. VERTICAL TRAJECTORY (Mona Lisa Eye Contact):
                  // Difference from user's calibrated eye level + upward compensation (-0.22)
                  // to place pupils dead-center in Franky's eye socket when looking at screen!
                  const deltaY = (pupilMidY - baselineYRef.current) * 2.2 * depthFactor;
                  const rawGazeY = deltaY - 0.18;

                  const clampedX = Math.max(-1.0, Math.min(1.0, rawGazeX));
                  const clampedY = Math.max(-1.0, Math.min(1.0, rawGazeY));

                  targets.push({
                    source: 'iris',
                    point: { x: clampedX, y: clampedY },
                    confidence: 0.99,
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

        // Arbitrate Attention (Mona Lisa Direct Eye Contact)
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
    recalibrateBaseline,
  };
}
