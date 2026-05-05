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
    let _lockY = 0;
    function lockScroll() {
        _lockY = window.scrollY;
        document.body.style.position  = 'fixed';
        document.body.style.top       = `-${_lockY}px`;
        document.body.style.left      = '0';
        document.body.style.right     = '0';
        document.body.style.overflowY = 'scroll';
    }
    function unlockScroll() {
        document.body.style.position  = '';
        document.body.style.top       = '';
        document.body.style.left      = '';
        document.body.style.right     = '';
        document.body.style.overflowY = '';
        window.scrollTo({ top: _lockY, behavior: 'instant' });
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

    // ── lock entry ────────────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
        if (phase !== 0 || !aboutMain) return;
        const rect = aboutMain.getBoundingClientRect();
        if (rect.top <= 80 && rect.bottom > window.innerHeight * 0.3) {
            accumulated = 0;
            lockScroll();
            phase = 1;
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
    const WOBBLE_RANGE = 8;
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
        const dotYs          = [];
        const contentBotYs   = [];

        timelineItems.forEach((item, i) => {
            const title   = item.querySelector('.timeline-title');
            const content = item.querySelector('.timeline-content');

            const titleRect    = title.getBoundingClientRect();
            const itemRect     = item.getBoundingClientRect();
            const titleCenterY = titleRect.top + window.scrollY + titleRect.height / 2;

            // Set dot's top so it sits at the title's vertical centre
            const dotTopInItem = titleCenterY - (itemRect.top + window.scrollY) - 6;
            dots[i].style.top = `${dotTopInItem}px`;

            // y of this dot in timeline-local coordinates (for path)
            dotYs.push(titleCenterY - timelineTopAbs);

            // bottom of this entry's content box (trigger point for the NEXT dot)
            const contentBotY = content.getBoundingClientRect().bottom + window.scrollY - timelineTopAbs;
            contentBotYs.push(contentBotY);
        });

        if (dotYs.length === 0) return;

        // Build SVG path from above the first dot to below the last
        const startY = dotYs[0] - 60;
        const endY   = dotYs[dotYs.length - 1] + 80;
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
        // Item 0: reveal when the line reaches dot 0's y position.
        // Item i (i > 0): reveal when the line passes the BOTTOM of item i-1's
        //   content — i.e. as soon as the previous entry is fully passed.
        revealFracs = dotYs.map((dotY, i) => {
            const targetY = i === 0 ? dotY : contentBotYs[i - 1];
            return fracAtY(targetY);
        });

        pathEl.style.strokeDasharray  = totalLength;
        pathEl.style.strokeDashoffset = totalLength;
        currentOffset = totalLength;
    }

    function getScrollFraction() {
        const viewH     = window.innerHeight;
        const rect      = timelineEl.getBoundingClientRect();
        const topAbs    = rect.top    + window.scrollY;
        const bottomAbs = rect.bottom + window.scrollY;

        // Start drawing when timeline is 1.1 viewports below current position
        const drawStart = topAbs    - viewH * 1.1;
        const drawEnd   = bottomAbs - viewH * 0.3;
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
