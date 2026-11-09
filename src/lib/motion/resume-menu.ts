/*
  resume-menu — the "Download Resume" dropdown on the about page.

  Interaction model (two independent open signals, OR'd together):
    • pinned  — a CLICK/keyboard toggle. Latches the menu open until the user
                clicks again, clicks outside, or presses Escape. This is the
                reliable path for touch (no hover) and for "keep it open".
    • hovering — pointer is over the trigger OR the menu list. Opens the menu on
                hover-capable devices only. Leaving starts a short GRACE timer
                before closing, so crossing the small gap into the list (or a
                brief slip off an edge) doesn't slam it shut mid-navigation.

  A transparent CSS bridge (.resume-menu__list::before, see about.css) covers the
  gap between the trigger and the list so the pointer never lands on dead space.

  Follows docs/routing-and-lifecycle.md: returns a teardown that clears the timer
  and unbinds everything; safe to run on every astro:page-load.
*/
const GRACE_MS = 160;

export function mountResumeMenu(): () => void {
  const menu = document.querySelector<HTMLElement>('[data-resume-menu]');
  const trigger = menu?.querySelector<HTMLButtonElement>('.resume-menu__trigger') ?? null;
  if (!menu || !trigger) return () => {};

  // Hover-open only where hovering is a real, sustained state — a fine pointer.
  // Touch fires a synthetic pointerenter on tap that would fight the click toggle.
  const canHover =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let pinned = false;
  let hovering = false;
  let closeTimer = 0;

  const clearCloseTimer = () => {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = 0;
    }
  };
  const sync = () => {
    const open = pinned || hovering;
    menu.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  };
  const closeAll = () => {
    clearCloseTimer();
    pinned = false;
    hovering = false;
    sync();
  };

  const onTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    clearCloseTimer();
    pinned = !pinned;
    sync();
  };
  const onEnter = () => {
    clearCloseTimer();
    hovering = true;
    sync();
  };
  const onLeave = () => {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      hovering = false;
      sync(); // stays open if still pinned
    }, GRACE_MS);
  };
  const onDocPointerDown = (e: Event) => {
    if (!menu.contains(e.target as Node)) closeAll();
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (pinned || hovering)) {
      closeAll();
      trigger.focus();
    }
  };

  trigger.addEventListener('click', onTriggerClick);
  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onKeydown);
  if (canHover) {
    menu.addEventListener('pointerenter', onEnter);
    menu.addEventListener('pointerleave', onLeave);
  }

  return () => {
    clearCloseTimer();
    trigger.removeEventListener('click', onTriggerClick);
    document.removeEventListener('pointerdown', onDocPointerDown);
    document.removeEventListener('keydown', onKeydown);
    menu.removeEventListener('pointerenter', onEnter);
    menu.removeEventListener('pointerleave', onLeave);
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };
}
