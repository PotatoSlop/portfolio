document.addEventListener('DOMContentLoaded', () => {
  const textBlocks = document.querySelectorAll('.text-block');
  const headshot = document.querySelector('.headshot');
  const aboutContainer = document.querySelector('.about-page-main');

  if (textBlocks.length > 0) {
    textBlocks[1].classList.add('is-visible');
  }

  function calculateScrollProgress() {
    if (!aboutContainer) return 0;

    const rect = aboutContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const animationDistance = aboutContainer.offsetHeight - windowHeight;

    if (animationDistance <= 0) return 0;

    const scrolledIntoContainer = -rect.top;
    const progress = scrolledIntoContainer / animationDistance;

    return Math.min(Math.max(progress, 0), 1);
  }

  function showTextBlock(index) {
    textBlocks.forEach((block, i) => {
      if (i === index) {
        block.classList.add('is-visible');
      } 
      else {
        block.classList.remove('is-visible');
      }
    });
  }

  function handleScroll() {
    const scrollProgress = calculateScrollProgress();

    if (scrollProgress >= 0.3) {
      headshot.classList.add('flipped');
      showTextBlock(0);
    } 
    else {
      headshot.classList.remove('flipped');
      showTextBlock(1);
    }
  }

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(handleScroll, 5);
  });
});