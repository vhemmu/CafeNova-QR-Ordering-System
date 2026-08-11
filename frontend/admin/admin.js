/* ---------------------------------------------------------
   DEMO STAFF LOGIN
   NOTE: This is frontend-only demo access protection.
   It is NOT secure production authentication.
--------------------------------------------------------- */

const DEMO_USERS = {
    kitchen: {
        username: "kitchen",
        password: "CafeKitchen@2026"
    },
    manager: {
        username: "manager",
        password: "CafeManager@2026"
    }
};

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginRole = document.getElementById("loginRole");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

function showDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
}

function showLogin() {
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
}

function isLoggedIn() {
    return sessionStorage.getItem("cafeNovaStaffRole") !== null;
}

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const role = loginRole.value;
    const user = DEMO_USERS[role];

    if (
        user &&
        loginUsername.value.trim() === user.username &&
        loginPassword.value === user.password
    ) {
        sessionStorage.setItem("cafeNovaStaffRole", role);
        loginError.classList.add("hidden");
        loginPassword.value = "";
        showDashboard();
        loadOrders();
        return;
    }

    loginError.classList.remove("hidden");
});

logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("cafeNovaStaffRole");
    showLogin();
});

if (isLoggedIn()) {
    showDashboard();
} else {
    showLogin();
}

const API_URL = "https://cafenova-backend.onrender.com/api/orders";

const ordersContainer = document.getElementById("ordersContainer");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const emptyMessage = document.getElementById("emptyMessage");

const pendingCount = document.getElementById("pendingCount");
const preparingCount = document.getElementById("preparingCount");
const readyCount = document.getElementById("readyCount");
const completedCount = document.getElementById("completedCount");

const connectionStatus = document.getElementById("connectionStatus");
const lastUpdated = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");


/* ---------------------------------------------------------
   LOAD ORDERS
--------------------------------------------------------- */

async function loadOrders() {

    showLoading();

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(
                `Server responded with ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(
                data.error || "Failed to load orders."
            );
        }

        setConnectionStatus(true);

        displayOrders(data.orders);

        updateStatistics(data.orders);

        lastUpdated.textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {

        console.error("Failed to load orders:", error);

        setConnectionStatus(false);

        showError();

    }
}


/* ---------------------------------------------------------
   DISPLAY ORDERS
--------------------------------------------------------- */

function displayOrders(orders) {

    ordersContainer.innerHTML = "";

    hideAllMessages();

    if (!orders || orders.length === 0) {

        emptyMessage.classList.remove("hidden");

        return;
    }

    orders.forEach(order => {

        const orderCard = createOrderCard(order);

        ordersContainer.appendChild(orderCard);

    });
}


/* ---------------------------------------------------------
   CREATE ORDER CARD
--------------------------------------------------------- */

function createOrderCard(order) {

    const card = document.createElement("div");

    card.className = "order-card";

    const status = order.status || "pending";

    const itemsHTML = order.items
        .map(item => `
            <div class="order-item">
                <span class="item-name">
                    ${escapeHTML(item.name)}
                </span>

                <span class="item-qty">
                    × ${item.qty}
                </span>
            </div>
        `)
        .join("");


    let instructionsHTML = "";

    if (order.instructions && order.instructions.trim() !== "") {

        instructionsHTML = `
            <div class="instructions">
                <strong>Instructions</strong>
                ${escapeHTML(order.instructions)}
            </div>
        `;
    }


    const actionButtons = getActionButtons(order);


    card.innerHTML = `
        <div class="order-header">

            <div>
                <div class="order-number">
                    Order #${order.id}
                </div>

                <div class="table-number">
                    Table ${escapeHTML(String(order.table))}
                </div>
            </div>

            <span class="order-status status-${status}">
                ${escapeHTML(status)}
            </span>

        </div>


        <div class="customer-info">

            <div class="customer-name">
                ${escapeHTML(order.customer)}
            </div>

            <div class="customer-phone">
                ${escapeHTML(order.phone)}
            </div>

        </div>


        <div class="order-items">
            ${itemsHTML}
        </div>


        ${instructionsHTML}


        <div class="order-total">

            <span>Total</span>

            <span>₹${Number(order.total).toFixed(2)}</span>

        </div>


        <div class="order-actions">
            ${actionButtons}
        </div>
    `;


    /* Attach status button events */

    const buttons = card.querySelectorAll("[data-status]");

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            const newStatus = button.dataset.status;

            updateOrderStatus(order.id, newStatus);

        });

    });


    return card;
}


/* ---------------------------------------------------------
   ACTION BUTTONS
--------------------------------------------------------- */

function getActionButtons(order) {

    const status = order.status || "pending";


    if (status === "pending") {

        return `
            <button
                class="btn-primary"
                data-status="preparing"
            >
                Start Preparing
            </button>
        `;
    }


    if (status === "preparing") {

        return `
            <button
                class="btn-success"
                data-status="ready"
            >
                Mark Ready
            </button>
        `;
    }


    if (status === "ready") {

        return `
            <button
                class="btn-secondary"
                data-status="completed"
            >
                Complete Order
            </button>
        `;
    }


    return `
        <button
            class="btn-secondary"
            disabled
        >
            Completed
        </button>
    `;
}


/* ---------------------------------------------------------
   UPDATE ORDER STATUS
--------------------------------------------------------- */
async function updateOrderStatus(orderId, newStatus) {

    console.log(
        `Updating order ${orderId} → ${newStatus}`
    );

    try {

        const response = await fetch(
            `${API_URL}/${orderId}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status: newStatus
                })
            }
        );


        const data = await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Failed to update order status."
            );
        }


        console.log(
            `Order #${orderId} updated to ${newStatus}`
        );


        // Reload orders from PostgreSQL
        await loadOrders();


    } catch (error) {

        console.error(
            "Failed to update order:",
            error
        );

        alert(
            `Could not update order status.\n\n${error.message}`
        );
    }
}
/* ---------------------------------------------------------
   STATISTICS
--------------------------------------------------------- */

function updateStatistics(orders) {

    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let completed = 0;


    orders.forEach(order => {

        switch (order.status) {

            case "pending":
                pending++;
                break;

            case "preparing":
                preparing++;
                break;

            case "ready":
                ready++;
                break;

            case "completed":
                completed++;
                break;

        }

    });


    pendingCount.textContent = pending;
    preparingCount.textContent = preparing;
    readyCount.textContent = ready;
    completedCount.textContent = completed;
}


/* ---------------------------------------------------------
   CONNECTION STATUS
--------------------------------------------------------- */

function setConnectionStatus(isOnline) {

    if (isOnline) {

        connectionStatus.textContent = "● Connected";

        connectionStatus.classList.remove("offline");

        connectionStatus.classList.add("online");

    } else {

        connectionStatus.textContent = "● Offline";

        connectionStatus.classList.remove("online");

        connectionStatus.classList.add("offline");

    }
}


/* ---------------------------------------------------------
   LOADING / ERROR STATES
--------------------------------------------------------- */

function showLoading() {

    hideAllMessages();

    loadingMessage.classList.remove("hidden");

}


function showError() {

    hideAllMessages();

    errorMessage.classList.remove("hidden");

}


function hideAllMessages() {

    loadingMessage.classList.add("hidden");

    errorMessage.classList.add("hidden");

    emptyMessage.classList.add("hidden");

}


/* ---------------------------------------------------------
   REFRESH BUTTON
--------------------------------------------------------- */

refreshBtn.addEventListener(
    "click",
    loadOrders
);


/* ---------------------------------------------------------
   BASIC HTML ESCAPING
--------------------------------------------------------- */

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


/* ---------------------------------------------------------
   INITIAL LOAD
--------------------------------------------------------- */

loadOrders();