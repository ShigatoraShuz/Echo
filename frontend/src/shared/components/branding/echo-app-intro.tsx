"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";

import styles from "./echo-app-intro.module.css";

const SESSION_KEY = "echo.app-intro.seen";

const INTRO_SOUND_URL = new URL(
  "./litesaturation-short-logo-108964.mp3",
  import.meta.url,
).toString();

const WELCOME_EXIT_MS = 420;

const DRAW_DURATION_MS = 2950;
const CAMERA_DURATION_MS = 4400;

const RIPPLE_START_MS = 4420;

const FULL_EXIT_START_MS = 5200;
const FULL_INTRO_DURATION_MS = 5900;

const REDUCED_EXIT_START_MS = 420;
const REDUCED_INTRO_DURATION_MS = 700;

const SOUND_VOLUME = 0.32;

type CameraFrame = {
  t: number;
  x: number;
  y: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  follow: number;
  focus: number;
  dof: number;
};

type IntroAudio = {
  prepare: () => Promise<void>;
  unlock: () => void;
  start: () => Promise<boolean>;
  dispose: () => void;
};

const CAMERA_FRAMES: CameraFrame[] = [
  {
    t: 0,
    x: -28,
    y: 26,
    scale: 3.35,
    rotateX: 21,
    rotateY: -62,
    rotateZ: -8,
    follow: 0.92,
    focus: 0.04,
    dof: 1,
  },
  {
    t: 0.1,
    x: -15,
    y: 10,
    scale: 3.9,
    rotateX: 13,
    rotateY: -48,
    rotateZ: -5,
    follow: 1,
    focus: 0.04,
    dof: 1,
  },
  {
    t: 0.21,
    x: 8,
    y: -7,
    scale: 3.65,
    rotateX: -3,
    rotateY: -16,
    rotateZ: 2,
    follow: 0.98,
    focus: 0.14,
    dof: 0.94,
  },
  {
    t: 0.33,
    x: 22,
    y: 8,
    scale: 3.7,
    rotateX: 10,
    rotateY: 38,
    rotateZ: 6,
    follow: 0.99,
    focus: 0.82,
    dof: 1,
  },
  {
    t: 0.46,
    x: 13,
    y: -12,
    scale: 3.25,
    rotateX: -12,
    rotateY: 63,
    rotateZ: 5,
    follow: 0.94,
    focus: 0.93,
    dof: 0.94,
  },
  {
    t: 0.59,
    x: -13,
    y: -18,
    scale: 2.72,
    rotateX: -25,
    rotateY: 28,
    rotateZ: -3,
    follow: 0.74,
    focus: 0.55,
    dof: 0.72,
  },
  {
    t: 0.7,
    x: -12,
    y: 5,
    scale: 2.1,
    rotateX: 9,
    rotateY: -35,
    rotateZ: -4,
    follow: 0.5,
    focus: 0.15,
    dof: 0.46,
  },
  {
    t: 0.81,
    x: 8,
    y: -5,
    scale: 1.55,
    rotateX: -7,
    rotateY: 17,
    rotateZ: 1,
    follow: 0.2,
    focus: 0.5,
    dof: 0.18,
  },
  {
    t: 0.91,
    x: -3,
    y: 1,
    scale: 1.14,
    rotateX: 3,
    rotateY: -6,
    rotateZ: -0.5,
    follow: 0,
    focus: 0.5,
    dof: 0,
  },
  {
    t: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    follow: 0,
    focus: 0.5,
    dof: 0,
  },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function smoothstep(value: number) {
  const x = clamp01(value);

  return x * x * (3 - 2 * x);
}

function easeInOutSine(value: number) {
  const x = clamp01(value);

  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
) {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleCamera(progress: number): Omit<CameraFrame, "t"> {
  const p = clamp01(progress);

  let segmentIndex = CAMERA_FRAMES.length - 2;

  for (let index = 0; index < CAMERA_FRAMES.length - 1; index += 1) {
    if (
      p >= CAMERA_FRAMES[index].t &&
      p <= CAMERA_FRAMES[index + 1].t
    ) {
      segmentIndex = index;
      break;
    }
  }

  const previous =
    CAMERA_FRAMES[Math.max(0, segmentIndex - 1)];

  const current =
    CAMERA_FRAMES[segmentIndex];

  const next =
    CAMERA_FRAMES[segmentIndex + 1];

  const after =
    CAMERA_FRAMES[
      Math.min(
        CAMERA_FRAMES.length - 1,
        segmentIndex + 2,
      )
    ];

  const segmentDuration =
    next.t - current.t;

  const localProgress =
    segmentDuration <= 0
      ? 0
      : clamp01(
          (p - current.t) /
            segmentDuration,
        );

  const sample = (
    key: keyof Omit<CameraFrame, "t">,
  ) =>
    catmullRom(
      previous[key],
      current[key],
      next[key],
      after[key],
      localProgress,
    );

  return {
    x: sample("x"),
    y: sample("y"),
    scale: sample("scale"),
    rotateX: sample("rotateX"),
    rotateY: sample("rotateY"),
    rotateZ: sample("rotateZ"),
    follow: sample("follow"),
    focus: sample("focus"),
    dof: sample("dof"),
  };
}

/* =========================================================
   AUDIO
   ========================================================= */

function createIntroAudio(): IntroAudio | null {
  if (
    typeof window === "undefined" ||
    typeof window.AudioContext === "undefined"
  ) {
    return null;
  }

  let context: AudioContext;

  try {
    context = new window.AudioContext({
      latencyHint: "interactive",
    });
  } catch {
    return null;
  }

  let disposed = false;
  let playbackStarted = false;

  let activeSource:
    | AudioBufferSourceNode
    | null = null;

  const gain =
    context.createGain();

  gain.gain.value = 0;

  gain.connect(
    context.destination,
  );

  /*
   * Starts loading immediately while
   * the therapeutic welcome screen
   * is being viewed.
   */
  const bufferPromise:
    Promise<AudioBuffer | null> =
    fetch(INTRO_SOUND_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load intro audio: ${response.status}`,
          );
        }

        return response.arrayBuffer();
      })
      .then((arrayBuffer) =>
        context.decodeAudioData(
          arrayBuffer,
        ),
      )
      .catch(() => null);

  async function prepare() {
    await bufferPromise;
  }

  function unlock() {
    if (disposed) {
      return;
    }

    if (
      context.state ===
      "suspended"
    ) {
      /*
       * Called directly from the user's
       * real click/tap/key interaction.
       */
      void context
        .resume()
        .catch(() => {});
    }
  }

  async function start() {
    if (
      disposed ||
      playbackStarted
    ) {
      return false;
    }

    if (
      context.state ===
      "suspended"
    ) {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    if (
      context.state !==
      "running"
    ) {
      return false;
    }

    const buffer =
      await bufferPromise;

    if (
      disposed ||
      !buffer ||
      playbackStarted
    ) {
      return false;
    }

    const source =
      context.createBufferSource();

    source.buffer =
      buffer;

    activeSource =
      source;

    source.connect(
      gain,
    );

    const audioStartTime =
      context.currentTime;

    const usableDuration =
      Math.min(
        buffer.duration,
        FULL_INTRO_DURATION_MS /
          1000,
      );

    gain.gain.cancelScheduledValues(
      audioStartTime,
    );

    gain.gain.setValueAtTime(
      0.0001,
      audioStartTime,
    );

    gain.gain.linearRampToValueAtTime(
      SOUND_VOLUME,
      audioStartTime +
        0.018,
    );

    if (
      usableDuration <
      buffer.duration -
        0.03
    ) {
      const fadeDuration =
        Math.min(
          0.2,
          usableDuration *
            0.25,
        );

      const fadeStart =
        audioStartTime +
        Math.max(
          0,
          usableDuration -
            fadeDuration,
        );

      gain.gain.setValueAtTime(
        SOUND_VOLUME,
        fadeStart,
      );

      gain.gain.linearRampToValueAtTime(
        0.0001,
        audioStartTime +
          usableDuration,
      );
    }

    try {
      /*
       * Always play from the actual
       * beginning of the MP3.
       */
      source.start(
        audioStartTime,
        0,
      );

      if (
        usableDuration <
        buffer.duration
      ) {
        source.stop(
          audioStartTime +
            usableDuration +
            0.02,
        );
      }

      playbackStarted = true;

      return true;
    } catch {
      activeSource = null;

      return false;
    }
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;

    try {
      gain.gain.cancelScheduledValues(
        context.currentTime,
      );

      gain.gain.setTargetAtTime(
        0.0001,
        context.currentTime,
        0.015,
      );
    } catch {
      // Context already closed.
    }

    try {
      activeSource?.stop(
        context.currentTime +
          0.06,
      );
    } catch {
      // Source already ended.
    }

    window.setTimeout(
      () => {
        void context
          .close()
          .catch(() => {});
      },
      80,
    );
  }

  return {
    prepare,
    unlock,
    start,
    dispose,
  };
}

/* =========================================================
   COMPONENT
   ========================================================= */

export function EchoAppIntro() {
  const [
    isVisible,
    setIsVisible,
  ] = useState(true);

  const [
    hasIntroStarted,
    setHasIntroStarted,
  ] = useState(false);

  const [
    isStartingJourney,
    setIsStartingJourney,
  ] = useState(false);

  const [
    isLeaving,
    setIsLeaving,
  ] = useState(false);

  const [
    isRippling,
    setIsRippling,
  ] = useState(false);

  const introRef =
    useRef<HTMLDivElement>(
      null,
    );

  const atmosphereRef =
    useRef<HTMLDivElement>(
      null,
    );

  const cameraSceneRef =
    useRef<HTMLDivElement>(
      null,
    );

  const cameraRef =
    useRef<HTMLDivElement>(
      null,
    );

  const focusRigRef =
    useRef<HTMLDivElement>(
      null,
    );

  const markRef =
    useRef<HTMLDivElement>(
      null,
    );

  const leafRef =
    useRef<SVGSVGElement>(
      null,
    );

  const glowLeafRef =
    useRef<SVGSVGElement>(
      null,
    );

  const depthStackRef =
    useRef<HTMLDivElement>(
      null,
    );

  const audioRef =
    useRef<IntroAudio | null>(
      null,
    );

  const startTimelineRef =
    useRef<
      (() => void) | null
    >(null);

  const timelineStartedRef =
    useRef(false);

  const journeyStartedRef =
    useRef(false);

  const journeyStartTimerRef =
    useRef<
      number | undefined
    >(undefined);

  useEffect(() => {
    const root =
      document.documentElement;

    let alreadySeen =
      root.dataset.echoIntro ===
      "seen";

    try {
      alreadySeen =
        alreadySeen ||
        window.sessionStorage.getItem(
          SESSION_KEY,
        ) === "1";
    } catch {
      // Intro can still run.
    }

    if (alreadySeen) {
      setIsVisible(false);

      return;
    }

    root.dataset.echoIntro =
      "playing";

    timelineStartedRef.current =
      false;

    journeyStartedRef.current =
      false;

    setHasIntroStarted(false);
    setIsStartingJourney(false);
    setIsLeaving(false);
    setIsRippling(false);

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    let disposed = false;

    let animationFrame = 0;

    let rippleTimer:
      | number
      | undefined;

    let exitTimer:
      | number
      | undefined;

    let finishTimer:
      | number
      | undefined;

    const soundtrack =
      prefersReducedMotion
        ? null
        : createIntroAudio();

    audioRef.current =
      soundtrack;

    /*
     * The MP3 loads while the user is
     * reading the welcome screen.
     */
    void soundtrack?.prepare();

    function startVisualTimeline() {
      if (
        disposed ||
        timelineStartedRef.current
      ) {
        return;
      }

      timelineStartedRef.current =
        true;

      setHasIntroStarted(
        true,
      );

      const animationStartedAt =
        performance.now();

      if (
        !prefersReducedMotion
      ) {
        const mainPaths =
          Array.from(
            leafRef.current?.querySelectorAll(
              "path",
            ) ?? [],
          ) as SVGPathElement[];

        const glowPaths =
          Array.from(
            glowLeafRef.current?.querySelectorAll(
              "path",
            ) ?? [],
          ) as SVGPathElement[];

        const depthPaths =
          Array.from(
            depthStackRef.current?.querySelectorAll(
              "path",
            ) ?? [],
          ) as SVGPathElement[];

        const mainLengths =
          mainPaths.map(
            (path) =>
              path.getTotalLength(),
          );

        const initializePath = (
          path: SVGPathElement,
          length: number,
        ) => {
          path.style.strokeDasharray =
            `${length} ${length}`;

          path.style.strokeDashoffset =
            `${length}`;
        };

        if (
          mainLengths.length > 0
        ) {
          mainPaths.forEach(
            (path, index) => {
              initializePath(
                path,
                mainLengths[index],
              );

              path.style.opacity =
                "1";
            },
          );

          glowPaths.forEach(
            (path, index) => {
              const sourceIndex =
                index %
                mainLengths.length;

              initializePath(
                path,
                mainLengths[
                  sourceIndex
                ],
              );

              path.style.opacity =
                "0";
            },
          );

          depthPaths.forEach(
            (path, index) => {
              const sourceIndex =
                index %
                mainLengths.length;

              initializePath(
                path,
                mainLengths[
                  sourceIndex
                ],
              );

              path.style.opacity =
                "1";
            },
          );
        }

        let previousFrameTime =
          animationStartedAt;

        let filteredTipX = 0;
        let filteredTipY = 0;

        const animate = (
          now: number,
        ) => {
          const elapsed =
            now -
            animationStartedAt;

          const frameDelta =
            Math.min(
              50,
              now -
                previousFrameTime,
            );

          previousFrameTime =
            now;

          const cameraProgress =
            clamp01(
              elapsed /
                CAMERA_DURATION_MS,
            );

          const camera =
            sampleCamera(
              cameraProgress,
            );

          const rawDrawProgress =
            clamp01(
              elapsed /
                DRAW_DURATION_MS,
            );

          const drawProgress =
            easeInOutSine(
              rawDrawProgress,
            );

          mainPaths.forEach(
            (path, index) => {
              const length =
                mainLengths[index];

              path.style.strokeDashoffset =
                `${
                  length *
                  (1 -
                    drawProgress)
                }`;
            },
          );

          depthPaths.forEach(
            (path, index) => {
              const sourceIndex =
                index %
                mainLengths.length;

              const length =
                mainLengths[
                  sourceIndex
                ];

              path.style.strokeDashoffset =
                `${
                  length *
                  (1 -
                    drawProgress)
                }`;
            },
          );

          const glowOpacity =
            Math.sin(
              Math.PI *
                rawDrawProgress,
            ) * 0.23;

          glowPaths.forEach(
            (path, index) => {
              const sourceIndex =
                index %
                mainLengths.length;

              const length =
                mainLengths[
                  sourceIndex
                ];

              path.style.strokeDashoffset =
                `${
                  length *
                  (1 -
                    drawProgress)
                }`;

              path.style.opacity =
                `${Math.max(
                  0,
                  glowOpacity,
                )}`;
            },
          );

          if (
            mainPaths.length >=
              2 &&
            mainLengths.length >=
              2
          ) {
            const leafPoint =
              mainPaths[0]
                .getPointAtLength(
                  mainLengths[0] *
                    drawProgress,
                );

            const stemPoint =
              mainPaths[1]
                .getPointAtLength(
                  mainLengths[1] *
                    drawProgress,
                );

            const focusX =
              lerp(
                leafPoint.x,
                stemPoint.x,
                clamp01(
                  camera.focus,
                ),
              );

            const focusY =
              lerp(
                leafPoint.y,
                stemPoint.y,
                clamp01(
                  camera.focus,
                ),
              );

            const markSize =
              markRef.current
                ?.offsetWidth ??
              180;

            const visualLeafSize =
              markSize * 0.48;

            const rawTipX =
              ((focusX - 12) /
                24) *
              visualLeafSize;

            const rawTipY =
              ((focusY - 12) /
                24) *
              visualLeafSize;

            const damping =
              1 -
              Math.exp(
                -frameDelta / 82,
              );

            filteredTipX +=
              (rawTipX -
                filteredTipX) *
              damping;

            filteredTipY +=
              (rawTipY -
                filteredTipY) *
              damping;

            const follow =
              clamp01(
                camera.follow,
              );

            const scale =
              Math.max(
                0.9,
                camera.scale,
              );

            const tipTranslateX =
              -filteredTipX *
              scale *
              follow;

            const tipTranslateY =
              -filteredTipY *
              scale *
              follow;

            if (
              focusRigRef.current
            ) {
              focusRigRef.current.style.transform = `
                translate3d(
                  ${(
                    camera.x +
                    tipTranslateX
                  ).toFixed(2)}px,
                  ${(
                    camera.y +
                    tipTranslateY
                  ).toFixed(2)}px,
                  0px
                )
                scale(
                  ${scale.toFixed(4)}
                )
              `;
            }
          }

          if (
            cameraRef.current
          ) {
            cameraRef.current.style.transform = `
              rotateX(
                ${camera.rotateX.toFixed(
                  2,
                )}deg
              )
              rotateY(
                ${camera.rotateY.toFixed(
                  2,
                )}deg
              )
              rotateZ(
                ${camera.rotateZ.toFixed(
                  2,
                )}deg
              )
            `;
          }

          if (
            cameraSceneRef.current
          ) {
            const perspectiveX =
              Math.min(
                57,
                Math.max(
                  43,
                  50 -
                    camera.rotateY *
                      0.1,
                ),
              );

            const perspectiveY =
              Math.min(
                53,
                Math.max(
                  42,
                  47 +
                    camera.rotateX *
                      0.08,
                ),
              );

            cameraSceneRef.current.style.perspectiveOrigin =
              `${perspectiveX.toFixed(
                2,
              )}% ${perspectiveY.toFixed(
                2,
              )}%`;
          }

          const discProgress =
            smoothstep(
              clamp01(
                (elapsed - 800) /
                  1800,
              ),
            );

          const wordProgress =
            smoothstep(
              clamp01(
                (elapsed -
                  3150) /
                  650,
              ),
            );

          const specularProgress =
            clamp01(
              (elapsed -
                2750) /
                1200,
            );

          const specularOpacity =
            Math.sin(
              Math.PI *
                specularProgress,
            ) * 0.46;

          const specularX =
            lerp(
              -140,
              140,
              specularProgress,
            );

          const dof =
            Math.max(
              0,
              camera.dof,
            );

          const sideStrength =
            clamp01(
              Math.abs(
                camera.rotateY,
              ) / 63,
            );

          if (
            introRef.current
          ) {
            introRef.current.style.setProperty(
              "--disc-opacity",
              discProgress.toFixed(
                4,
              ),
            );

            introRef.current.style.setProperty(
              "--disc-scale",
              lerp(
                0.94,
                1,
                discProgress,
              ).toFixed(4),
            );

            introRef.current.style.setProperty(
              "--disc-blur",
              `${lerp(
                3.2,
                dof * 0.75,
                discProgress,
              ).toFixed(2)}px`,
            );

            introRef.current.style.setProperty(
              "--word-opacity",
              wordProgress.toFixed(
                4,
              ),
            );

            introRef.current.style.setProperty(
              "--word-y",
              `${lerp(
                14,
                0,
                wordProgress,
              ).toFixed(2)}px`,
            );

            introRef.current.style.setProperty(
              "--word-blur",
              `${lerp(
                11,
                0,
                wordProgress,
              ).toFixed(2)}px`,
            );

            introRef.current.style.setProperty(
              "--depth-opacity",
              lerp(
                0.28,
                0.74,
                sideStrength,
              ).toFixed(3),
            );

            introRef.current.style.setProperty(
              "--specular-opacity",
              Math.max(
                0,
                specularOpacity,
              ).toFixed(3),
            );

            introRef.current.style.setProperty(
              "--specular-x",
              `${specularX.toFixed(
                2,
              )}%`,
            );
          }

          if (
            atmosphereRef.current
          ) {
            atmosphereRef.current.style.transform = `
              translate3d(
                ${(
                  -camera.rotateY *
                  0.34
                ).toFixed(2)}px,
                ${(
                  camera.rotateX *
                  0.24
                ).toFixed(2)}px,
                0px
              )
              scale(1.025)
            `;
          }

          if (
            cameraProgress < 1
          ) {
            animationFrame =
              window.requestAnimationFrame(
                animate,
              );

            return;
          }

          mainPaths.forEach(
            (path) => {
              path.style.strokeDashoffset =
                "0";
            },
          );

          depthPaths.forEach(
            (path) => {
              path.style.strokeDashoffset =
                "0";
            },
          );

          glowPaths.forEach(
            (path) => {
              path.style.opacity =
                "0";
            },
          );

          if (
            cameraRef.current
          ) {
            cameraRef.current.style.transform =
              "none";
          }

          if (
            focusRigRef.current
          ) {
            focusRigRef.current.style.transform =
              "none";
          }

          if (
            atmosphereRef.current
          ) {
            atmosphereRef.current.style.transform =
              "none";
          }

          if (
            cameraSceneRef.current
          ) {
            cameraSceneRef.current.style.perspectiveOrigin =
              "50% 47%";
          }

          introRef.current?.style.setProperty(
            "--disc-opacity",
            "1",
          );

          introRef.current?.style.setProperty(
            "--disc-scale",
            "1",
          );

          introRef.current?.style.setProperty(
            "--disc-blur",
            "0px",
          );

          introRef.current?.style.setProperty(
            "--word-opacity",
            "1",
          );

          introRef.current?.style.setProperty(
            "--word-y",
            "0px",
          );

          introRef.current?.style.setProperty(
            "--word-blur",
            "0px",
          );

          introRef.current?.style.setProperty(
            "--specular-opacity",
            "0",
          );
        };

        animationFrame =
          window.requestAnimationFrame(
            animate,
          );
      } else {
        leafRef.current
          ?.querySelectorAll(
            "path",
          )
          .forEach((path) => {
            (
              path as SVGPathElement
            ).style.opacity =
              "1";
          });
      }

      if (
        !prefersReducedMotion
      ) {
        rippleTimer =
          window.setTimeout(
            () => {
              setIsRippling(
                true,
              );
            },
            RIPPLE_START_MS,
          );
      }

      const exitStart =
        prefersReducedMotion
          ? REDUCED_EXIT_START_MS
          : FULL_EXIT_START_MS;

      const totalDuration =
        prefersReducedMotion
          ? REDUCED_INTRO_DURATION_MS
          : FULL_INTRO_DURATION_MS;

      exitTimer =
        window.setTimeout(
          () => {
            setIsLeaving(
              true,
            );
          },
          exitStart,
        );

      finishTimer =
        window.setTimeout(
          () => {
            /*
             * Keep session persistence
             * strictly at the END.
             *
             * Important for React
             * Strict Mode.
             */
            try {
              window.sessionStorage.setItem(
                SESSION_KEY,
                "1",
              );
            } catch {
              // Persistence optional.
            }

            root.dataset.echoIntro =
              "seen";

            document.body.style.overflow =
              previousOverflow;

            setIsVisible(
              false,
            );
          },
          totalDuration,
        );
    }

    startTimelineRef.current =
      startVisualTimeline;

    return () => {
      disposed = true;

      window.cancelAnimationFrame(
        animationFrame,
      );

      if (
        rippleTimer !==
        undefined
      ) {
        window.clearTimeout(
          rippleTimer,
        );
      }

      if (
        exitTimer !==
        undefined
      ) {
        window.clearTimeout(
          exitTimer,
        );
      }

      if (
        finishTimer !==
        undefined
      ) {
        window.clearTimeout(
          finishTimer,
        );
      }

      if (
        journeyStartTimerRef.current !==
        undefined
      ) {
        window.clearTimeout(
          journeyStartTimerRef.current,
        );

        journeyStartTimerRef.current =
          undefined;
      }

      soundtrack?.dispose();

      audioRef.current =
        null;

      startTimelineRef.current =
        null;

      timelineStartedRef.current =
        false;

      journeyStartedRef.current =
        false;

      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  function beginJourney() {
    if (
      journeyStartedRef.current ||
      timelineStartedRef.current
    ) {
      return;
    }

    journeyStartedRef.current =
      true;

    /*
     * Also unlock here so keyboard
     * activation works, not only
     * pointer/touch input.
     */
    audioRef.current?.unlock();

    setIsStartingJourney(
      true,
    );

    journeyStartTimerRef.current =
      window.setTimeout(
        () => {
          void (async () => {
            /*
             * Audio starts from 0:00.
             * Then the visual timeline
             * starts immediately after.
             */
            await audioRef.current?.start();

            startTimelineRef.current?.();
          })();
        },
        WELCOME_EXIT_MS,
      );
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={introRef}
      className={[
        styles.intro,
        isRippling
          ? styles.rippling
          : "",
        isLeaving
          ? styles.leaving
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={
        hasIntroStarted
          ? true
          : undefined
      }
    >
      <div
        ref={atmosphereRef}
        className={
          styles.atmosphere
        }
      >
        <div
          className={
            styles.ambientCore
          }
        />

        <div
          className={
            styles.ambientLeft
          }
        />

        <div
          className={
            styles.ambientRight
          }
        />

        <div
          className={
            styles.waveField
          }
        >
          <div
            className={`${styles.wave} ${styles.waveOne}`}
          />

          <div
            className={`${styles.wave} ${styles.waveTwo}`}
          />

          <div
            className={`${styles.wave} ${styles.waveThree}`}
          />
        </div>

        <div
          className={
            styles.vignette
          }
        />

        <div
          className={
            styles.grain
          }
        />
      </div>

      {!hasIntroStarted ? (
        <div
          className={[
            styles.welcomeStage,
            isStartingJourney
              ? styles.welcomeLeaving
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <button
            type="button"
            className={
              styles.journeyButton
            }
            onPointerDown={() => {
              audioRef.current?.unlock();
            }}
            onClick={
              beginJourney
            }
          >
            <div
              className={
                styles.welcomeContent
              }
            >
              <div
                className={
                  styles.logoAura
                }
              >
                <div
                  className={
                    styles.welcomeRippleField
                  }
                >
                  <span
                    className={`${styles.welcomeRipple} ${styles.welcomeRippleOne}`}
                  />

                  <span
                    className={`${styles.welcomeRipple} ${styles.welcomeRippleTwo}`}
                  />

                  <span
                    className={`${styles.welcomeRipple} ${styles.welcomeRippleThree}`}
                  />
                </div>

                <div
                  className={
                    styles.preloaderFloat
                  }
                >
                  <div
                    className={
                      styles.preloaderShadow
                    }
                  />

                  <div
                    className={
                      styles.preloaderMark
                    }
                  >
                    <div
                      className={
                        styles.preloaderHighlight
                      }
                    />

                    <Leaf
                      className={
                        styles.preloaderLeaf
                      }
                      strokeWidth={
                        2.5
                      }
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div
                className={
                  styles.journeyCopy
                }
              >
                <span
                  className={
                    styles.journeyEyebrow
                  }
                >
                  A quiet space
                  for you
                </span>

                <span
                  className={
                    styles.journeyTitle
                  }
                >
                  Begin your quiet
                  journey
                </span>

                <span
                  className={
                    styles.journeyHint
                  }
                >
                  Tap anywhere
                  to enter ECHO
                </span>
              </div>
            </div>
          </button>
        </div>
      ) : null}

      <div
        ref={cameraSceneRef}
        className={[
          styles.cameraScene,
          hasIntroStarted
            ? styles.introStageVisible
            : styles.introStageHidden,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          ref={cameraRef}
          className={
            styles.camera
          }
        >
          <div
            ref={focusRigRef}
            className={
              styles.focusRig
            }
          >
            <div
              className={
                styles.logoLockup
              }
            >
              <div
                ref={markRef}
                className={
                  styles.mark
                }
              >
                <div
                  className={
                    styles.markShadow
                  }
                />

                <div
                  className={
                    styles.discDepthBack
                  }
                />

                <div
                  className={
                    styles.discDepthMid
                  }
                />

                <div
                  className={
                    styles.discDof
                  }
                >
                  <div
                    className={
                      styles.brandDisc
                    }
                  >
                    <div
                      className={
                        styles.discHighlight
                      }
                    />

                    <div
                      className={
                        styles.discShade
                      }
                    />

                    <div
                      className={
                        styles.discRim
                      }
                    />
                  </div>
                </div>

                <div
                  className={
                    styles.rippleLayer
                  }
                >
                  <div
                    className={`${styles.ripple} ${styles.rippleOne}`}
                  />

                  <div
                    className={`${styles.ripple} ${styles.rippleTwo}`}
                  />

                  <div
                    className={
                      styles.rippleCore
                    }
                  />
                </div>

                <div
                  ref={
                    depthStackRef
                  }
                  className={
                    styles.leafDepthStack
                  }
                >
                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf1}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />

                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf2}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />

                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf3}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />

                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf4}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />

                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf5}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />

                  <Leaf
                    className={`${styles.depthLeaf} ${styles.depthLeaf6}`}
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />
                </div>

                <div
                  className={
                    styles.leafGlowPlane
                  }
                >
                  <Leaf
                    ref={
                      glowLeafRef
                    }
                    className={
                      styles.glowLeaf
                    }
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />
                </div>

                <div
                  className={
                    styles.leafPlane
                  }
                >
                  <Leaf
                    ref={leafRef}
                    className={
                      styles.realLeaf
                    }
                    strokeWidth={
                      2.5
                    }
                    aria-hidden="true"
                  />
                </div>

                <div
                  className={
                    styles.specular
                  }
                />
              </div>

              <div
                className={
                  styles.wordmark
                }
              >
                <span
                  className={
                    styles.wordLetter
                  }
                >
                  E
                </span>

                <span
                  className={
                    styles.wordLetter
                  }
                >
                  C
                </span>

                <span
                  className={
                    styles.wordLetter
                  }
                >
                  H
                </span>

                <span
                  className={
                    styles.wordLetter
                  }
                >
                  O
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={
          styles.lightPass
        }
      />

      <div
        className={
          styles.exitBloom
        }
      />

      <div
        className={
          styles.exitWash
        }
      />
    </div>
  );
}