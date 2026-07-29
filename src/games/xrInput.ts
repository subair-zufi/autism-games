/**
 * Shared WebXR input wiring for the 360 games.
 *
 * Every game's `xrStore.ts` builds its own store (one store per Canvas), but
 * they all want the same input rules, so the options live here once.
 *
 * Hand tracking is off. It was only ever needed for the bare-hand poke method,
 * which was removed after Quest testing — and leaving it on would put a live
 * pinch-to-select ray on the child's hands, which is exactly the fine-motor
 * gesture this whole feature exists to avoid. Selection is the gaze dwell in
 * `HeadSelect`, or the controller.
 */
export const XR_STORE_OPTIONS = {
  hand: false as const,
  // the child stays put in every game — no teleport/locomotion anywhere
  controller: { teleportPointer: false as const },
  // no localhost headset emulation: its fake pose/controller interferes with
  // the on-screen (non-VR) mode during development, and real devices never use it
  emulate: false as const,
}
