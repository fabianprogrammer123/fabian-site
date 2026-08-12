(() => {
  const links = [...document.querySelectorAll('.section-nav a[data-section]')];
  const sections = links
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);
  if (!links.length || !sections.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function selectSection(id) {
    links.forEach((link) => {
      if (link.dataset.section === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  let scrollFrame = 0;
  function updateFromScroll() {
    const readingLine = window.innerHeight * 0.3;
    let current = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= readingLine) current = section;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = sections[sections.length - 1];
    }
    selectSection(current.id);
  }

  function queueScrollUpdate() {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(updateFromScroll);
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.dataset.section);
      if (!target) return;
      event.preventDefault();
      selectSection(link.dataset.section);
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${link.dataset.section}`);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) selectSection(visible.target.id);
  }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.25, 0.75] });

  sections.forEach((section) => observer.observe(section));
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    selectSection(location.hash.slice(1));
  } else {
    updateFromScroll();
  }
  window.addEventListener('scroll', queueScrollUpdate, { passive: true });
  window.addEventListener('resize', queueScrollUpdate, { passive: true });
})();
