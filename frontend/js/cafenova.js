/* =========================================================================
   THE WREN & BEAN — TABLE ORDERING APP
   Plain vanilla JavaScript. No frameworks, no page reloads.

   File is organized top-to-bottom as:
     1. Config & data          — things you'd actually edit day to day
     2. State                  — the single source of truth for the cart
     3. DOM references         — cached once, reused everywhere
     4. Helpers                — small, reusable, no side effects
     5. Rendering              — turns state into HTML
     6. Event handlers         — turns user actions into state changes
     7. Networking             — talks to the Flask backend
     8. Init                   — wires everything up on page load
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. CONFIG & DATA
   ------------------------------------------------------------------------- */

// The one and only backend endpoint this app talks to. The Flask API is
// treated as a black box — we only ever send it the shape it expects.
console.log("JS Loaded");
const API_URL = "https://cafenova-backend.onrender.com/api/orders";

// Change this to switch currency symbol app-wide.
const CURRENCY_SYMBOL = "₹";

// The menu itself. In a larger app this might come from its own API
// endpoint, but the brief only defines /api/orders, so it's kept here as
// a simple, easy-to-edit data set.
const MENU = [
  { id: "esp01", category: "Coffee", name: "Espresso", price: 90, desc: "Double shot, pulled fresh." },
  { id: "cap01", category: "Coffee", name: "Cappuccino", price: 140, desc: "Espresso, steamed milk, thick foam." },
  { id: "lat01", category: "Coffee", name: "Caffè Latte", price: 150, desc: "Espresso with silky steamed milk." },
  { id: "flt01", category: "Coffee", name: "Filter Coffee", price: 110, desc: "South Indian style, brewed slow." },
  { id: "col01", category: "Coffee", name: "Cold Brew", price: 160, desc: "Steeped 18 hours, served over ice." },

  { id: "tea01", category: "Tea", name: "Masala Chai", price: 80, desc: "Hand-ground spices, simmered in milk." },
  { id: "tea02", category: "Tea", name: "Green Tea", price: 90, desc: "Light, grassy, single-origin leaves." },
  { id: "tea03", category: "Tea", name: "Peppermint Infusion", price: 95, desc: "Caffeine-free, served hot." },

  { id: "pas01", category: "Pastries", name: "Butter Croissant", price: 120, desc: "Laminated dough, baked to order." },
  { id: "pas02", category: "Pastries", name: "Almond Danish", price: 140, desc: "Flaky pastry, toasted almond cream." },
  { id: "pas03", category: "Pastries", name: "Banana Walnut Loaf", price: 110, desc: "Moist, dense, lightly spiced." },

  { id: "brk01", category: "Breakfast", name: "Avocado Toast", price: 220, desc: "Sourdough, chili flakes, lime." },
  { id: "brk02", category: "Breakfast", name: "Classic Eggs Benedict", price: 260, desc: "Poached eggs, hollandaise, muffin." },
  { id: "brk03", category: "Breakfast", name: "Greek Yoghurt Bowl", price: 180, desc: "Granola, honey, seasonal fruit." },

  { id: "snd01", category: "Sandwiches", name: "Grilled Paneer Sandwich", price: 190, desc: "Smoked paneer, mint chutney." },
  { id: "snd02", category: "Sandwiches", name: "Club Sandwich", price: 230, desc: "Triple deck, chicken, egg, veggies." },
  { id: "snd03", category: "Sandwiches", name: "Caprese Panini", price: 210, desc: "Mozzarella, tomato, basil, pesto." },
];

/* -------------------------------------------------------------------------
   2. STATE
   ------------------------------------------------------------------------- */

const state = {
  activeCategory: "All",
  // cart is a map of menuItemId -> quantity. Keeping only quantities here
  // (rather than duplicating name/price) means there is exactly one place
  // that owns each item's details: the MENU array above.
  cart: {},
  tableNumber: "",
};

/* -------------------------------------------------------------------------
   3. DOM REFERENCES
   ------------------------------------------------------------------------- */

const dom = {
  tableBadgeNumber: document.getElementById("tableBadgeNumber"),
  categoryTabs: document.getElementById("categoryTabs"),
  menuGrid: document.getElementById("menuGrid"),

  cartFab: document.getElementById("cartFab"),
  cartCount: document.getElementById("cartCount"),
  cartDrawer: document.getElementById("cartDrawer"),
  cartClose: document.getElementById("cartClose"),
  drawerOverlay: document.getElementById("drawerOverlay"),

  ticketItems: document.getElementById("ticketItems"),
  ticketTotal: document.getElementById("ticketTotal"),
  placeOrderTotal: document.getElementById("placeOrderTotal"),

  customerForm: document.getElementById("customerForm"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerTable: document.getElementById("customerTable"),
  customerInstructions: document.getElementById("customerInstructions"),
  formError: document.getElementById("formError"),
  placeOrderBtn: document.getElementById("placeOrderBtn"),

  confirmationScreen: document.getElementById("confirmationScreen"),
  confirmationStamp: document.getElementById("confirmationStamp"),
  confirmationName: document.getElementById("confirmationName"),
  confirmationTable: document.getElementById("confirmationTable"),
  confirmationItems: document.getElementById("confirmationItems"),
  confirmationTotal: document.getElementById("confirmationTotal"),
  newOrderBtn: document.getElementById("newOrderBtn"),
};

/* -------------------------------------------------------------------------
   4. HELPERS
   ------------------------------------------------------------------------- */

/** Formats a number as a currency string, e.g. 140 -> "₹140.00" */
function formatCurrency(amount) {
  return `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
}

/** Looks up a menu item by its id. Returns undefined if not found. */
function findMenuItem(id) {
  return MENU.find((item) => item.id === id);
}

/** Reads ?table=5 from the page URL. Returns "" if not present. */
function getTableFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("table") || "";
}

/** Returns the list of unique categories, with "All" first. */
function getCategories() {
  const unique = [...new Set(MENU.map((item) => item.category))];
  return ["All", ...unique];
}

/** Builds the cart as an array of { item, qty } pairs, in menu order. */
function getCartEntries() {
  return MENU.filter((item) => state.cart[item.id] > 0).map((item) => ({
    item,
    qty: state.cart[item.id],
  }));
}

/** Total price of everything currently in the cart. */
function getCartTotal() {
  return getCartEntries().reduce((sum, { item, qty }) => sum + item.price * qty, 0);
}

/** Total number of items (not line items) currently in the cart. */
function getCartItemCount() {
  return Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
}

/* -------------------------------------------------------------------------
   5. RENDERING
   Rendering functions only ever read `state` and write to `dom`. They
   never mutate state themselves — that keeps the data flow one-directional
   and easy to follow: event handler changes state -> render() reflects it.
   ------------------------------------------------------------------------- */

function renderCategoryTabs() {
  dom.categoryTabs.innerHTML = "";
  getCategories().forEach((category) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "category-tab" + (category === state.activeCategory ? " is-active" : "");
    tab.textContent = category;
    tab.dataset.category = category;
    dom.categoryTabs.appendChild(tab);
  });
}

function renderMenu() {
  const items = MENU.filter(
    (item) => state.activeCategory === "All" || item.category === state.activeCategory
  );

  dom.menuGrid.innerHTML = "";
  items.forEach((item) => dom.menuGrid.appendChild(createMenuCard(item)));
}

/** Builds a single menu card. Shows an "Add" button, or a qty stepper if the item is already in the cart. */
function createMenuCard(item) {
  const card = document.createElement("article");
  card.className = "menu-card";

  const qty = state.cart[item.id] || 0;

  card.innerHTML = `
    <div class="menu-card-top">
      <span class="menu-card-name">${item.name}</span>
      <span class="menu-card-price">${formatCurrency(item.price)}</span>
    </div>
    <p class="menu-card-desc">${item.desc}</p>
    <div class="menu-card-footer" data-role="footer"></div>
  `;

  const footer = card.querySelector('[data-role="footer"]');
  footer.appendChild(qty > 0 ? createQtyStepper(item.id, qty) : createAddButton(item.id));

  return card;
}

function createAddButton(itemId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-btn";
  button.textContent = "Add to order";
  button.dataset.action = "add";
  button.dataset.id = itemId;
  return button;
}

/** A small +/- stepper, reused for both the menu card and the cart ticket. */
function createQtyStepper(itemId, qty, { compact = false } = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = compact ? "ticket-item-controls" : "qty-stepper";
  wrapper.innerHTML = `
    <button type="button" data-action="decrease" data-id="${itemId}" aria-label="Decrease quantity">−</button>
    <span class="qty-value">${qty}</span>
    <button type="button" data-action="increase" data-id="${itemId}" aria-label="Increase quantity">+</button>
  `;
  return wrapper;
}

/** Renders the order ticket inside the cart drawer. */
function renderTicket() {
  const entries = getCartEntries();
  dom.ticketItems.innerHTML = "";

  if (entries.length === 0) {
    dom.ticketItems.innerHTML = `<p class="ticket-empty">Your ticket is empty — add something from the menu.</p>`;
  } else {
    entries.forEach(({ item, qty }) => dom.ticketItems.appendChild(createTicketLine(item, qty)));
  }

  const total = getCartTotal();
  dom.ticketTotal.textContent = formatCurrency(total);
  dom.placeOrderTotal.textContent = formatCurrency(total);
}

/** One line of the order ticket: name ... price, plus qty controls and a remove link. */
function createTicketLine(item, qty) {
  const line = document.createElement("div");
  line.className = "ticket-item";
  line.innerHTML = `
    <div class="ticket-item-row">
      <span class="ticket-item-name">${item.name}</span>
      <span class="ticket-item-leader"></span>
      <span class="ticket-item-price">${formatCurrency(item.price * qty)}</span>
    </div>
    <div class="ticket-item-row" data-role="controls"></div>
  `;

  const controlsRow = line.querySelector('[data-role="controls"]');
  controlsRow.appendChild(createQtyStepper(item.id, qty, { compact: true }));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "ticket-item-remove";
  removeBtn.textContent = "Remove";
  removeBtn.dataset.action = "remove";
  removeBtn.dataset.id = item.id;
  controlsRow.appendChild(removeBtn);

  return line;
}

function updateCartCount() {
  dom.cartCount.textContent = getCartItemCount();
}

/** Re-renders every part of the UI that depends on the cart. Call this after any cart change. */
function refreshCartUI() {
  renderMenu(); // menu cards need to flip between "Add" and stepper
  renderTicket();
  updateCartCount();
}

/* -------------------------------------------------------------------------
   6. EVENT HANDLERS
   ------------------------------------------------------------------------- */

function addToCart(itemId) {
  state.cart[itemId] = (state.cart[itemId] || 0) + 1;
  refreshCartUI();
}

function increaseQty(itemId) {
  addToCart(itemId);
}

function decreaseQty(itemId) {
  if (!state.cart[itemId]) return;
  state.cart[itemId] -= 1;
  if (state.cart[itemId] <= 0) delete state.cart[itemId];
  refreshCartUI();
}

function removeFromCart(itemId) {
  delete state.cart[itemId];
  refreshCartUI();
}

// Event delegation: one listener per container handles clicks for every
// card / ticket line, current or future, instead of attaching one listener
// per button (which is what leads to duplicated wiring code).
function handleDelegatedClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action, id } = target.dataset;
  if (action === "add") addToCart(id);
  if (action === "increase") increaseQty(id);
  if (action === "decrease") decreaseQty(id);
  if (action === "remove") removeFromCart(id);
}

function handleCategoryTabClick(event) {
  const tab = event.target.closest(".category-tab");
  if (!tab) return;
  state.activeCategory = tab.dataset.category;
  renderCategoryTabs();
  renderMenu();
}

function openCart() {
  dom.cartDrawer.classList.add("is-open");
  dom.drawerOverlay.classList.add("is-open");
}

function closeCart() {
  dom.cartDrawer.classList.remove("is-open");
  dom.drawerOverlay.classList.remove("is-open");
}

/** Validates the customer form. Returns an error message, or "" if valid. */
function validateOrder() {
  if (getCartItemCount() === 0) return "Add at least one item to your order first.";
  if (!dom.customerName.value.trim()) return "Please enter your name.";
  if (!/^\d{7,15}$/.test(dom.customerPhone.value.trim())) return "Please enter a valid phone number.";
  if (!dom.customerTable.value.trim()) return "Please enter your table number.";
  return "";
}

function showFormError(message) {
  dom.formError.textContent = message;
  dom.formError.classList.toggle("is-visible", Boolean(message));
}

/* -------------------------------------------------------------------------
   7. NETWORKING
   ------------------------------------------------------------------------- */

/** Builds the exact JSON payload the Flask API expects. */
function buildOrderPayload() {
  const items = getCartEntries().map(({ item, qty }) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    qty: qty,
  }));

  return {
    customer: dom.customerName.value.trim(),
    phone: dom.customerPhone.value.trim(),
    table: dom.customerTable.value.trim(),
    instructions: dom.customerInstructions.value.trim(),
    items: items,
    total: getCartTotal(),
  };
}

async function submitOrder(event) {
  event.preventDefault();
  console.log("submitOrder called");

  const error = validateOrder();
  if (error) {
    showFormError(error);
    return;
  }
  showFormError("");

  const payload = buildOrderPayload();

  dom.placeOrderBtn.disabled = true;
  dom.placeOrderBtn.textContent = "Placing order…";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);

    const result = await response.json().catch(() => ({}));
    showConfirmation(payload, result);
    return;
    //resetOrder();
  } catch (err) {
    showFormError("Couldn't reach the kitchen — please check your connection and try again.");
    console.error("Order submission failed:", err);
  } finally {
    dom.placeOrderBtn.disabled = false;
    dom.placeOrderBtn.textContent = `Place Order — ${formatCurrency(getCartTotal())}`;
  }
}

/* -------------------------------------------------------------------------
   8. CONFIRMATION SCREEN
   ------------------------------------------------------------------------- */
function showConfirmation(payload, serverResult) {

  // baaki code...

  const orderNumber =
    serverResult.orderId ||
    serverResult.order_id ||
    serverResult.id ||
    String(Date.now()).slice(-4);



  dom.confirmationStamp.textContent = `#${orderNumber}`;
  dom.confirmationName.textContent = payload.customer;
  dom.confirmationTable.textContent = payload.table;
  dom.confirmationTotal.textContent = formatCurrency(payload.total);

  dom.confirmationItems.innerHTML = "";

  payload.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "ticket-item-row";
    row.innerHTML = `
      <span class="ticket-item-name">${item.qty} × ${item.name}</span>
      <span class="ticket-item-leader"></span>
      <span class="ticket-item-price">${formatCurrency(item.price * item.qty)}</span>
    `;
    dom.confirmationItems.appendChild(row);
  });

  closeCart();

  dom.confirmationScreen.classList.add("is-open");


}

function hideConfirmation() {
  dom.confirmationScreen.classList.remove("is-open");
}
/** Clears the cart and form after a successful order, ready for the next one. */
function resetOrder() {
  state.cart = {};
  dom.customerForm.reset();
  dom.customerTable.value = state.tableNumber; // keep the table pre-filled
  refreshCartUI();
}

/* -------------------------------------------------------------------------
   9. INIT
   ------------------------------------------------------------------------- */

function init() {
  // QR table detection: a QR code on the physical table links to
  // index.html?table=5, so we read it once on load.
  state.tableNumber = getTableFromURL();
  dom.tableBadgeNumber.textContent = state.tableNumber || "—";
  dom.customerTable.value = state.tableNumber;

  renderCategoryTabs();
  renderMenu();
  renderTicket();
  updateCartCount();

  // Event delegation — one listener per container, no per-item wiring.
  dom.categoryTabs.addEventListener("click", handleCategoryTabClick);
  dom.menuGrid.addEventListener("click", handleDelegatedClick);
  dom.ticketItems.addEventListener("click", handleDelegatedClick);

  dom.cartFab.addEventListener("click", openCart);
  dom.cartClose.addEventListener("click", closeCart);
  dom.drawerOverlay.addEventListener("click", closeCart);

  dom.customerForm.addEventListener("submit", submitOrder);

  dom.newOrderBtn.addEventListener("click", hideConfirmation);
}

document.addEventListener("DOMContentLoaded", init);