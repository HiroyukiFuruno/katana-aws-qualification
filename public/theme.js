try {
  const lightOrDark = localStorage.getItem('katana-site-theme');
  if (lightOrDark === 'light' || lightOrDark === 'dark') {
    document.documentElement.dataset.theme = lightOrDark;
  }
} catch {
  // CSS follows the system theme when storage is unavailable.
}
