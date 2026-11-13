import type { Transition } from "motion/react";

/** Preset gerak bersama (gaya Arc): tekan cepat, panel halus, sorotan yang berpindah. */
export const GERAK_TEKAN: Transition = { type: "spring", stiffness: 600, damping: 35 };
export const GERAK_PANEL: Transition = { type: "spring", stiffness: 380, damping: 38 };
export const GERAK_SOROT: Transition = { type: "spring", stiffness: 500, damping: 40 };
