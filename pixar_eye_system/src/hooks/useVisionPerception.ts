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

  // Direct Human Mutual Eye-Contact Tracking Loop
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
                  // Physical 3D location of the user's pupils in the camera frustum
                  const pupilMidX = (leftIris.x + rightIris.x) / 2;
                  const pupilMidY = (leftIris.y + rightIris.y) / 2;

                  // Nose bridge anchor (landmark 168 / 6) between eyes
                  const bridgeX = landmarks[168]?.x ?? pupilMidX;
                  const bridgeY = landmarks[168]?.y ?? pupilMidY;

                  // Inter-pupil distance (depth / scale factor)
                  const pupilDistance = Math.abs(rightIris.x - leftIris.x) || 0.08;
                  const depthFactor = Math.max(0.7, Math.min(1.4, 0.12 / pupilDistance));

                  // 1. Direct Line-of-Sight X (Screen Horizontal Alignment):
                  // Camera center is at X = 0.50.
                  // When user is to the Left (X < 0.5), character turns pupils Left to lock with user's eyes.
                  // When user is to the Right (X > 0.5), character turns pupils Right.
                  const eyeGazeX = (pupilMidX * 0.7 + bridgeX * 0.3 - 0.5) * 1.85 * depthFactor;

                  // 2. Direct Line-of-Sight Y (Vertical Eye-Level Alignment):
                  // Webcam is mounted at top bezel. Human eyes naturally sit at Y ~ 0.38 when looking at screen.
                  // This calibrated baseline ensures 0.0 vertical gaze when looking directly into the screen.
                  const eyeGazeY = (pupilMidY * 0.7 + bridgeY * 0.3 - 0.38) * 2.10 * depthFactor;

                  const clampedX = Math.max(-1.0, Math.min(1.0, eyeGazeX));
                  const clampedY = Math.max(-1.0, Math.min(1.0, eyeGazeY));

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

        // Arbitrate Attention (Mutual Eye Contact)
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
