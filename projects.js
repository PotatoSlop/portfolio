import { photos } from './gallery.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// Set per-card stagger delay based on position within its project-list
document.querySelectorAll('.project-list').forEach(list => {
    list.querySelectorAll('.project-card').forEach((card, i) => {
        card.style.transitionDelay = prefersReducedMotion ? '0s' : `${i * 0.1}s`;
    });
});

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

// Called after accordion opens — resets delay so cards stagger from that moment
function triggerCardEntrances(details) {
    const cards = details.querySelectorAll('.project-card:not(.card-visible)');
    cards.forEach((card, i) => {
        card.style.transitionDelay = prefersReducedMotion ? '0s' : `${i * 0.12}s`;
    });
    // The IntersectionObserver will pick them up as they scroll into view
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
