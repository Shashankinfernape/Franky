import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { AttentionOutput, Point2D, VisionTarget } from '../types/vision';
import { AttentionArbitrator } from '../services/attentionArbitrator';
import { gazeCalibration } from '../services/gazeCalibration';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface UseVisionPerceptionOptions {
  enabled: boolean;
  forcedGaze?: Point2D | null;
  onAttentionUpdate?: (output: AttentionOutput) => void;
}

export function useVisionPerception(options: UseVisionPerceptionOptions) {
  const { enabled, forcedGaze = null, onAttentionUpdate } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attentionData, setAttentionData] = useState<AttentionOutput | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentPupilCamera, setCurrentPupilCamera] = useState<Point2D | null>(null);
  const [isThumbUp, setIsThumbUp] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const arbitratorRef = useRef<AttentionArbitrator>(new AttentionArbitrator());

  const animFrameRef = useRef<number | null>(null);
  const lastFaceTimeRef = useRef<number>(0);

  const onAttentionUpdateRef = useRef(onAttentionUpdate);
  onAttentionUpdateRef.current = onAttentionUpdate;

  const forcedGazeRef = useRef<Point2D | null>(forcedGaze);
  forcedGazeRef.current = forcedGaze;

  // Initialize MediaPipe FaceLandmarker with Iris Refinement (Fast GPU)
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
    setCurrentPupilCamera(null);
    setIsThumbUp(false);
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

  // High-Speed Robust Eye Tracking Loop (Direct Spatial Tracking)
  useEffect(() => {
    if (!cameraActive || !isReady) return;

    let isRunning = true;

    const processVisionLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = performance.now();

      // If calibration studio is forcing a reference gaze, emit that directly
      if (forcedGazeRef.current) {
        const output: AttentionOutput = {
          state: 'EYES_LOCKED',
          targetPoint: forcedGazeRef.current,
          smoothedPoint: forcedGazeRef.current,
          activeSource: 'iris',
          confidence: 1.0,
        };
        setAttentionData(output);
        if (onAttentionUpdateRef.current) {
          onAttentionUpdateRef.current(output);
        }
      }

      if (video && video.readyState >= 2 && !video.paused) {
        const targets: VisionTarget[] = [];

        if (faceLandmarkerRef.current && now - lastFaceTimeRef.current >= 20) {
          lastFaceTimeRef.current = now;
          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              const landmarks = faceResult.faceLandmarks[0];

              // Iris Landmarks: 468 (Left Iris), 473 (Right Iris)
              // Nose Bridge Anchor: 168
              const hasIris = landmarks.length >= 478;

              if (hasIris) {
                const leftIris = landmarks[468];
                const rightIris = landmarks[473];
                const noseBridge = landmarks[168] || {
                  x: (leftIris.x + rightIris.x) / 2,
                  y: (leftIris.y + rightIris.y) / 2,
                };

                // Exact physical pupil midpoint in camera frustum [0, 1]
                const pupilMidX = (leftIris.x + rightIris.x) * 0.4 + noseBridge.x * 0.2;
                const pupilMidY = (leftIris.y + rightIris.y) * 0.4 + noseBridge.y * 0.2;

                setCurrentPupilCamera({ x: pupilMidX, y: pupilMidY });

                // Apply Direct Correct Spatial Mapping
                const calibratedGaze = gazeCalibration.mapCameraToScreenGaze({
                  x: pupilMidX,
                  y: pupilMidY,
                });

                targets.push({
                  source: 'iris',
                  point: calibratedGaze,
                  confidence: 0.99,
                  timestamp: now,
                  metadata: {
                    irisLeft: { x: leftIris.x, y: leftIris.y },
                    irisRight: { x: rightIris.x, y: rightIris.y },
                  },
                });
              }
            } else {
              setCurrentPupilCamera(null);
            }
          } catch (fErr) {
            console.warn('[Vision] Detection tick error:', fErr);
          }
        }

        // Only update arbitrator when not in forced calibration gaze mode
        if (!forcedGazeRef.current) {
          const output = arbitratorRef.current.update(targets, now);
          setAttentionData(output);
          if (onAttentionUpdateRef.current) {
            onAttentionUpdateRef.current(output);
          }
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

  const recalibrateBaseline = useCallback(() => {
    gazeCalibration.resetToDefault();
    arbitratorRef.current.reset();
  }, []);

  return {
    isLoading,
    isReady,
    error,
    cameraActive,
    attentionData,
    currentPupilCamera,
    isThumbUp,
    videoElement: videoRef.current,
    startCamera,
    stopCamera,
    recalibrateBaseline,
  };
}
