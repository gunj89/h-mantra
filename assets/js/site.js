document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.querySelector("#portfolio-gallery");
  const filters = document.querySelectorAll("#portfolio-filters [data-filter]");
  if (gallery && filters.length) {
    filters.forEach((button) => button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filters.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      gallery.querySelectorAll(".portfolio-item").forEach((card) => {
        card.hidden = filter !== "all" && !card.dataset.category.split(/\s+/).includes(filter);
      });
    }));
  }

  const form = document.querySelector("#enquiry-form");
  if (form) form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const message = [
      "Hello H Mantra, I'd like to discuss a project.",
      `Name: ${values.get("name")}`,
      `Phone: ${values.get("phone")}`,
      values.get("email") ? `Email: ${values.get("email")}` : "",
      values.get("project-type") ? `Project type: ${values.get("project-type")}` : "",
      values.get("message") ? `Details: ${values.get("message")}` : ""
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/919106940350?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
});
