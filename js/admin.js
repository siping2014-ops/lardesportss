(function () {
  const CATEGORIES = [
    { id: "raquettes", label: "Raquettes 球拍" },
    { id: "chaussures", label: "Chaussures 球鞋" },
    { id: "volants", label: "Volants 羽毛球" },
    { id: "cordages", label: "Cordages 球线" },
    { id: "vetements", label: "Vêtements 服装" },
    { id: "sacs", label: "Sacs 球包" },
    { id: "accessoires", label: "Accessoires 配件" },
    { id: "autres-sports", label: "Autres Sports 其他运动" },
  ];

  function formatPrice(value) {
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

  function show(el, visible) {
    el.hidden = !visible;
  }

  function setStatus(message, isError) {
    const box = document.getElementById("status");
    box.textContent = message;
    box.className = isError ? "status error" : "status";
  }

  async function checkSession() {
    const response = await fetch("/api/session");
    const data = await response.json();
    return data.admin;
  }

  async function login(event) {
    event.preventDefault();
    const password = document.getElementById("password").value;
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    });
    if (!response.ok) {
      setStatus("密码错误", true);
      return;
    }
    setStatus("已登录");
    await enterAdmin();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    show(document.getElementById("loginPanel"), true);
    show(document.getElementById("adminPanel"), false);
    setStatus("已退出登录");
  }

  async function loadProducts() {
    const category = document.getElementById("filterCategory").value;
    const url = category ? "/api/products?category=" + encodeURIComponent(category) : "/api/products";
    const response = await fetch(url);
    const products = await response.json();
    const list = document.getElementById("productList");
    if (!products.length) {
      list.innerHTML = "<p>当前没有商品。</p>";
      return;
    }
    list.innerHTML = products
      .map(function (product) {
        return (
          '<article class="admin-card">' +
          '<img src="' + escapeHtml(product.image || "") + '" alt="">' +
          "<div>" +
          "<h3>" + escapeHtml(product.name) + "</h3>" +
          "<p>" + escapeHtml(product.category) + (product.brand ? " · " + escapeHtml(product.brand) : "") + "</p>" +
          "<p>" + escapeHtml(product.description || product.specs || "") + "</p>" +
          "<p><strong>" + escapeHtml(formatPrice(product.price)) + "</strong></p>" +
          "</div>" +
          '<button type="button" data-delete="' + escapeHtml(product.id) + '">删除</button>' +
          "</article>"
        );
      })
      .join("");
  }

  async function createProduct(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const file = data.get("image");
    if (!file || !file.name) {
      data.delete("image");
      const url = document.getElementById("imageUrl").value.trim();
      if (url) data.set("image", url);
    }
    const response = await fetch("/api/products", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error || "添加失败", true);
      return;
    }
    form.reset();
    setStatus("已添加：" + result.name);
    await loadProducts();
  }

  async function deleteProduct(id) {
    if (!window.confirm("确定删除这件商品吗？")) return;
    const response = await fetch("/api/products/" + encodeURIComponent(id), { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error || "删除失败", true);
      return;
    }
    setStatus("已删除");
    await loadProducts();
  }

  async function enterAdmin() {
    show(document.getElementById("loginPanel"), false);
    show(document.getElementById("adminPanel"), true);
    await loadProducts();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const filter = document.getElementById("filterCategory");
    CATEGORIES.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      filter.appendChild(option);
    });

    document.getElementById("loginForm").addEventListener("submit", login);
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("createForm").addEventListener("submit", createProduct);
    filter.addEventListener("change", loadProducts);
    document.getElementById("productList").addEventListener("click", function (event) {
      const id = event.target.getAttribute("data-delete");
      if (id) deleteProduct(id);
    });

    try {
      if (await checkSession()) {
        await enterAdmin();
      }
    } catch (err) {
      setStatus("无法连接后端，请先启动服务器：py -3 backend/app.py", true);
    }
  });
})();
