"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { EchoAppIntro } from "./echo-app-intro";

const SESSION_KEY =
  "echo.app-intro.seen";

type EchoIntroGateProps = {
  children: ReactNode;
};

export function EchoIntroGate({
  children,
}: EchoIntroGateProps) {
  const [
    isAppReady,
    setIsAppReady,
  ] = useState(false);

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
          window.sessionStorage.getItem(
            SESSION_KEY,
          ) === "1"
        );
      } catch {
        return false;
      }
    };

    /*
     * Returning browser session:
     * skip the intro gate immediately.
     */
    if (introHasFinished()) {
      setIsAppReady(true);
      return;
    }

    /*
     * Fresh session:
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

        setIsAppReady(true);
      });

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-echo-intro",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {!isAppReady && (
        <EchoAppIntro />
      )}

      {isAppReady
        ? children
        : null}
    </>
  );
}