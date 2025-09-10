import { photos } from './gallery.js';

addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash;
  if (hash) {
    const detailElement = document.querySelector(hash);
    if (detailElement && detailElement.tagName === 'DETAILS') {
      detailElement.open = true;
    }
  }
});

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
      <img src="${photo.imageURL}"/>
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
  if (width < 600) {
    return 1;
  } else if (width < 900) {
    return 2;
  } else {
    return 3;
  }
}

function addPlaceholders(container, columnCount) {
  if (columnCount === 1) return;
  const currentItems = container.children.length;
  const placeholdersNeeded = currentItems % columnCount === 0 ? 0 : columnCount - (currentItems % columnCount);

  for (let i = 0; i < placeholdersNeeded; i++) {
    container.insertAdjacentHTML('beforeend', '<div class="gallery-placeholder"></div>');
  }
}

window.addEventListener('resize', () => {
    renderGallery();
});

renderGallery();