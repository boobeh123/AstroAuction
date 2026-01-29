document.addEventListener('DOMContentLoaded', () => {
    // Copyright year
    const yearSpan = document.querySelector('#copyright');
    if (yearSpan) {
        yearSpan.innerHTML = `&copy; ${new Date().getFullYear()} The Lost And Found LLC. All rights reserved.`;
    }

    // Mobile menu toggle
    const navToggle = document.querySelector('#nav-toggle');
    const navMenu = document.querySelector('#nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('is-active');
        });
    }

    // Close mobile menu when clicking a nav link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navToggle && navMenu) {
                navToggle.setAttribute('aria-expanded', 'false');
                navMenu.classList.remove('is-active');
            }
        });
    });

    // Close mobile menu when clicking outside nav menu
    document.addEventListener('click', (e) => {
        if (navToggle && navMenu && !navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navToggle.setAttribute('aria-expanded', 'false');
            navMenu.classList.remove('is-active');
        }
    });

    // Close mobile menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navToggle) {
            navToggle.setAttribute('aria-expanded', 'false');
            navMenu?.classList.remove('is-active');
        }
    });

});