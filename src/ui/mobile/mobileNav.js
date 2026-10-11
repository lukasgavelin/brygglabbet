export const MOBILE_SCREEN_ORDER = [
  'mobile-screen-recipe',
  'mobile-screen-malt',
  'mobile-screen-hops',
  'mobile-screen-yeast',
  'mobile-screen-brew',
];

/**
 * Switches the active screen with optional directional transition animation.
 * @param {string} targetScreenId
 * @param {'next'|'prev'|null} [direction=null]
 */
export function switchToScreen(targetScreenId, direction = null) {
  const navBtns = document.querySelectorAll('.mobile-nav-btn');
  const screens = document.querySelectorAll('.mobile-screen');
  const targetScreen = document.getElementById(targetScreenId);
  if (!targetScreen) return;

  // 1. Update active state in bottom nav
  navBtns.forEach((btn) => {
    if (btn.dataset.screen === targetScreenId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 2. Animate and toggle screens
  screens.forEach((screen) => {
    screen.classList.remove('slide-in-right', 'slide-in-left');
    if (screen.id === targetScreenId) {
      screen.classList.add('active');
      if (direction === 'next') {
        screen.classList.add('slide-in-right');
      } else if (direction === 'prev') {
        screen.classList.add('slide-in-left');
      }
    } else {
      screen.classList.remove('active');
    }
  });

  // 3. Scroll container to top
  const container = document.getElementById('mobile-screen-container');
  if (container) container.scrollTop = 0;

  // 4. Subtle haptic feedback
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(6);
    } catch {
      // Ignore vibration errors
    }
  }
}

export function setupMobileNav() {
  const navBtns = document.querySelectorAll('.mobile-nav-btn');

  // Bottom Nav click triggers
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetScreenId = btn.dataset.screen;
      if (!targetScreenId) return;

      const currentActive = document.querySelector('.mobile-screen.active');
      const currentIdx = currentActive ? MOBILE_SCREEN_ORDER.indexOf(currentActive.id) : 0;
      const targetIdx = MOBILE_SCREEN_ORDER.indexOf(targetScreenId);
      const direction = targetIdx > currentIdx ? 'next' : targetIdx < currentIdx ? 'prev' : null;

      switchToScreen(targetScreenId, direction);
    });
  });

  // Touch Gesture (Horizontal Swipe) Setup on screen container
  setupSwipeGestures();

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

/**
 * Attaches touch event listeners to detect smooth horizontal swiping between screens.
 */
function setupSwipeGestures() {
  const container = document.getElementById('mobile-screen-container');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  container.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    },
    { passive: true }
  );

  container.addEventListener(
    'touchend',
    (e) => {
      if (e.changedTouches.length !== 1) return;
      const elapsed = Date.now() - startTime;
      if (elapsed > 550) return; // Ignore long drags

      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;

      // Ensure horizontal swipe is dominant and above threshold (45px)
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
        return;
      }

      // Check if user is touching an interactive stepper or input
      const target = e.target;
      if (target && target.closest('input, select, textarea, .stepper-btn, .mobile-stepper')) {
        return;
      }

      const currentActive = document.querySelector('.mobile-screen.active');
      if (!currentActive) return;
      const currentIdx = MOBILE_SCREEN_ORDER.indexOf(currentActive.id);
      if (currentIdx === -1) return;

      // Swipe Left -> Next Screen
      if (deltaX < 0 && currentIdx < MOBILE_SCREEN_ORDER.length - 1) {
        switchToScreen(MOBILE_SCREEN_ORDER[currentIdx + 1], 'next');
      }
      // Swipe Right -> Prev Screen
      else if (deltaX > 0 && currentIdx > 0) {
        switchToScreen(MOBILE_SCREEN_ORDER[currentIdx - 1], 'prev');
      }
    },
    { passive: true }
  );
}

