"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { EchoAppIntro } from "./echo-app-intro";

const INTRO_KEY =
  "echo.app-intro.seen";

type EchoIntroGateProps = {
  children: ReactNode;
};

type IntroGateState =
  | "checking"
  | "intro"
  | "ready";

export function EchoIntroGate({
  children,
}: EchoIntroGateProps) {
  const [
    gateState,
    setGateState,
  ] = useState<IntroGateState>(
    "checking",
  );

  useEffect(() => {
    const root =
      document.documentElement;

    const introHasFinished = () => {
      if (
        root.dataset.echoIntro ===
        "seen"
      ) {
        return true;
      }

      try {
        return (
          window.localStorage.getItem(
            INTRO_KEY,
          ) === "1"
        );
      } catch {
        return false;
      }
    };

    /*
     * Returning visitor:
     *
     * intro-init.js runs before body paint and
     * marks the document as "seen".
     *
     * Keep the gate in its neutral "checking"
     * state until this client-side verification
     * completes so EchoAppIntro never mounts,
     * even for a single render.
     */
    if (introHasFinished()) {
      setGateState("ready");
      return;
    }

    /*
     * First-ever visit:
     *
     * EchoAppIntro changes
     * data-echo-intro="seen"
     * only AFTER its animation finishes.
     *
     * We wait for that exact moment
     * before mounting the actual app.
     */
    const observer =
      new MutationObserver(() => {
        if (
          !introHasFinished()
        ) {
          return;
        }

        observer.disconnect();
        setGateState("ready");
      });

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-echo-intro",
      ],
    });

    setGateState("intro");

    return () => {
      observer.disconnect();
    };
  }, []);

  if (
    gateState === "checking"
  ) {
    return null;
  }

  return (
    <>
      {gateState === "intro" ? (
        <EchoAppIntro />
      ) : null}

      {gateState === "ready"
        ? children
        : null}
    </>
  );
}