const footer = document.querySelector('.contact-footer');
const cursorEffect = document.querySelector('.cursor-effects');
const nav = document.querySelector('nav');

footer.addEventListener('mouseenter', () => {
  // Make the cursor visible
  cursorEffect.style.opacity = '1';
  cursorEffect.style.transform = 'scale(1)';
});

footer.addEventListener('mouseleave', () => {
  // Hide the cursor
  cursorEffect.style.opacity = '0';
  cursorEffect.style.transform = 'scale(0)';
});

footer.addEventListener('mousemove', (e) => {
  const rect = footer.getBoundingClientRect();

  // Get the cursor's dimensions to center it
  const cursorWidth = cursorEffect.offsetWidth;
  const cursorHeight = cursorEffect.offsetHeight;

  const x = e.clientX - rect.left - (cursorWidth / 2);
  const y = e.clientY - rect.top - (cursorHeight / 2);

  cursorEffect.style.left = x + 'px';
  cursorEffect.style.top = y + 'px';
});

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('nav');
  const footer = document.querySelector('.contact-footer');
  const root = document.documentElement;

  const defaultTheme = {
    '--nav-link-bg': 'transparent',
    '--nav-hover-fill': '#F5A045',
    '--hamburger-hover-bg': '#F5A045',
  };

  const footerTheme = {
    '--nav-link-bg': '#F5A045',
    '--nav-hover-fill': '#fff',
    '--hamburger-hover-bg': '#fff',
  };

  const applyNavTheme = (theme) => {
    for (const [key, value] of Object.entries(theme)) {
      root.style.setProperty(key, value);
    }
  };

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -95% 0px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        applyNavTheme(footerTheme);
      } else {
        applyNavTheme(defaultTheme);
      }
    });
  }, observerOptions);

  observer.observe(footer);
});