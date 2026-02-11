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

    // Image Comparison Slider
    const slider = document.getElementById('imageComparisonSlider');
    const overlay = document.getElementById('comparisonOverlay');
    const handle = document.getElementById('sliderHandle');

    if (slider && overlay && handle) {
        let isSliding = false;

        function updateSlider(x) {
            const rect = slider.getBoundingClientRect();
            const position = ((x - rect.left) / rect.width) * 100;
            const clampedPosition = Math.max(0, Math.min(100, position));
            
            overlay.style.width = clampedPosition + '%';
            handle.style.left = clampedPosition + '%';
        }

        // Mouse events
        handle.addEventListener('mousedown', (e) => {
            isSliding = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isSliding) return;
            updateSlider(e.clientX);
        });

        document.addEventListener('mouseup', () => {
            isSliding = false;
        });

        // Touch events for mobile
        handle.addEventListener('touchstart', (e) => {
            isSliding = true;
        });

        document.addEventListener('touchmove', (e) => {
            if (!isSliding) return;
            const touch = e.touches[0];
            updateSlider(touch.clientX);
        });

        document.addEventListener('touchend', () => {
            isSliding = false;
        });

        // Click anywhere on the slider to jump to that position
        slider.addEventListener('click', (e) => {
            if (e.target !== handle && !handle.contains(e.target)) {
                updateSlider(e.clientX);
            }
        });

        // Keyboard accessibility
        handle.setAttribute('tabindex', '0');
        handle.setAttribute('role', 'slider');
        handle.setAttribute('aria-label', 'Image comparison slider');
        handle.setAttribute('aria-valuemin', '0');
        handle.setAttribute('aria-valuemax', '100');
        handle.setAttribute('aria-valuenow', '50');

        handle.addEventListener('keydown', (e) => {
            const rect = slider.getBoundingClientRect();
            const currentPosition = ((handle.offsetLeft / rect.width) * 100);
            let newPosition = currentPosition;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                newPosition = Math.max(0, currentPosition - 2);
                e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                newPosition = Math.min(100, currentPosition + 2);
                e.preventDefault();
            } else if (e.key === 'Home') {
                newPosition = 0;
                e.preventDefault();
            } else if (e.key === 'End') {
                newPosition = 100;
                e.preventDefault();
            }

            if (newPosition !== currentPosition) {
                overlay.style.width = newPosition + '%';
                handle.style.left = newPosition + '%';
                handle.setAttribute('aria-valuenow', Math.round(newPosition));
            }
        });
    }

});