/// <reference lib="webworker" />

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarker: FaceLandmarker | null = null;

self.onmessage = async (event: MessageEvent) => {
  const message = event.data as
    | { type: "init"; wasmRoot: string; modelUrl: string }
    | { type: "frame"; frame: ImageBitmap; timestamp: number };

  if (message.type === "init") {
    try {
      const vision = await FilesetResolver.forVisionTasks(message.wasmRoot);
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: true,
      });
      const connections = Array.from(FaceLandmarker.FACE_LANDMARKS_TESSELATION, ({ start, end }) => ({ start, end }));
      self.postMessage({ type: "ready", connections });
    } catch {
      self.postMessage({ type: "error", message: "The on-device face mesh could not start." });
    }
    return;
  }

  if (message.type === "frame") {
    try {
      if (!landmarker) throw new Error("Face landmarker is not ready.");
      const result = landmarker.detectForVideo(message.frame, message.timestamp);
      const face = result.faceLandmarks[0];
      const blendshapes = result.faceBlendshapes[0]?.categories ?? [];
      self.postMessage({
        type: "result",
        timestamp: message.timestamp,
        landmarks: face?.map(({ x, y, z }) => [x, y, z]) ?? [],
        blendshapes: blendshapes.map(({ categoryName, score }) => ({ name: categoryName, score })),
      });
    } catch {
      self.postMessage({ type: "frame_error" });
    } finally {
      message.frame.close();
    }
  }
};

