document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM selectors
  const copyrightEl = document.querySelector('#copyright');
  const navToggle = document.querySelector('#navToggle');
  const navMenu = document.querySelector('#navMenu');
  const navLinks = document.querySelectorAll('.navLink');

  // 2. Helper functions
  const setCopyrightYear = () => {
    if (!copyrightEl) return;
    copyrightEl.innerHTML = `&copy; ${new Date().getFullYear()} The Lost And Found LLC. All rights reserved.`;
  };

  const isNavOpen = () => navToggle?.getAttribute('aria-expanded') === 'true';

  const openNav = () => {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute('aria-expanded', 'true');
    navMenu.classList.add('isActive');
  };

  const closeNav = () => {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('isActive');
  };

  const toggleNav = () => {
    if (isNavOpen()) {
      closeNav();
    } else {
      openNav();
    }
  };

  // 3. Main logic / handler functions
  const handleNavToggleClick = () => toggleNav();

  const handleNavLinkClick = () => closeNav();

  const handleOutsideClick = (event) => {
    if (!navToggle || !navMenu) return;
    const clickedOutside = !navToggle.contains(event.target) && !navMenu.contains(event.target);
    if (clickedOutside) closeNav();
  };

  const handleEscapeKey = (event) => {
    if (event.key === 'Escape') closeNav();
  };

  setCopyrightYear();

  // 4. Event listeners
  if (navToggle) {
    navToggle.addEventListener('click', handleNavToggleClick);
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', handleNavLinkClick);
  });

  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleEscapeKey);
});
