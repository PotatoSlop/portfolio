import { photos } from './gallery.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================
// SECTION ROW ENTRANCE — staggered fade-up on page load
// ============================================================

// Start each <details> row invisible, then cascade them in after the
// page-header has had a moment to animate (mirrors the pageFadeIn keyframe
// on .page-header but gives each row its own staggered delay).
document.querySelectorAll('details').forEach((details, i) => {
    if (prefersReducedMotion) return;

    details.style.opacity = '0';
    details.style.transform = 'translateY(16px)';

    // Double rAF ensures the browser paints the hidden state before
    // we apply the transition, so it actually plays.
    requestAnimationFrame(() => {
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
});

// ============================================================
// ACCORDION — smooth height animation for <details> sections
// ============================================================

function animateOpen(details) {
    const content = details.querySelector('.project-section-content');
    if (!content) return;

    // Show the element before animating
    details.setAttribute('open', '');

    if (prefersReducedMotion) {
        triggerCardEntrances(details);
        return;
    }

    content.style.overflow = 'hidden';
    content.style.height = '0px';

    // Double rAF so the browser registers the height: 0 before transitioning
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            content.style.height = content.scrollHeight + 'px';
            content.addEventListener('transitionend', function handler(e) {
                if (e.propertyName !== 'height') return;
                content.style.height = '';
                content.style.overflow = '';
                content.removeEventListener('transitionend', handler);
                triggerCardEntrances(details);
            });
        });
    });
}

function animateClose(details) {
    const content = details.querySelector('.project-section-content');
    if (!content) return;

    if (prefersReducedMotion) {
        details.removeAttribute('open');
        return;
    }

    content.style.overflow = 'hidden';
    content.style.height = content.scrollHeight + 'px';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            content.style.height = '0px';
            content.addEventListener('transitionend', function handler(e) {
                if (e.propertyName !== 'height') return;
                details.removeAttribute('open');
                content.style.height = '';
                content.style.overflow = '';
                content.removeEventListener('transitionend', handler);
            });
        });
    });
}

// Wire up each <details> element
document.querySelectorAll('details').forEach(details => {
    const summary = details.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', e => {
        e.preventDefault();
        if (details.open) {
            animateClose(details);
        } else {
            animateOpen(details);
        }
    });
});

// ============================================================
// CARD ENTRANCE — staggered slide-in via IntersectionObserver
// ============================================================

// triggerCardEntrances() owns stagger on accordion-open.
// The observers below are a fallback for any items that scroll into view later
// (e.g. photography items below the fold).
const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('card-visible');
            cardObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.project-card').forEach(card => {
    cardObserver.observe(card);
});

// Gallery item observer — same fade-up entrance as project cards
const galleryObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('item-visible');
            galleryObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

// Preload all photography images in the background so they're cached
// and the fade-in is smooth when the accordion opens
photos.forEach(photo => {
    const img = new Image();
    img.src = photo.imageURL;
});

// Called after accordion opens — directly staggers card/item entrances via setTimeout.
// We can't rely on IntersectionObserver here because the observer may have already
// fired for newly-visible elements before delays were set (race condition).
function triggerCardEntrances(details) {
    const cards = [...details.querySelectorAll('.project-card:not(.card-visible)')];
    cards.forEach((card, i) => {
        const delay = prefersReducedMotion ? 0 : i * 120;
        setTimeout(() => {
            card.style.transitionDelay = '0s'; // clear any residual delay
            card.classList.add('card-visible');
            cardObserver.unobserve(card); // no longer needs observing
        }, delay);
    });

    // Gallery items — tighter stagger (more items)
    const galleryItems = [...details.querySelectorAll('.gallery-item:not(.item-visible)')];
    galleryItems.forEach((item, i) => {
        const delay = prefersReducedMotion ? 0 : i * 70;
        setTimeout(() => {
            item.style.transitionDelay = '0s';
            item.classList.add('item-visible');
            galleryObserver.unobserve(item);
        }, delay);
    });
}

// ============================================================
// HASH NAVIGATION — open a section on page load from URL hash
// ============================================================

addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash) {
        const target = document.querySelector(hash);
        if (target && target.tagName === 'DETAILS') {
            // Open without animation so it's ready instantly
            target.setAttribute('open', '');
            triggerCardEntrances(target);
            setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }
});

// ============================================================
// GALLERY RENDERING
// ============================================================

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

    // After DOM is rebuilt, assign stagger delays and observe each gallery item
    // Items inside the closed accordion won't trigger until the section opens
    const allItems = document.querySelectorAll('.gallery-item');
    allItems.forEach((item, i) => {
        item.style.transitionDelay = prefersReducedMotion ? '0s' : `${i * 0.07}s`;
        galleryObserver.observe(item);
    });
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
