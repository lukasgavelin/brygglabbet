/**
 * Mobile Navigation & Screen Switcher Manager.
 * Manages tab switching in bottom app bar and mobile menu interactions.
 */

export function setupMobileNav() {
  const navBtns = document.querySelectorAll('.mobile-nav-btn');
  const screens = document.querySelectorAll('.mobile-screen');

  if (navBtns.length === 0 || screens.length === 0) return;

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetScreenId = btn.dataset.screen;
      if (!targetScreenId) return;

      // Update active nav button
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Show target screen, hide others
      screens.forEach((screen) => {
        if (screen.id === targetScreenId) {
          screen.classList.add('active');
        } else {
          screen.classList.remove('active');
        }
      });

      // Scroll view to top when changing screens
      const container = document.getElementById('mobile-screen-container');
      if (container) container.scrollTop = 0;
    });
  });

  // Mobile Kebab / Hamburger menu setup
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuDropdown = document.getElementById('mobile-menu-dropdown');
  const menuBackdrop = document.getElementById('mobile-menu-backdrop');

  if (menuBtn && menuDropdown) {
    const toggleMenu = () => {
      const isOpen = menuDropdown.classList.contains('open');
      if (isOpen) {
        menuDropdown.classList.remove('open');
        menuBackdrop?.classList.remove('active');
      } else {
        menuDropdown.classList.add('open');
        menuBackdrop?.classList.add('active');
      }
    };

    menuBtn.addEventListener('click', toggleMenu);
    menuBackdrop?.addEventListener('click', toggleMenu);

    // Close menu when clicking items inside
    menuDropdown.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        menuDropdown.classList.remove('open');
        menuBackdrop?.classList.remove('active');
      });
    });
  }
}
