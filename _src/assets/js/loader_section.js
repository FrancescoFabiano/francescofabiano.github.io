// Remove loaders when the entire page (all resources) has fully loaded
window.addEventListener("load", () => {
    document.querySelectorAll(".loader_sec").forEach(loader => {
      loader.classList.add("hidden"); // Fade out and remove the loader
    });
    document.querySelectorAll(".loader_nav").forEach(loader => {
        loader.classList.add("hidden"); // Fade out and remove the loader
      });
});