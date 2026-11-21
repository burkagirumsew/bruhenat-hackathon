/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Main Interactive Controller (ES6 Module / Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initLiveCountdown();
  initNavigation();
  initApplicationModal();
  initModalDismissal();
  initTrackExpanders();
  initScheduleTabs();
  initFAQAccordion();
  initScrollAnimations();
});

/* --------------------------------------------------------------------------
   1. LIVE COUNTDOWN TIMER
   Configured from EVENT_CONFIG.scheduleMeta.countdownTarget
   -------------------------------------------------------------------------- */
function initLiveCountdown() {
  const targetDateStr = (typeof EVENT_CONFIG !== 'undefined' && EVENT_CONFIG.scheduleMeta) 
    ? EVENT_CONFIG.scheduleMeta.countdownTarget 
    : "2026-12-05T08:30:00+03:00";
    
  const targetTime = new Date(targetDateStr).getTime();

  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  function updateTimer() {
    const now = new Date().getTime();
    const distance = targetTime - now;

    if (distance <= 0) {
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      const badge = document.querySelector('.countdown-date-badge');
      if (badge) badge.textContent = "Sprint In Session!";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

/* --------------------------------------------------------------------------
   2. NAVIGATION & MOBILE DRAWER (Smart Pop-Up Header When Scrolled Back)
   -------------------------------------------------------------------------- */
function initNavigation() {
  const header = document.querySelector('.main-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  let lastScrollY = window.scrollY;
  // Sticky Header: stays visible at the top, enhances background/shadow when scrolled
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

    updateActiveNavLink();
  }, { passive: true });

  // Mobile drawer toggle
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen);
      navToggle.innerHTML = isOpen 
        ? '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        : '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    });

    // Close menu when clicking any nav link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
      });
    });
  }

  // Active link scroll spy
  function updateActiveNavLink() {
    if (window.scrollY < 200) {
      navLinks.forEach(link => {
        if (link.getAttribute('href') === '#home') {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
      return;
    }

    const scrollPos = window.scrollY + 140;
    const sections = document.querySelectorAll('section[id]');

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}` || (id === 'teams' && link.getAttribute('href') === '#who-can-join')) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }
}

/* --------------------------------------------------------------------------
   2B. APPLICATION PORTAL POP-UP MODAL CONTROLLER
   -------------------------------------------------------------------------- */
function initApplicationModal() {
  const modal = document.getElementById('application-portal-modal');
  const closeBtn = document.getElementById('app-portal-close-btn');

  function openModal() {
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Intercept all Apply Now buttons (in navbar, hero, drawer, footer)
  document.querySelectorAll('a[href="#register"], a[href="apply.html"], .btn-open-application').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Check URL hash on initial page load
  if (window.location.hash === '#register' || window.location.hash === '#apply') {
    openModal();
  }
}

/* --------------------------------------------------------------------------
   3. MODAL ESC KEY DISMISSAL
   -------------------------------------------------------------------------- */
function initModalDismissal() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-backdrop.open');
      if (activeModal) {
        activeModal.classList.remove('open');
      }
    }
  });
}

/* --------------------------------------------------------------------------
   4. INNOVATION TRACKS EXPANDABLE DETAILS
   -------------------------------------------------------------------------- */
function initTrackExpanders() {
  const toggleButtons = document.querySelectorAll('.track-details-btn');

  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.track-card');
      const panel = card.querySelector('.track-expandable');
      const isOpen = panel.classList.toggle('open');
      
      button.setAttribute('aria-expanded', isOpen);
      const labelSpan = button.querySelector('.track-btn-label');
      if (labelSpan) {
        labelSpan.textContent = isOpen ? "Hide Details" : "Explore Track Ideas";
      }
      const icon = button.querySelector('svg');
      if (icon) {
        icon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
      }
    });
  });
}

/* --------------------------------------------------------------------------
   5. SCHEDULE TAB SWITCHER (DAY 1 vs DAY 2)
   -------------------------------------------------------------------------- */
function initScheduleTabs() {
  const tabButtons = document.querySelectorAll('.schedule-tab-btn');
  const day1Panel = document.getElementById('schedule-day1');
  const day2Panel = document.getElementById('schedule-day2');

  if (!tabButtons.length || !day1Panel || !day2Panel) return;

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetDay = button.getAttribute('data-day');

      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      if (targetDay === 'day1') {
        day1Panel.style.display = 'block';
        day2Panel.style.display = 'none';
      } else {
        day1Panel.style.display = 'none';
        day2Panel.style.display = 'block';
      }
    });
  });
}

/* --------------------------------------------------------------------------
   6. FAQ ACCORDION & REAL-TIME SEARCH
   -------------------------------------------------------------------------- */
function initFAQAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  const searchInput = document.getElementById('faq-search-input');

  // Toggle item
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question-btn');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all others for clean accordion feel
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('open');
          otherItem.querySelector('.faq-question-btn')?.setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('open', !isOpen);
      questionBtn.setAttribute('aria-expanded', !isOpen);
    });
  });

  // Real-time search filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      faqItems.forEach(item => {
        const questionText = item.querySelector('.faq-question-btn')?.textContent.toLowerCase() || '';
        const answerText = item.querySelector('.faq-answer-panel')?.textContent.toLowerCase() || '';

        if (questionText.includes(query) || answerText.includes(query)) {
          item.style.display = 'block';
          if (query.length > 2) {
            item.classList.add('open');
          }
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
}

/* --------------------------------------------------------------------------
   7. SCROLL ANIMATIONS & REVEALS
   -------------------------------------------------------------------------- */
function initScrollAnimations() {
  // Respect user preference for reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // Animate progress bars if present
        const progressBars = entry.target.querySelectorAll('.criteria-progress-bar-fill');
        progressBars.forEach(bar => {
          const width = bar.getAttribute('data-width');
          if (width) bar.style.width = width;
        });
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.stat-card, .track-card, .criteria-card, .prize-card, .partner-card, .judge-card').forEach(el => {
    observer.observe(el);
  });
}

/* --------------------------------------------------------------------------
   8. THEME TOGGLE CONTROLLER (Light & Dark Mode)
   Instant toggle, persistent storage, respects system preferred scheme
   -------------------------------------------------------------------------- */
function initThemeToggle() {
  const THEME_STORAGE_KEY = 'bruh_enat_theme';
  const toggleButtons = document.querySelectorAll('.theme-toggle-btn, .mobile-theme-toggle-btn');

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {}

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const buttonTitle = `Switch to ${nextTheme === 'light' ? 'Light' : 'Dark'} Mode`;

    toggleButtons.forEach(btn => {
      btn.setAttribute('aria-label', buttonTitle);
      btn.setAttribute('title', buttonTitle);
      const label = btn.querySelector('.mobile-theme-label');
      if (label) {
        label.textContent = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      }
    });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage:', e);
    }
  }

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  });

  // System preferred theme change listener
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      try {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      } catch (err) {}
    });
  }

  // Ensure current attribute matches
  const initialTheme = document.documentElement.getAttribute('data-theme') || getSavedTheme();
  applyTheme(initialTheme);
}
