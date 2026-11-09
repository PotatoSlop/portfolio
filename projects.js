import { photos } from './gallery.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Preload images in photography section
photos.forEach(photo => {
    const img = new Image();
    img.src = photo.imageURL;
});

document.querySelectorAll('details').forEach((details, i) => {
    if (prefersReducedMotion) return;

    details.style.opacity = '0';
    details.style.transform = 'translateY(16px)';
    requestAnimationFrame(() => {
        const delayMs = 200 + i * 100; // stagger after page-header fades in
        details.style.transition =
            `opacity 0.45s ease-out ${delayMs}ms, transform 0.45s ease-out ${delayMs}ms`;
        details.style.opacity = '1';
        details.style.transform = 'translateY(0)';

        // Clean up inline styles once the entrance is done so they
        // don't interfere with anything else on the element.
        setTimeout(() => {
            details.style.transition = '';
            details.style.opacity = '';
            details.style.transform = '';
        }, delayMs + 450 + 50);
    });
});

function animateOpen(details) {
    const content = details.querySelector('.project-section-content');
    if (!content) return;

    details.setAttribute('open', '');

    triggerCardEntrances(details);

    if (prefersReducedMotion) return;

    content.style.overflow = 'hidden';
    content.style.height = '0px';


    requestAnimationFrame(() => {
        content.style.height = content.scrollHeight + 'px';
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName !== 'height') return;
            content.style.height = '';
            content.style.overflow = '';
            content.removeEventListener('transitionend', handler);
        });
    });
}

function animateClose(details) {
    const content = details.querySelector('.project-section-content');
    if (!content) return;

    if (prefersReducedMotion) {
        details.removeAttribute('open');
        resetEntranceState(details);
        return;
    }

    content.style.overflow = 'hidden';
    content.style.height = content.scrollHeight + 'px';

    requestAnimationFrame(() => {
        content.style.height = '0px';
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName !== 'height') return;
            details.removeAttribute('open');
            content.style.height = '';
            content.style.overflow = '';
            content.removeEventListener('transitionend', handler);

            resetEntranceState(details);
        });
    });
}

function resetEntranceState(details) {
    const elements = [
        ...details.querySelectorAll('.project-card.card-visible'),
        ...details.querySelectorAll('.gallery-item.item-visible'),
    ];

    elements.forEach(el => {
        el.getAnimations().forEach(anim => anim.cancel()); // Stop existing animations
        el.classList.remove('card-visible');
        el.classList.remove('item-visible');
        el.style.transitionDelay = '';
    });
}

document.querySelectorAll('details').forEach(details => {
    const summary = details.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', e => {
        e.preventDefault();
        if (details.open) {
            details.classList.remove('is-open');
            animateClose(details);
        } else {
            details.classList.add('is-open');
            animateOpen(details);
        }
    });
});

function triggerCardEntrances(details) {
    const cards = [...details.querySelectorAll('.project-card')];
    const galleryItems = [...details.querySelectorAll('.gallery-item')];

    const ENTRANCE_KEYFRAMES = [
        { opacity: 0, transform: 'translateY(28px)' },
        { opacity: 1, transform: 'translateY(0)' },
    ];

    cards.forEach((card, i) => {
        card.classList.add('card-visible');
        if (prefersReducedMotion) return;
        card.animate(ENTRANCE_KEYFRAMES, {
            duration: 400,
            delay: (i+1) * 120,
            easing: 'cubic-bezier(0, 0, 0.2, 1)', // ease-out
            fill: 'backwards', // hold 'from' state during delay
        });
    });

    galleryItems.forEach((item, i) => {
        item.classList.add('item-visible');
        if (prefersReducedMotion) return;
        item.animate(ENTRANCE_KEYFRAMES, {
            duration: 400,
            delay: (i+1) * 90,
            easing: 'cubic-bezier(0, 0, 0.2, 1)',
            fill: 'backwards',
        });
    });
}

// #region Drag and Drop Hash Navigation
addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash) {
        const target = document.querySelector(hash);
        if (target && target.tagName === 'DETAILS') {
            target.setAttribute('open', '');
            target.classList.add('is-open'); // target for chevron css animation
            triggerCardEntrances(target);
            setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        }
    }
});

// #region Gallery View Rendering
const landscapeContainer = document.getElementById('landscape-gallery');
const portraitContainer = document.getElementById('portrait-gallery');
const portraitShortContainer = document.getElementById('portrait-short-gallery');

function renderGallery() {
    landscapeContainer.innerHTML = '';
    portraitContainer.innerHTML = '';
    portraitShortContainer.innerHTML = '';

    photos.forEach(photo => {
        const galleryItemHTML = createGalleryItemHTML(photo);
        if (photo.orientation === 'landscape') {
            landscapeContainer.innerHTML += galleryItemHTML;
        } else if (photo.orientation === 'portrait') {
            portraitContainer.innerHTML += galleryItemHTML;
        } else if (photo.orientation === 'portrait-short') {
            portraitShortContainer.innerHTML += galleryItemHTML;
        }
    });

    const columns = getColumnCount();
    addPlaceholders(landscapeContainer, columns);
    addPlaceholders(portraitContainer, columns);
    addPlaceholders(portraitShortContainer, columns);
}

function createGalleryItemHTML(photo) {
    return `
    <div class="gallery-item ${photo.orientation}">
      <img src="${photo.imageURL}" alt="${photo.title}" loading="lazy"/>
      <div class="gallery-overlay">
        <div class="gallery-info">
          <h4>${photo.title}</h4>
          <p>${photo.location}</p>
        </div>
      </div>
    </div>
  `;
}

function getColumnCount() {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 900) return 2;
    return 3;
}

function addPlaceholders(container, columnCount) {
    if (columnCount === 1) return;
    const currentItems = container.children.length;
    const placeholdersNeeded = currentItems % columnCount === 0
        ? 0
        : columnCount - (currentItems % columnCount);

    for (let i = 0; i < placeholdersNeeded; i++) {
        container.insertAdjacentHTML('beforeend', '<div class="gallery-placeholder"></div>');
    }
}

window.addEventListener('resize', renderGallery);
renderGallery();

// #region Card Hover Cursor
const cardCursor = document.querySelector('.card-cursor');

if (cardCursor) {   // Follow cursor with slight delay (LERP value)
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let cursorRAF = null;
    const LERP = 0.18;

    function tickCursor() {
        currentX += (targetX - currentX) * LERP;
        currentY += (targetY - currentY) * LERP;
        cardCursor.style.left = `${currentX}px`;
        cardCursor.style.top  = `${currentY}px`;

        if (cardCursor.classList.contains('visible')) { // Stop following when not visible
            cursorRAF = requestAnimationFrame(tickCursor);
        } else {
            cursorRAF = null;
        }
    }
    const DEFAULT_CTA = 'View';

    document.querySelectorAll('.project-card').forEach((card) => {
        card.addEventListener('mouseenter', (e) => {

            cardCursor.textContent = card.dataset.cta || DEFAULT_CTA;

            // Start visible pos at cursor
            targetX = currentX = e.clientX;
            targetY = currentY = e.clientY;
            cardCursor.style.left = `${currentX}px`;
            cardCursor.style.top  = `${currentY}px`;

            cardCursor.classList.add('visible');
            if (!cursorRAF) cursorRAF = requestAnimationFrame(tickCursor);
        });

        card.addEventListener('mouseleave', () => {
            cardCursor.classList.remove('visible');
        });

        card.addEventListener('mousemove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
        });
    });
}
