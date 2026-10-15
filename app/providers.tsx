"use client";

import { MotionConfig } from "motion/react";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    // reducedMotion="user": motion drops transform/layout animation for users who ask for less.
    <MotionConfig reducedMotion="user">
      <SessionBootstrap />
      {children}
    </MotionConfig>
  );
}
