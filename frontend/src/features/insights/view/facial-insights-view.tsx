"use client";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { FacialCameraWidget } from "../components/facial-camera-widget";
import { CameraPermissionDenied } from "../components/camera-permission-denied";
import { CameraUnavailable } from "../components/camera-unavailable";
import { InsightsPrivacyBanner } from "../components/insights-privacy-banner";
import { EchoSectionHeading } from "@/shared/components/data-display/echo-section-heading";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";

export function FacialInsightsView() {
  return (
    <div className="space-y-6">
      <EchoMotionSurface as="div" tilt={false} className="rounded-[2rem] border border-border bg-card p-6 shadow-subtle sm:p-8">
        <EchoSectionHeading title="Facial expression" description="Optional camera-based mood insight" />
      </EchoMotionSurface>

      <InsightsPrivacyBanner message="Facial analysis is entirely optional. All processing happens locally in your browser and no images are uploaded." />
      <FacialCameraWidget />
    </div>
  );
}
