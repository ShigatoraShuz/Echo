"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useId,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface EchoDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: "small" | "medium" | "large";
}

const sizeStyles = {
  small: "max-w-sm",
  medium: "max-w-lg",
  large: "max-w-2xl",
};

const EXIT_DURATION = 320;

export function EchoDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "medium",
}: EchoDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap(open);

  const titleId = useId();
  const descriptionId = useId();

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const closeTimerRef =
    useRef<number | undefined>(undefined);

  const openFrameRef =
    useRef<number | undefined>(undefined);

  const lockedScrollY =
    useRef(0);

  const previousHtmlOverflow =
    useRef("");

  const previousBodyOverflow =
    useRef("");

  const previousBodyPosition =
    useRef("");

  const previousBodyTop =
    useRef("");

  const previousBodyWidth =
    useRef("");

  const previousBodyPaddingRight =
    useRef("");

  const previousHtmlOverscrollBehavior =
    useRef("");

  const previousBodyOverscrollBehavior =
    useRef("");

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
      }
    },
    [],
  );

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);

    if (openFrameRef.current !== undefined) {
      window.cancelAnimationFrame(
        openFrameRef.current,
      );
      openFrameRef.current = undefined;
    }

    if (open) {
      setPresent(true);

      lockedScrollY.current =
        window.scrollY;

      const html =
        document.documentElement;

      const body =
        document.body;

      previousHtmlOverflow.current =
        html.style.overflow;

      previousBodyOverflow.current =
        body.style.overflow;

      previousBodyPosition.current =
        body.style.position;

      previousBodyTop.current =
        body.style.top;

      previousBodyWidth.current =
        body.style.width;

      previousBodyPaddingRight.current =
        body.style.paddingRight;

      previousHtmlOverscrollBehavior.current =
        html.style.overscrollBehavior;

      previousBodyOverscrollBehavior.current =
        body.style.overscrollBehavior;

      const scrollbarWidth =
        window.innerWidth -
        html.clientWidth;

      html.style.overflow = "hidden";
      html.style.overscrollBehavior =
        "none";

      body.style.overflow = "hidden";
      body.style.overscrollBehavior =
        "none";
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY.current}px`;
      body.style.width = "100%";

      if (scrollbarWidth > 0) {
        body.style.paddingRight =
          `${scrollbarWidth}px`;
      }

      document.addEventListener(
        "keydown",
        handleKeyDown,
      );

      openFrameRef.current =
        window.requestAnimationFrame(() => {
          openFrameRef.current =
            window.requestAnimationFrame(() => {
              setVisible(true);
              dialogRef.current?.focus();

              openFrameRef.current =
                undefined;
            });
        });

      return () => {
        if (openFrameRef.current !== undefined) {
          window.cancelAnimationFrame(
            openFrameRef.current,
          );
          openFrameRef.current =
            undefined;
        }

        document.removeEventListener(
          "keydown",
          handleKeyDown,
        );
      };
    }

    setVisible(false);

    document.removeEventListener(
      "keydown",
      handleKeyDown,
    );

    closeTimerRef.current =
      window.setTimeout(() => {
        setPresent(false);

        const html =
          document.documentElement;

        const body =
          document.body;

        html.style.overflow =
          previousHtmlOverflow.current;

        html.style.overscrollBehavior =
          previousHtmlOverscrollBehavior.current;

        body.style.overflow =
          previousBodyOverflow.current;

        body.style.overscrollBehavior =
          previousBodyOverscrollBehavior.current;

        body.style.position =
          previousBodyPosition.current;

        body.style.top =
          previousBodyTop.current;

        body.style.width =
          previousBodyWidth.current;

        body.style.paddingRight =
          previousBodyPaddingRight.current;

        window.scrollTo(
          0,
          lockedScrollY.current,
        );
      }, EXIT_DURATION);

    return () => {
      window.clearTimeout(
        closeTimerRef.current,
      );
    };
  }, [
    open,
    handleKeyDown,
    dialogRef,
  ]);

  useEffect(() => {
    return () => {
      window.clearTimeout(
        closeTimerRef.current,
      );

      if (openFrameRef.current !== undefined) {
        window.cancelAnimationFrame(
          openFrameRef.current,
        );
        openFrameRef.current = undefined;
      }

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      const html =
        document.documentElement;

      const body =
        document.body;

      html.style.overflow =
        previousHtmlOverflow.current;

      html.style.overscrollBehavior =
        previousHtmlOverscrollBehavior.current;

      body.style.overflow =
        previousBodyOverflow.current;

      body.style.overscrollBehavior =
        previousBodyOverscrollBehavior.current;

      body.style.position =
        previousBodyPosition.current;

      body.style.top =
        previousBodyTop.current;

      body.style.width =
        previousBodyWidth.current;

      body.style.paddingRight =
        previousBodyPaddingRight.current;
    };
  }, [handleKeyDown]);

  if (!mounted || !present) {
    return null;
  }

  const dialog = (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[9999]",
        "flex h-[100dvh] w-[100vw]",
        "items-center justify-center",
        "overflow-hidden",
        "p-3 sm:p-5",
        "bg-black/45 backdrop-blur-[7px]",
        "transition-[opacity,backdrop-filter]",
        "duration-[320ms]",
        "ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible
          ? "opacity-100"
          : "pointer-events-none opacity-0 backdrop-blur-0",
        "motion-reduce:transition-none",
      )}
      onClick={(event) => {
        if (
          event.target ===
            overlayRef.current &&
          visible
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          description
            ? descriptionId
            : undefined
        }
        tabIndex={-1}
        className={cn(
          "flex w-full flex-col",
          "overflow-hidden",
          "max-h-[calc(100dvh-1.5rem)]",
          "sm:max-h-[calc(100dvh-2.5rem)]",
          "rounded-[1.9rem]",
          "bg-[#fffdf8]",
          "shadow-[0_40px_120px_rgba(7,22,15,0.34)]",
          "outline-none",
          "transition-[transform,opacity,box-shadow]",
          "duration-[380ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-[0.965] opacity-0",
          "motion-reduce:transition-none",
          sizeStyles[size],
          className,
        )}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          className={cn(
            "shrink-0",
            "bg-[#fffdf8]",
            "px-5 pb-4 pt-5",
            "sm:px-6 sm:pb-5 sm:pt-6",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-[-0.025em] text-foreground sm:text-xl"
              >
                {title}
              </h2>

              {description ? (
                <p
                  id={descriptionId}
                  className="max-w-3xl text-sm leading-5 text-muted-foreground"
                >
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "shrink-0 rounded-full p-2",
                "text-muted-foreground",
                "outline-none",
                "transition-all duration-200",
                "hover:bg-[#526f3510]",
                "hover:text-foreground",
                "hover:rotate-90",
                "focus-visible:ring-4",
                "focus-visible:ring-ring/20",
              )}
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1",
            "overflow-y-auto",
            "overscroll-contain",
            "touch-auto",
            "bg-[#fffdf8]",
            "[scrollbar-width:thin]",
            "[scrollbar-color:rgba(83,103,51,0.25)_transparent]",
          )}
        >
          <div className="px-5 pb-6 sm:px-6 sm:pb-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    dialog,
    document.body,
  );
}