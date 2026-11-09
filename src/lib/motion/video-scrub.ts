/* ===== Video scrub =====
   Hover-scrubbed hero clip driven by a single "boomerang" video: the forward
   footage followed by its own reverse, stitched into one file. So the timeline
   is  rest(0) → peak(D) → rest(T),  where D = T / 2 is the midpoint.

   Hover plays forward toward the peak and pauses there; leaving keeps playing
   forward through the reversed half back to rest. Both directions are plain
   forward playback of one element — no negative rate, no second video, no
   crossfade — so the forward↔reverse handover has no transition artifacts.

   Interruptions stay smooth because frame `t` and its mirror `T - t` show the
   exact same picture (the halves mirror around the peak). On a direction change
   mid-gesture we seek to the mirror position — an invisible, same-frame jump —
   then keep playing forward. Hover forward, leave backward, always from the
   current frame. */

import { prefersReducedMotion } from './reduced-motion';

export interface VideoScrubHandle {
  play(): void;
  rewind(): void;
  destroy(): void;
}

const HALF_FRAME = 1 / 120; // ~half a frame at 60fps, for the pause threshold

/**
 * Mount hover-scrub behaviour on a boomerang `video`, driven by `root`'s
 * pointer/focus state. Returns a handle, or `null` if the platform can't drive
 * the video.
 */
export function mountVideoScrub(root: HTMLElement, video: HTMLVideoElement): VideoScrubHandle | null {
  if (typeof video.play !== 'function') return null;

  video.muted = true;
  video.pause();

  // The RESTING FRAME is the element's `poster` (a pipeline still exported from
  // frame 0), NOT a decoded video frame. That's deliberate: a <video poster> is
  // painted like an <img>, instantly and unconditionally, so the tile shows real
  // content on every navigation path — a fresh load AND a ClientRouter SPA hop,
  // where an adopted <video> otherwise decodes nothing and sits blank. We must
  // NOT force an eager decode/seek here: the poster already covers the rest
  // state, and a seek that comes back blank on an adopted element would hide a
  // working poster behind nothing (the exact bug this replaces). The video only
  // decodes on real hover, when play() is called; the poster then hands off to
  // live frames. Nudging load along helps a stalled adopted element be ready by
  // first hover without ever touching what's on screen.
  if (video.preload !== 'none' && video.readyState === 0) video.load();

  /** Peak time (midpoint) and end time; read live in case metadata was loading. */
  const peakTime = () => (video.duration || 0) / 2;
  const endTime = () => video.duration || 0;

  // While hovering we must stop at the peak (mid-clip); leaving just rides the
  // clip to its natural end. `holdAt` is the hover stop point, or null.
  let holdAt: number | null = null;
  let watching = false;

  const schedule = (cb: () => void) => {
    if ('requestVideoFrameCallback' in video) {
      (video as any).requestVideoFrameCallback(() => cb());
    } else {
      requestAnimationFrame(() => cb());
    }
  };

  const watch = () => {
    if (video.paused || holdAt === null) {
      watching = false;
      return;
    }
    if (video.currentTime >= holdAt - HALF_FRAME) {
      video.pause();
      watching = false;
      return;
    }
    schedule(watch);
  };

  const startWatch = () => {
    if (!watching) {
      watching = true;
      schedule(watch);
    }
  };

  // A hover can land before metadata loads — common after an SPA hop, when the
  // <video> is a fresh node still fetching. Without a duration there's no peak to
  // scrub toward, so we can't act yet; remember the latest intent and replay it
  // once metadata arrives, so the gesture isn't silently dropped (which looked
  // like "the hero never plays" when reaching /engineering from the nav).
  let pendingIntent: 'play' | 'rewind' | null = null;
  const runPending = () => {
    const intent = pendingIntent;
    pendingIntent = null;
    if (intent === 'play') play();
    else if (intent === 'rewind') rewind();
  };
  const deferUntilReady = (intent: 'play' | 'rewind') => {
    const first = pendingIntent === null;
    pendingIntent = intent; // keep only the newest intent
    if (first) video.addEventListener('loadedmetadata', runPending, { once: true });
  };

  const play = () => {
    const D = peakTime();
    if (!D) {
      deferUntilReady('play');
      return;
    }
    if (prefersReducedMotion()) {
      video.pause();
      video.currentTime = D; // rest on the peak while hovered
      return;
    }
    // Coming from the reversed half? Mirror into the forward half first.
    if (video.currentTime > D) video.currentTime = endTime() - video.currentTime;
    holdAt = D;
    void video.play();
    startWatch();
  };

  const rewind = () => {
    const D = peakTime();
    if (!D) {
      deferUntilReady('rewind');
      return;
    }
    if (prefersReducedMotion()) {
      video.pause();
      video.currentTime = 0;
      return;
    }
    // Coming from the forward half? Mirror into the reversed half first.
    if (video.currentTime < D) video.currentTime = endTime() - video.currentTime;
    holdAt = null; // ride to the natural end (rest frame)
    void video.play();
  };

  root.addEventListener('pointerenter', play);
  root.addEventListener('pointerleave', rewind);
  // Keyboard parity: the feature block is reachable via its overlay link.
  root.addEventListener('focusin', play);
  root.addEventListener('focusout', rewind);

  return {
    play,
    rewind,
    destroy() {
      root.removeEventListener('pointerenter', play);
      root.removeEventListener('pointerleave', rewind);
      root.removeEventListener('focusin', play);
      root.removeEventListener('focusout', rewind);
      pendingIntent = null;
      video.removeEventListener('loadedmetadata', runPending);
      video.pause();
    },
  };
}
