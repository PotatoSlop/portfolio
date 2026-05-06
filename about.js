document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ============================================================
    // STICKY ABOUT SECTION — text swap + headshot flip on scroll
    // ============================================================

    const headshot   = document.querySelector('.headshot');
    const textBlocks = document.querySelectorAll('.text-block');
    const aboutMain  = document.querySelector('.about-page-main');

    // ── helpers ──────────────────────────────────────────────────────────────
    function showTextBlock(index) {
        textBlocks.forEach((b, i) => b.classList.toggle('is-visible', i === index));
    }
    showTextBlock(0);

    // ── scroll lock ───────────────────────────────────────────────────────────
    let _lockY     = 0;
    let _isLocked  = false;
    function lockScroll() {
        // Idempotent: if we're already locked, don't capture scrollY again
        // (it'd be 0 once body is position:fixed, which would corrupt the
        // restore target).
        if (_isLocked) return;
        _lockY = window.scrollY;
        document.body.style.position  = 'fixed';
        document.body.style.top       = `-${_lockY}px`;
        document.body.style.left      = '0';
        document.body.style.right     = '0';
        document.body.style.overflowY = 'scroll';
        _isLocked = true;
    }
    function unlockScroll() {
        if (!_isLocked) return;
        document.body.style.position  = '';
        document.body.style.top       = '';
        document.body.style.left      = '';
        document.body.style.right     = '';
        document.body.style.overflowY = '';
        window.scrollTo({ top: _lockY, behavior: 'instant' });
        _isLocked = false;
    }

    // ── state machine ─────────────────────────────────────────────────────────
    // 0 IDLE  — above section, normal scroll
    // 1 PRE   — locked, accumulating to flip
    // 2 POST  — locked, flipped, accumulating to exit
    // 3 DONE  — below section, normal scroll

    // If the page was refreshed while already scrolled past the section,
    // start in DONE so scrolling back up never triggers the lock incorrectly.
    const _sectionAbsBottom = aboutMain
        ? aboutMain.getBoundingClientRect().bottom + window.scrollY
        : Infinity;
    let phase       = window.scrollY >= _sectionAbsBottom ? 3 : 0;
    let accumulated = 0;

    const FLIP_DELTA = 160;
    const EXIT_DELTA = 130;

    // ── lock entry / re-entry ─────────────────────────────────────────────────
    // The forward path: phase 0 (above) -> 1 (locked, accumulating) -> 2
    //   (locked, flipped, accumulating) -> 3 (below).
    // The reverse path needs symmetric treatment: scrolling back up through
    // the section from below should re-engage the lock so the user can
    // accumulate negative wheel and trigger the unflip+text-undo together.
    // Without this, both animations stay stuck in their flipped state if you
    // scroll back up after exiting.
    //
    // Critical: re-entry must only fire when the user is actually scrolling
    // UP. Without that gate, the condition fires the moment the section
    // bottom passes through the viewport on the way down (right after exit),
    // re-locking the user immediately and trapping the page.
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (!aboutMain) return;
        const sy             = window.scrollY;
        const isScrollingUp  = sy < lastScrollY;
        lastScrollY = sy;

        const rect = aboutMain.getBoundingClientRect();

        if (phase === 0) {
            // Entering from above (forward)
            if (rect.top <= 80 && rect.bottom > window.innerHeight * 0.3) {
                accumulated = 0;
                lockScroll();
                phase = 1;
            }
        } else if (phase === 3 && isScrollingUp) {
            // Re-entering from below — section bottom has come back down into
            // the viewport (lower 80px), AND the user is scrolling up.
            // Lock and resume in phase 2 (post-flip) so further upward wheel
            // accumulates toward -FLIP_DELTA, which fires the existing
            // unflip+showTextBlock(0) path that handles both animations
            // together.
            if (rect.bottom >= window.innerHeight - 80 && rect.top < window.innerHeight * 0.7) {
                accumulated = 0;
                lockScroll();
                phase = 2;
            }
        }
    }, { passive: true });

    // ── wheel accumulation ────────────────────────────────────────────────────
    window.addEventListener('wheel', (e) => {
        if (phase !== 1 && phase !== 2) return;
        e.preventDefault();
        accumulated += e.deltaY;

        if (phase === 1) {
            if (accumulated >= FLIP_DELTA) {
                headshot.classList.add('flipped');
                showTextBlock(1);
                phase = 2;
                accumulated = 0;
            } else if (accumulated < -80) {
                unlockScroll();
                phase = 0;
                accumulated = 0;
            }
        } else {
            if (accumulated >= EXIT_DELTA) {
                unlockScroll();
                phase = 3;
                accumulated = 0;
            } else if (accumulated <= -FLIP_DELTA) {
                headshot.classList.remove('flipped');
                showTextBlock(0);
                phase = 1;
                accumulated = 0;
            }
        }
    }, { passive: false });

    // ── touch support ─────────────────────────────────────────────────────────
    let touchY0   = 0;
    let touchBase = 0;

    window.addEventListener('touchstart', (e) => {
        touchY0 = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (phase !== 1 && phase !== 2) return;
        e.preventDefault();
        const dy = touchY0 - e.touches[0].clientY;
        accumulated = touchBase + dy;

        if (phase === 1) {
            if (accumulated >= FLIP_DELTA) {
                headshot.classList.add('flipped');
                showTextBlock(1);
                phase = 2;
                touchBase = 0; touchY0 = e.touches[0].clientY; accumulated = 0;
            } else if (accumulated < -80) {
                unlockScroll();
                phase = 0;
                touchBase = 0; accumulated = 0;
            }
        } else {
            if (accumulated >= EXIT_DELTA) {
                unlockScroll();
                phase = 3;
                touchBase = 0; accumulated = 0;
            } else if (accumulated <= -FLIP_DELTA) {
                headshot.classList.remove('flipped');
                showTextBlock(0);
                phase = 1;
                touchBase = 0; touchY0 = e.touches[0].clientY; accumulated = 0;
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        touchBase = accumulated;
        touchY0   = 0;
    }, { passive: true });

    // ============================================================
    // TIMELINE — SVG drawn spine + scroll-linked dot/card reveal
    // ============================================================

    const timelineEl    = document.getElementById('js-timeline');
    const svgEl         = document.getElementById('js-timeline-svg');
    const pathEl        = document.getElementById('js-timeline-path');
    const timelineItems = document.querySelectorAll('.timeline-item');
    const dots          = document.querySelectorAll('.timeline-dot');

    if (!timelineEl || !svgEl || !pathEl || timelineItems.length === 0) return;

    if (prefersReducedMotion) {
        timelineItems.forEach(item => item.classList.add('reveal'));
        dots.forEach(dot => dot.classList.add('dot-visible'));
        svgEl.style.display = 'none';
        return;
    }

    // Random wobble values generated ONCE per page load.
    // Different on each visit, stable across redraws within a session.
    // WOBBLE_RANGE is the X-amplitude of the cubic curve control points.
    // It needs to scale with the inter-dot spacing — at 2rem item padding
    // the segments are short, so an 8px wobble bends too sharply between
    // points. 5 keeps the visual character at the new tighter spacing.
    const WOBBLE_RANGE = 5;
    const randomVals   = Array.from({ length: 40 }, () => Math.random() * 2 - 1);

    let totalLength  = 0;
    let revealFracs  = []; // fraction at which each item [dot + card] should appear
    let rafId        = null;
    let currentOffset = 0;

    // Binary-search the path fraction whose y-coordinate matches targetY
    function fracAtY(targetY) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (pathEl.getPointAtLength(mid * totalLength).y < targetY) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    }

    function buildPath() {
        const svgX           = 28;
        const timelineTopAbs = timelineEl.getBoundingClientRect().top + window.scrollY;

        // --- Align each dot with the vertical centre of its title ---
        const dotYs = [];

        timelineItems.forEach((item, i) => {
            const title   = item.querySelector('.timeline-title');

            const titleRect    = title.getBoundingClientRect();
            const itemRect     = item.getBoundingClientRect();
            const titleCenterY = titleRect.top + window.scrollY + titleRect.height / 2;

            // Set dot's top so it sits at the title's vertical centre
            const dotTopInItem = titleCenterY - (itemRect.top + window.scrollY) - 6;
            dots[i].style.top = `${dotTopInItem}px`;

            // y of this dot in timeline-local coordinates (for path)
            dotYs.push(titleCenterY - timelineTopAbs);
        });

        if (dotYs.length === 0) return;

        // Build SVG path from above the first dot to below the last.
        // Tail lengths sized for the tighter 2rem inter-item padding —
        // 60/80 above/below was disproportionate at the new spacing.
        const startY = dotYs[0] - 32;
        const endY   = dotYs[dotYs.length - 1] + 44;
        const totalH = endY + 10;

        svgEl.setAttribute('viewBox', `0 0 56 ${totalH}`);
        svgEl.style.height = `${totalH}px`;

        const points = [startY, ...dotYs, endY];
        let d = `M ${svgX} ${startY}`;
        for (let i = 1; i < points.length; i++) {
            const mid  = (points[i - 1] + points[i]) / 2;
            const cp1x = svgX + randomVals[(i * 2)     % 40] * WOBBLE_RANGE;
            const cp2x = svgX + randomVals[(i * 2 + 1) % 40] * WOBBLE_RANGE;
            d += ` C ${cp1x} ${mid}, ${cp2x} ${mid}, ${svgX} ${points[i]}`;
        }
        pathEl.setAttribute('d', d);
        totalLength = pathEl.getTotalLength();

        // --- Reveal fractions ---
        // Each item reveals exactly when the drawn line reaches THAT item's
        // dot y-position — the visible intersection of line and dot. This
        // gives a tight "draw, then dot+text appear" beat per entry,
        // instead of the previous behaviour where the next item appeared
        // as soon as the prior entry's content-bottom was passed (which
        // fired too early — the dot popped in before the line had visibly
        // drawn to it).
        revealFracs = dotYs.map((dotY) => fracAtY(dotY));

        pathEl.style.strokeDasharray  = totalLength;
        pathEl.style.strokeDashoffset = totalLength;
        currentOffset = totalLength;
    }

    function getScrollFraction() {
        const viewH     = window.innerHeight;
        const rect      = timelineEl.getBoundingClientRect();
        const topAbs    = rect.top    + window.scrollY;
        const bottomAbs = rect.bottom + window.scrollY;

        // The drawing's scroll range is (timeline height + drawStartOffset
        // - drawEndOffset). Smaller range = items reveal faster per scroll.
        //
        // drawStartOffset: drawing begins when timeline top is this many
        //   viewports below current scroll. Lower = drawing starts later
        //   (closer to timeline being in view).
        // drawEndOffset: drawing finishes when timeline bottom is this many
        //   viewports above the bottom of the viewport. Higher = drawing
        //   finishes sooner (timeline bottom doesn't have to scroll as far up).
        //
        // Previous values 1.1 / 0.3 made the user scroll ~0.8 viewports worth
        // of "dead space" beyond the timeline's own height. New values
        // compress that to ~0.15 viewports — items now reveal much earlier
        // in the scroll journey.
        const drawStartOffset = 0.7;
        const drawEndOffset   = 0.9;

        const drawStart = topAbs    - viewH * drawStartOffset;
        const drawEnd   = bottomAbs - viewH * drawEndOffset;
        const sy        = window.scrollY;

        if (sy < drawStart) return 0;
        if (sy > drawEnd)   return 1;
        return (sy - drawStart) / (drawEnd - drawStart);
    }

    function tick() {
        const targetOffset = totalLength * (1 - getScrollFraction());
        currentOffset += (targetOffset - currentOffset) * 0.08;
        if (Math.abs(currentOffset - targetOffset) < 0.5) currentOffset = targetOffset;

        pathEl.style.strokeDashoffset = currentOffset;

        const drawnFraction = 1 - currentOffset / totalLength;
        revealFracs.forEach((frac, i) => {
            const visible = drawnFraction >= frac;
            dots[i].classList.toggle('dot-visible', visible);
            timelineItems[i].classList.toggle('reveal', visible);
        });

        rafId = requestAnimationFrame(tick);
    }

    function init() {
        buildPath();
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    requestAnimationFrame(() => requestAnimationFrame(init));

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(buildPath, 120);
    });
});
