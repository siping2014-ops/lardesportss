(function () {
  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    if (Number.isNaN(number)) return "";
    return number.toFixed(2).replace(".", ",") + " €";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function categoryPage(category) {
    const map = {
      raquettes: "raquettes.html",
      chaussures: "chaussures.html",
      volants: "volants.html",
      cordages: "cordages.html",
      vetements: "vetements.html",
      sacs: "sacs.html",
      accessoires: "accesoires.html",
      "autres-sports": "autres-sports.html",
    };
    return map[category] || "index.html";
  }

  async function loadProduct() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const root = document.getElementById("productDetail");
    if (!id || !root) {
      root.innerHTML = "<p>Produit introuvable.</p>";
      return;
    }
    try {
      const response = await fetch("/api/products/" + encodeURIComponent(id));
      if (!response.ok) {
        root.innerHTML = "<p>Produit introuvable.</p>";
        return;
      }
      const product = await response.json();
      const back = categoryPage(product.category);
      const oldPrice = product.oldPrice
        ? '<span class="old-price">' + escapeHtml(formatPrice(product.oldPrice)) + "</span>"
        : "";
      const discount = product.discount
        ? '<span class="discount-tag">-' + escapeHtml(String(product.discount)) + "%</span>"
        : "";
      root.innerHTML =
        '<a class="back-link" href="' + back + '">← Retour à la catégorie</a>' +
        '<div class="detail-card">' +
        '<img src="' + escapeHtml(product.image || "") + '" alt="' + escapeHtml(product.name) + '">' +
        "<div>" +
        (product.brand ? '<p class="brand">' + escapeHtml(product.brand) + "</p>" : "") +
        "<h2>" + escapeHtml(product.name) + "</h2>" +
        (product.specs ? '<p class="specs">' + escapeHtml(product.specs) + "</p>" : "") +
        "<p>" + escapeHtml(product.description || "") + "</p>" +
        '<p class="price">' + oldPrice + discount + " " + escapeHtml(formatPrice(product.price)) + "</p>" +
        "</div>" +
        "</div>";
    } catch (err) {
      root.innerHTML = "<p>Impossible de charger la fiche produit.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", loadProduct);
})();
