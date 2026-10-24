const CART_STORAGE_KEY = "little-things-cart-v1";
const FREE_SHIPPING_THRESHOLD = 100;
const MAX_QUANTITY_PER_ITEM = 25;
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const grid = document.querySelector("#product-grid");
const cartOverlay = document.querySelector("#cart-overlay");
const checkoutModal = document.querySelector("#checkout-modal");
const toast = document.querySelector("#toast");
let products = [];
let cart = readCart();
let activeCategory = "All";
let toastTimer;
let lastFocusedElement;

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(
        ([id, quantity]) =>
          typeof id === "string" &&
          Number.isInteger(quantity) &&
          quantity > 0 &&
          quantity <= MAX_QUANTITY_PER_ITEM,
      ),
    );
  } catch {
    return {};
  }
}

function persistCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatMoney(value) {
  return formatter.format(value);
}

function getCartCount() {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

function getCartTotal() {
  return products.reduce(
    (sum, product) => sum + product.price * (cart[product.id] || 0),
    0,
  );
}

function renderProducts() {
  const visibleProducts =
    activeCategory === "All"
      ? products
      : products.filter((product) => product.category === activeCategory);
  document.querySelector("#all-count").textContent = products.length;

  if (!visibleProducts.length) {
    grid.innerHTML = '<p class="empty-products">Nothing here just yet.</p>';
    return;
  }

  grid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-image-wrap" style="background-color:${escapeHtml(product.color)}">
            <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.image_alt)}" loading="lazy" />
            ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
            <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">
              Add to bag <span aria-hidden="true">+</span>
            </button>
          </div>
          <div class="product-info">
            <div class="product-meta">
              <span class="product-category">${escapeHtml(product.category)}</span>
              <span class="product-rating"><span aria-hidden="true">★</span> ${escapeHtml(product.rating)} <span>(${escapeHtml(product.reviews)})</span></span>
            </div>
            <h3 class="product-name">${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <span class="product-price">${formatMoney(product.price)}</span>
          </div>
        </article>`,
    )
    .join("");
}

function renderCart() {
  const entries = products.filter((product) => cart[product.id]);
  const count = getCartCount();
  const total = getCartTotal();
  document.querySelector("#cart-count").textContent = count;
  document.querySelector("#panel-count").textContent = `(${count})`;
  document.querySelector("#cart-total").textContent = formatMoney(total);
  document.querySelector("#cart-empty").hidden = entries.length > 0;
  document.querySelector("#cart-footer").hidden = entries.length === 0;

  document.querySelector("#cart-items").innerHTML = entries
    .map(
      (product) => `
        <div class="cart-line">
          <img class="cart-line-image" src="${escapeHtml(product.image)}" alt="" />
          <div>
            <h3 class="cart-line-name">${escapeHtml(product.name)}</h3>
            <span class="cart-line-price">${formatMoney(product.price)} each</span>
            <div class="quantity-control" aria-label="Quantity for ${escapeHtml(product.name)}">
              <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Remove one ${escapeHtml(product.name)}">−</button>
              <span>${cart[product.id]}</span>
              <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Add one ${escapeHtml(product.name)}" ${cart[product.id] >= MAX_QUANTITY_PER_ITEM ? "disabled" : ""}>+</button>
            </div>
          </div>
          <span class="cart-line-total">${formatMoney(product.price * cart[product.id])}</span>
        </div>`,
    )
    .join("");

  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - total, 0);
  document.querySelector("#shipping-note").innerHTML =
    remaining === 0
      ? "You unlocked free shipping — a little something on us!"
      : `You’re ${formatMoney(remaining)} away from free shipping.<div class="shipping-track"><div class="shipping-progress" style="width:${Math.min((total / FREE_SHIPPING_THRESHOLD) * 100, 100)}%"></div></div>`;
}

function changeQuantity(id, change) {
  const current = cart[id] || 0;
  const next = current + change;
  if (next > MAX_QUANTITY_PER_ITEM) {
    showToast("That’s the maximum quantity for this item.");
    return;
  }
  if (next < 1) {
    delete cart[id];
  } else {
    cart[id] = next;
  }
  persistCart();
  renderCart();
}

function openCart() {
  lastFocusedElement = document.activeElement;
  cartOverlay.hidden = false;
  document.body.classList.add("modal-open");
  cartOverlay.querySelector(".icon-button").focus();
}

function closeCart() {
  cartOverlay.hidden = true;
  document.body.classList.toggle("modal-open", !checkoutModal.hidden);
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
}

async function showCheckoutPreview() {
  if (getCartCount() === 0) {
    showToast("Your bag is taking a little breather.");
    return;
  }

  const button = document.querySelector("#checkout-button");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })),
      }),
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || "Could not prepare your order.");

    document.querySelector("#checkout-lines").innerHTML = order.items
      .map(
        (item) => `
          <div class="checkout-line">
            <span>${escapeHtml(item.name)} × ${item.quantity}</span>
            <span>${formatMoney(item.line_total)}</span>
          </div>`,
      )
      .join("");
    document.querySelector("#checkout-total").textContent = formatMoney(order.total);
    document.querySelector("#checkout-content").hidden = false;
    document.querySelector("#order-success").hidden = true;
    cartOverlay.hidden = true;
    checkoutModal.hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector("#close-checkout").focus();
  } catch (error) {
    showToast(error.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function renderReceipt(order) {
  const orderId = `#LT-${String(Date.now()).slice(-6)}`;
  const orderDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const receiptLines = order.items || [];

  document.querySelector("#receipt-order-id").textContent = orderId;
  document.querySelector("#receipt-date").textContent = orderDate;
  document.querySelector("#receipt-count").textContent =
    `${order.item_count} ${order.item_count === 1 ? "item" : "items"}`;
  document.querySelector("#receipt-subtotal").textContent = formatMoney(order.total);
  document.querySelector("#receipt-total").textContent = formatMoney(order.total);
  document.querySelector("#receipt-shipping").textContent = order.total >= FREE_SHIPPING_THRESHOLD ? "Free" : "Calculated at checkout";
  document.querySelector("#receipt-lines").innerHTML = receiptLines
    .map(
      (item) => `
        <div class="receipt-line">
          <div>
            <span class="receipt-line-name">${escapeHtml(item.name)}</span>
            <span class="receipt-line-meta">Qty ${item.quantity}</span>
          </div>
          <strong>${formatMoney(item.line_total)}</strong>
        </div>`,
    )
    .join("");
}

async function placeDemoOrder() {
  const button = document.querySelector("#place-order-button");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })),
      }),
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || "Could not place your demo order.");

    document.querySelector("#success-message").textContent =
      `Your ${order.item_count} ${order.item_count === 1 ? "item" : "items"} (${formatMoney(order.total)}) are all wrapped up. Thanks for shopping small.`;
    renderReceipt(order);
    document.querySelector("#checkout-content").hidden = true;
    document.querySelector("#order-success").hidden = false;
    cart = {};
    persistCart();
    renderCart();
    document.querySelector("#continue-shopping").focus();
  } catch (error) {
    showToast(error.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

document.querySelector("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter-button").forEach((filter) => {
    const selected = filter === button;
    filter.classList.toggle("active", selected);
    filter.setAttribute("aria-pressed", String(selected));
  });
  renderProducts();
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.add);
  if (!product) return;
  if ((cart[product.id] || 0) >= MAX_QUANTITY_PER_ITEM) {
    showToast("That’s the maximum quantity for this item.");
    return;
  }
  cart[product.id] = (cart[product.id] || 0) + 1;
  persistCart();
  renderCart();
  showToast(`${product.name} added to your bag.`);
});

document.querySelector("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (button) changeQuantity(button.dataset.quantity, Number(button.dataset.change));
});

document.querySelector("#cart-trigger").addEventListener("click", openCart);
document.querySelectorAll("[data-close-cart]").forEach((button) =>
  button.addEventListener("click", closeCart),
);
document.querySelector("#checkout-button").addEventListener("click", showCheckoutPreview);
document.querySelector("#close-checkout").addEventListener("click", () => {
  checkoutModal.hidden = true;
  document.body.classList.remove("modal-open");
  document.querySelector("#cart-trigger").focus();
});
document.querySelector("#place-order-button").addEventListener("click", placeDemoOrder);
document.querySelector("#continue-shopping").addEventListener("click", () => {
  checkoutModal.hidden = true;
  document.body.classList.remove("modal-open");
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth" });
});
document.querySelector("#year").textContent = new Date().getFullYear();

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!checkoutModal.hidden) {
    checkoutModal.hidden = true;
    document.body.classList.remove("modal-open");
    document.querySelector("#cart-trigger").focus();
  } else if (!cartOverlay.hidden) {
    closeCart();
  }
});

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("The product list could not be loaded.");
    const data = await response.json();
    products = data.products;
    const productIds = new Set(products.map((product) => product.id));
    cart = Object.fromEntries(
      Object.entries(cart).filter(([id]) => productIds.has(id)),
    );
    persistCart();
    renderProducts();
    renderCart();
  } catch (error) {
    grid.innerHTML = `<p class="empty-products">${escapeHtml(error.message)} Please refresh to try again.</p>`;
  }
}

renderCart();
loadProducts();
