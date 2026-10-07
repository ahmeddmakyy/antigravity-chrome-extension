// theme-init.js: apply theme and language before first paint (no flash).
try {
  if (!localStorage.getItem("ag_theme_v3")) {
    localStorage.setItem("ag_theme", "light");
    localStorage.setItem("ag_theme_v3", "1");
  }
  const theme = localStorage.getItem("ag_theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("lang", localStorage.getItem("ag_lang") || "ar");
  document.documentElement.setAttribute("dir", "ltr");
  if (localStorage.getItem("ag_reduce_motion") === "1") document.documentElement.classList.add("reduce-motion");
} catch (e) {}
