(() => {
  const stage = document.getElementById('paint-finale');
  const canvas = document.getElementById('paint-finale-canvas');
  const walker = stage && stage.querySelector('.finale-walker');
  if (!stage || !canvas || !walker || !canvas.getContext) return;
  stage.classList.add('is-enhanced');
})();
