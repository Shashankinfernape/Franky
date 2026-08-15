import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { AttentionOutput, VisionTarget } from '../types/vision';
import { MotionSaliencyDetector } from '../services/motionSaliency';
import { AttentionArbitrator } from '../services/attentionArbitrator';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface UseVisionPerceptionOptions {
  enabled: boolean;
  enablePose?: boolean;
  enableCuriosity?: boolean;
  curiositySensitivity?: number; // 0.0 to 1.0
  onAttentionUpdate?: (output: AttentionOutput) => void;
}

export function useVisionPerception(options: UseVisionPerceptionOptions) {
  const {
    enabled,
    enablePose = true,
    enableCuriosity = true,
    curiositySensitivity = 0.5,
    onAttentionUpdate,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attentionData, setAttentionData] = useState<AttentionOutput | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const motionDetectorRef = useRef<MotionSaliencyDetector | null>(null);
  const arbitratorRef = useRef<AttentionArbitrator>(new AttentionArbitrator());

  const animFrameRef = useRef<number | null>(null);
  const lastFaceTimeRef = useRef<number>(0);
  const lastPoseTimeRef = useRef<number>(0);
  const lastMotionTimeRef = useRef<number>(0);

  const onAttentionUpdateRef = useRef(onAttentionUpdate);
  onAttentionUpdateRef.current = onAttentionUpdate;

  // Initialize MediaPipe Models
  useEffect(() => {
    let isCancelled = false;

    async function initVision() {
      if (!enabled) return;
      setIsLoading(true);
      setError(null);

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (isCancelled) return;

        // Initialize FaceLandmarker with Iris refinement & Blendshapes
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

        // Initialize PoseLandmarker
        if (enablePose) {
          try {
            const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: POSE_MODEL_URL,
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numPoses: 1,
            });
            if (!isCancelled) {
              poseLandmarkerRef.current = poseLandmarker;
            }
          } catch (poseErr) {
            console.warn('[Vision] PoseLandmarker failed, continuing with Face only:', poseErr);
          }
        }

        motionDetectorRef.current = new MotionSaliencyDetector();
        setIsReady(true);
        setIsLoading(false);
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('[Vision] Failed to initialize MediaPipe models:', err);
          setError(err instanceof Error ? err.message : 'Failed to load vision models');
          setIsLoading(false);
        }
      }
    }

    initVision();

    return () => {
      isCancelled = true;
    };
  }, [enabled, enablePose]);

  // Adjust curiosity threshold based on sensitivity slider
  useEffect(() => {
    // sensitivity 1.0 -> threshold 0.45 (very curious), sensitivity 0.0 -> threshold 0.85 (rarely distracted)
    const threshold = 0.85 - curiositySensitivity * 0.40;
    arbitratorRef.current.setConfig({ curiosityThreshold: threshold });
  }, [curiositySensitivity]);

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

  // Auto-start camera when enabled and models ready
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

  // Main Multi-Modal Perception & Vision Scheduler Loop
  useEffect(() => {
    if (!cameraActive || !isReady) return;

    let isRunning = true;

    const processVisionLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = performance.now();

      if (video && video.readyState >= 2 && !video.paused) {
        const targets: VisionTarget[] = [];
        let humanBoundingBox: { minX: number; maxX: number; minY: number; maxY: number } | undefined;

        // 1. FACE & IRIS TRACKING (~30 FPS: every 30ms)
        if (faceLandmarkerRef.current && now - lastFaceTimeRef.current >= 30) {
          lastFaceTimeRef.current = now;
          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              const landmarks = faceResult.faceLandmarks[0];

              const nose = landmarks[1];
              const forehead = landmarks[10];
              const chin = landmarks[152];
              const leftEar = landmarks[234];
              const rightEar = landmarks[454];

              // Face center in normalized camera coords [0, 1]
              const faceCenterX = (nose.x + forehead.x + chin.x) / 3;
              const faceCenterY = (nose.y + forehead.y + chin.y) / 3;

              // Mirrored for user selfie camera: left is +X, right is -X
              const mirroredFaceX = -(faceCenterX - 0.5) * 2.0;
              const mirroredFaceY = (faceCenterY - 0.5) * 2.0;

              // Bounding box for motion masking
              const xs = landmarks.map((l) => l.x);
              const ys = landmarks.map((l) => l.y);
              humanBoundingBox = {
                minX: Math.max(0, Math.min(...xs) - 0.05),
                maxX: Math.min(1, Math.max(...xs) + 0.05),
                minY: Math.max(0, Math.min(...ys) - 0.05),
                maxY: Math.min(1, Math.max(...ys) + 0.05),
              };

              // Head Pose Euler Approximation
              const earMidX = (leftEar.x + rightEar.x) / 2;
              const earDist = Math.abs(rightEar.x - leftEar.x) || 0.01;
              const headYaw = (nose.x - earMidX) / earDist;

              const faceMidY = (forehead.y + chin.y) / 2;
              const faceHeight = Math.abs(chin.y - forehead.y) || 0.01;
              const headPitch = (nose.y - faceMidY) / faceHeight;

              // Check if Iris landmarks exist (Landmarks 468–477)
              const hasIris = landmarks.length >= 478;
              let irisConfidence = 0.0;
              let irisGazeX = 0;
              let irisGazeY = 0;

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

                // Eye aspect ratio (blink / squint detection)
                const leftEAR = leftEyeHeight / leftEyeWidth;
                const rightEAR = rightEyeHeight / rightEyeWidth;
                const isOpen = leftEAR > 0.14 && rightEAR > 0.14;

                if (isOpen) {
                  // Normalized displacement within eye socket [-1, 1]
                  const leftOffsetX = (leftIris.x - leftEyeCenterX) / (leftEyeWidth * 0.45);
                  const leftOffsetY = (leftIris.y - leftEyeCenterY) / (leftEyeHeight * 0.45);

                  const rightOffsetX = (rightIris.x - rightEyeCenterX) / (rightEyeWidth * 0.45);
                  const rightOffsetY = (rightIris.y - rightEyeCenterY) / (rightEyeHeight * 0.45);

                  const avgOffsetX = (leftOffsetX + rightOffsetX) / 2;
                  const avgOffsetY = (leftOffsetY + rightOffsetY) / 2;

                  // Blend Iris (70%) with Head Pose (30%) for realistic calibrated eye tracking
                  const fusedX = -(avgOffsetX * 0.65 + headYaw * 0.35 + mirroredFaceX * 0.4);
                  const fusedY = avgOffsetY * 0.65 + headPitch * 0.35 + mirroredFaceY * 0.4;

                  irisGazeX = Math.max(-1.0, Math.min(1.0, fusedX));
                  irisGazeY = Math.max(-1.0, Math.min(1.0, fusedY));
                  irisConfidence = 0.95;

                  targets.push({
                    source: 'iris',
                    point: { x: irisGazeX, y: irisGazeY },
                    confidence: irisConfidence,
                    timestamp: now,
                    metadata: {
                      headEuler: { yaw: headYaw, pitch: headPitch, roll: 0 },
                    },
                  });
                }
              }

              // Face Trajectory Target (Fallback / Base)
              const faceGazeX = Math.max(-1.0, Math.min(1.0, mirroredFaceX - headYaw * 0.5));
              const faceGazeY = Math.max(-1.0, Math.min(1.0, mirroredFaceY + headPitch * 0.5));
              targets.push({
                source: 'face',
                point: { x: faceGazeX, y: faceGazeY },
                confidence: 0.85,
                timestamp: now,
                metadata: {
                  headEuler: { yaw: headYaw, pitch: headPitch, roll: 0 },
                },
              });
            }
          } catch (fErr) {
            console.warn('[Vision] Face tracking tick error:', fErr);
          }
        }

        // 2. POSE & BODY TRACKING (~15 FPS: every 65ms)
        if (enablePose && poseLandmarkerRef.current && now - lastPoseTimeRef.current >= 65) {
          lastPoseTimeRef.current = now;
          try {
            const poseResult = poseLandmarkerRef.current.detectForVideo(video, now);
            if (poseResult.landmarks && poseResult.landmarks.length > 0) {
              const pLandmarks = poseResult.landmarks[0];
              const leftShoulder = pLandmarks[11];
              const rightShoulder = pLandmarks[12];
              const nose = pLandmarks[0];

              if (leftShoulder && rightShoulder) {
                const bodyCenterX = (leftShoulder.x + rightShoulder.x + (nose?.x ?? 0.5)) / 3;
                const bodyCenterY = (leftShoulder.y + rightShoulder.y + (nose?.y ?? 0.5)) / 3;

                const mirroredBodyX = -(bodyCenterX - 0.5) * 2.0;
                const mirroredBodyY = (bodyCenterY - 0.5) * 2.0;

                targets.push({
                  source: 'body',
                  point: {
                    x: Math.max(-1.0, Math.min(1.0, mirroredBodyX)),
                    y: Math.max(-1.0, Math.min(1.0, mirroredBodyY)),
                  },
                  confidence: 0.75,
                  timestamp: now,
                });
              }
            }
          } catch (pErr) {
            console.warn('[Vision] Pose tracking tick error:', pErr);
          }
        }

        // 3. ROOM MOTION SALIENCY (~12 FPS: every 80ms)
        if (enableCuriosity && motionDetectorRef.current && now - lastMotionTimeRef.current >= 80) {
          lastMotionTimeRef.current = now;
          try {
            const currentGaze = attentionData?.smoothedPoint ?? { x: 0, y: 0 };
            const motionTarget = motionDetectorRef.current.processFrame(
              video,
              currentGaze,
              humanBoundingBox
            );
            if (motionTarget) {
              targets.push(motionTarget);
            }
          } catch (mErr) {
            console.warn('[Vision] Motion saliency tick error:', mErr);
          }
        }

        // 4. ARBITRATE ATTENTION
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
  }, [cameraActive, isReady, enablePose, enableCuriosity, attentionData?.smoothedPoint]);

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
