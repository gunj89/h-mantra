/* =========================================================
   H MANTRA — site scripts
   - Mobile menu toggle                  (all pages)
   - Portfolio filters + project count   (portfolio.html)
   - Image lightbox                      (portfolio.html)
   - Enquiry form -> WhatsApp message    (contact.html)
   Plain JS, no dependencies. Each block only runs if its
   elements exist on the current page.
   ========================================================= */

(function () {
    "use strict";

    /* ---------------------------------------------------------
       MOBILE MENU (hamburger, shown on phones via CSS)
       --------------------------------------------------------- */
    var nav = document.querySelector("header > nav");
    var menu = nav && nav.querySelector("ul");

    if (nav && menu) {
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "nav-toggle";
        toggle.setAttribute("aria-label", "Open menu");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", "site-menu");
        toggle.innerHTML = "&#9776;";
        menu.id = "site-menu";
        nav.appendChild(toggle);

        var setMenu = function (open) {
            menu.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
            toggle.innerHTML = open ? "&#10005;" : "&#9776;";
        };

        toggle.addEventListener("click", function () {
            setMenu(!menu.classList.contains("is-open"));
        });
        menu.addEventListener("click", function (e) {
            if (e.target.closest("a")) setMenu(false);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && menu.classList.contains("is-open")) {
                setMenu(false);
                toggle.focus();
            }
        });
        window.addEventListener("resize", function () {
            if (window.innerWidth > 700) setMenu(false);
        });
    }

    /* ---------------------------------------------------------
       PORTFOLIO FILTERS
       --------------------------------------------------------- */
    var gallery = document.getElementById("portfolio-gallery");

    if (gallery) {
        var items = Array.prototype.slice.call(
            gallery.querySelectorAll(".portfolio-item")
        );
        var filterNav = document.getElementById("portfolio-filters");
        var countEl = document.getElementById("portfolio-count");

        var updateCount = function (n, label) {
            if (!countEl) return;
            countEl.textContent =
                n + (n === 1 ? " project" : " projects") +
                (label && label !== "All" ? " · " + label : "");
        };

        var applyFilter = function (value, label) {
            var shown = 0;
            items.forEach(function (item) {
                var match = value === "all" || item.dataset.category === value;
                item.hidden = !match;
                if (match) shown++;
            });
            updateCount(shown, label);
        };

        if (filterNav) {
            filterNav.addEventListener("click", function (e) {
                var btn = e.target.closest("button[data-filter]");
                if (!btn) return;

                filterNav.querySelectorAll("button").forEach(function (b) {
                    b.setAttribute("aria-pressed", b === btn ? "true" : "false");
                });

                applyFilter(btn.dataset.filter, btn.textContent.trim());
            });
        }

        updateCount(items.length, "All");

        /* -----------------------------------------------------
           LIGHTBOX
           ----------------------------------------------------- */
        var box = document.createElement("div");
        box.className = "lightbox";
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");
        box.setAttribute("aria-label", "Project image viewer");
        box.innerHTML =
            '<button type="button" class="lb-close" aria-label="Close">&times;</button>' +
            '<button type="button" class="lb-prev" aria-label="Previous project">&#8592;</button>' +
            '<figure><img alt=""><figcaption></figcaption></figure>' +
            '<button type="button" class="lb-next" aria-label="Next project">&#8594;</button>';
        document.body.appendChild(box);

        var lbImg = box.querySelector("img");
        var lbCap = box.querySelector("figcaption");
        var lbClose = box.querySelector(".lb-close");
        var lbPrev = box.querySelector(".lb-prev");
        var lbNext = box.querySelector(".lb-next");
        var current = -1;
        var opener = null;

        var visibleItems = function () {
            return items.filter(function (i) { return !i.hidden; });
        };

        var show = function (list, index) {
            var item = list[index];
            var link = item.querySelector("a");
            var thumb = item.querySelector("img");
            current = index;
            lbImg.src = link.getAttribute("href");
            lbImg.alt = thumb ? thumb.alt : "";
            lbCap.textContent = link.dataset.caption || "";

            // warm the cache for the neighbours
            [index - 1, index + 1].forEach(function (i) {
                if (list[i]) {
                    new Image().src = list[i].querySelector("a").getAttribute("href");
                }
            });

            var single = list.length < 2;
            lbPrev.hidden = single;
            lbNext.hidden = single;
        };

        var open = function (item) {
            var list = visibleItems();
            opener = item.querySelector("a");
            show(list, list.indexOf(item));
            box.classList.add("is-open");
            document.body.classList.add("lightbox-open");
            lbClose.focus();
        };

        var close = function () {
            box.classList.remove("is-open");
            document.body.classList.remove("lightbox-open");
            lbImg.removeAttribute("src");
            if (opener) opener.focus();
        };

        var step = function (dir) {
            var list = visibleItems();
            if (list.length < 2) return;
            show(list, (current + dir + list.length) % list.length);
        };

        gallery.addEventListener("click", function (e) {
            var link = e.target.closest(".portfolio-item a");
            if (!link) return;
            e.preventDefault(); // without JS the link still opens the image
            open(link.closest(".portfolio-item"));
        });

        lbClose.addEventListener("click", close);
        lbPrev.addEventListener("click", function () { step(-1); });
        lbNext.addEventListener("click", function () { step(1); });

        // click on the dark backdrop closes
        box.addEventListener("click", function (e) {
            if (e.target === box) close();
        });

        document.addEventListener("keydown", function (e) {
            if (!box.classList.contains("is-open")) return;

            if (e.key === "Escape") close();
            else if (e.key === "ArrowLeft") step(-1);
            else if (e.key === "ArrowRight") step(1);
            else if (e.key === "Tab") {
                // keep keyboard focus inside the dialog
                var focusable = Array.prototype.filter.call(
                    box.querySelectorAll("button"),
                    function (b) { return !b.hidden; }
                );
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        // swipe left / right on touch screens
        var startX = null;
        box.addEventListener("touchstart", function (e) {
            startX = e.touches[0].clientX;
        }, { passive: true });
        box.addEventListener("touchend", function (e) {
            if (startX === null) return;
            var dx = e.changedTouches[0].clientX - startX;
            startX = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        }, { passive: true });
    }

    /* ---------------------------------------------------------
       ENQUIRY FORM -> WHATSAPP
       There is no server, so the form builds a message and opens
       WhatsApp with it pre-filled. The number lives in the
       data-whatsapp attribute on the <form> in contact.html.
       --------------------------------------------------------- */
    var form = document.getElementById("enquiry-form");

    if (form) {
        var note = document.getElementById("form-note");
        var defaultNote = note ? note.textContent : "";

        var setNote = function (text, isError) {
            if (!note) return;
            note.textContent = text;
            note.classList.toggle("is-error", !!isError);
        };

        form.addEventListener("submit", function (e) {
            e.preventDefault();

            var nameEl = form.elements["name"];
            var phoneEl = form.elements["phone"];
            var emailEl = form.elements["email"];
            var typeEl = form.elements["project-type"];
            var msgEl = form.elements["message"];

            var name = nameEl.value.trim();
            var phone = phoneEl.value.trim();
            var email = emailEl.value.trim();
            var message = msgEl.value.trim();
            var type = typeEl.value
                ? typeEl.options[typeEl.selectedIndex].text.trim()
                : "";

            // basic validation
            [nameEl, phoneEl, emailEl].forEach(function (el) {
                el.removeAttribute("aria-invalid");
            });

            var digits = phone.replace(/\D/g, "");
            var problem = null;

            if (!name) {
                nameEl.setAttribute("aria-invalid", "true");
                problem = problem || nameEl;
            }
            if (digits.length < 8 || digits.length > 15) {
                phoneEl.setAttribute("aria-invalid", "true");
                problem = problem || phoneEl;
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                emailEl.setAttribute("aria-invalid", "true");
                problem = problem || emailEl;
            }

            if (problem) {
                setNote("Please check the highlighted fields and try again.", true);
                problem.focus();
                return;
            }

            var lines = [
                "Hello H Mantra, I'd like to discuss a project.",
                "",
                "Name: " + name,
                "Phone: " + phone
            ];
            if (email) lines.push("Email: " + email);
            if (type) lines.push("Project type: " + type);
            if (message) lines.push("", message);

            var number = (form.dataset.whatsapp || "").replace(/\D/g, "");
            var url = "https://wa.me/" + number + "?text=" +
                encodeURIComponent(lines.join("\n"));

            setNote("Opening WhatsApp… just press send there.", false);

            var win = window.open(url, "_blank", "noopener");
            if (!win) {
                // popup blocked -> navigate in the same tab
                window.location.href = url;
            } else {
                window.setTimeout(function () { setNote(defaultNote, false); }, 4000);
            }
        });
    }
})();
