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

  function priceBlock(product, className) {
    const current = formatPrice(product.price);
    if (product.oldPrice && product.discount) {
      return (
        '<p class="' + className + '">' +
        '<span class="old-price">' + escapeHtml(formatPrice(product.oldPrice)) + "</span>" +
        '<span class="discount-tag">-' + escapeHtml(String(product.discount)) + "%</span> " +
        escapeHtml(current) +
        "</p>"
      );
    }
    return '<p class="' + className + '">' + escapeHtml(current) + "</p>";
  }

  function renderBrandCards(products) {
    const groups = {};
    products.forEach(function (product) {
      const brand = product.brand || "Autres";
      if (!groups[brand]) groups[brand] = [];
      groups[brand].push(product);
    });

    if (!products.length) {
      return '<p class="empty-catalog">Aucun produit pour le moment.</p>';
    }

    return Object.keys(groups)
      .map(function (brand) {
        const cards = groups[brand]
          .map(function (product) {
            const img = product.image || "";
            return (
              '<div class="card">' +
              '<a href="produit.html?id=' + encodeURIComponent(product.id) + '">' +
              '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(product.name) + '">' +
              "</a>" +
              "<div>" +
              "<h4>" + escapeHtml(product.name) + "</h4>" +
              '<p class="specs">' + escapeHtml(product.specs || product.description || "") + "</p>" +
              "</div>" +
              priceBlock(product, "price") +
              '<a class="btn-detail" href="produit.html?id=' + encodeURIComponent(product.id) + '">Voir la fiche →</a>' +
              "</div>"
            );
          })
          .join("");

        return (
          '<div class="brand-section">' +
          '<div class="brand-header">' +
          '<h2 class="brand-title">' + escapeHtml(brand) + "</h2>" +
          '<span class="brand-badge">Marque Officielle</span>' +
          "</div>" +
          '<div class="grid">' + cards + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderGridCards(products) {
    if (!products.length) {
      return '<p class="empty-catalog">Aucun produit pour le moment.</p>';
    }
    return products
      .map(function (product) {
        const img = product.image || "";
        return (
          '<article class="product-card">' +
          '<a href="produit.html?id=' + encodeURIComponent(product.id) + '">' +
          '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(product.name) + '">' +
          "</a>" +
          "<h3>" + escapeHtml(product.name) + "</h3>" +
          '<p class="description">' + escapeHtml(product.description || product.specs || "") + "</p>" +
          priceBlock(product, "price") +
          '<a class="buy-btn" href="produit.html?id=' + encodeURIComponent(product.id) + '">Voir le produit</a>' +
          "</article>"
        );
      })
      .join("");
  }

  async function loadCatalog() {
    const root = document.querySelector("[data-category]");
    if (!root) return;
    const category = root.getAttribute("data-category");
    const layout = root.getAttribute("data-layout") || "grid";
    try {
      const response = await fetch("/api/products?category=" + encodeURIComponent(category));
      const products = await response.json();
      root.innerHTML = layout === "brands" ? renderBrandCards(products) : renderGridCards(products);
    } catch (err) {
      root.innerHTML = "<p>Impossible de charger les produits. Démarrez le serveur backend.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", loadCatalog);
})();
