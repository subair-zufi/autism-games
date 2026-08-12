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

  // Ask the headset for its LOWEST supported refresh rate (72Hz on a Quest)
  // rather than its highest. The library's default is 'high', which on a Quest 3
  // requests 120Hz — a budget these scenes cannot come close to meeting, so
  // every frame missed its deadline and the compositor reprojected the last one
  // instead. Reprojected frames are exactly what makes a press feel like it
  // landed late or not at all: the picture keeps moving, so nothing looks
  // frozen, but the app is only actually sampling input a fraction as often.
  // A target the scene can hold is worth far more than a high one it cannot.
  frameRate: 'low' as const,

  // Full fixed-foveated rendering: the periphery is shaded at reduced
  // resolution, which is free visual quality to give up in a game where
  // everything that matters is what the child is looking straight at.
  // Left unset, this is "whatever the device defaults to" — pinned here so a
  // browser update cannot quietly change the frame budget under the study.
  foveation: 1,
}

/**
 * Device-pixel-ratio cap for the 360 scenes' flat (pre-VR) view.
 *
 * This is the screen the facilitator is looking at when they press "Enter VR",
 * and the headset browser reports a ratio of 2 — so an uncapped canvas renders
 * four times as many pixels as it has CSS pixels, on a device with no headroom
 * to spare. That cost lands on the same main thread the button's click handler
 * runs on, which is why a press there could sit unanswered. Capping at 1.5
 * keeps the scene sharp on a desktop monitor (where there is headroom) while
 * roughly halving the headset's flat-view fill cost.
 *
 * It has no effect inside an immersive session: a presenting headset renders
 * into the WebXR framebuffer, whose resolution is `foveation` and the device's
 * own scaling, not this.
 */
export const FLAT_SCREEN_DPR: [number, number] = [1, 1.5]
