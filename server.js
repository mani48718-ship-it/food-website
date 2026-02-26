const db = require("./db");
const session = require('express-session');
const express = require('express');
const app = express();
const path = require('path');
const pool = require('./db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

```js
const express = require('express');
const session = require('express-session');
const path = require('path');
const pool = require('./db');

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// session
app.use(session({
    secret: 'smkrestaurantsecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none'
    }
}));

/* =========================
        ADMIN PANEL
========================= */

app.get('/admin', async (req, res) => {

    if (!req.session.loggedIn) {
        return res.redirect('/login');
    }

    const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');

    let html = `
    <html>
    <head>
        <title>Restaurant Orders</title>
    </head>
    <body>
    <h1>Restaurant Orders</h1>

    <table border="1" cellpadding="10">
    <tr>
        <th>ID</th>
        <th>Food</th>
        <th>Customer</th>
        <th>Phone</th>
        <th>Address</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Status</th>
        <th>Action</th>
    </tr>
    `;

    result.rows.forEach(order => {
        html += `
        <tr>
            <td>${order.id}</td>
            <td>${order.food_item}</td>
            <td>${order.customer_name}</td>
            <td>${order.phone}</td>
            <td>${order.address}</td>
            <td>${order.quantity}</td>
            <td>₹${order.total_price}</td>
            <td>${order.status}</td>
            <td>
                <a href="/ready/${order.id}">Ready</a> |
                <a href="/delivered/${order.id}">Delivered</a>
            </td>
        </tr>
        `;
    });

    html += `
    </table>

    <br><br>
    <a href="/logout">Logout</a>

    <script>
        setTimeout(function(){
            window.location.reload();
        }, 5000);
    </script>

    </body>
    </html>
    `;

    res.send(html);
});

/* =========================
        LOGIN
========================= */

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === '1234') {
        req.session.loggedIn = true;
        res.redirect('/admin');
    } else {
        res.send('Wrong username or password');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

/* =========================
        ORDERS TABLE
========================= */

async function createOrdersTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            food_item TEXT,
            quantity INT,
            total_price INT,
            status TEXT DEFAULT 'Preparing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("Orders table ready");
}
createOrdersTable();

/* =========================
        PLACE ORDER
========================= */

app.post("/place-order", async (req, res) => {
    try {
        const { customer_name, phone, address, food_item, quantity, total_price } = req.body;

        await pool.query(
            `INSERT INTO orders
            (customer_name, phone, address, food_item, quantity, total_price)
            VALUES ($1,$2,$3,$4,$5,$6)`,
            [customer_name, phone, address, food_item, quantity, total_price]
        );

        res.json({ message: "Order placed successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Order failed" });
    }
});

/* =========================
        STATUS UPDATE
========================= */

app.get("/ready/:id", async (req, res) => {
    await pool.query(
        "UPDATE orders SET status='Ready' WHERE id=$1",
        [req.params.id]
    );
    res.redirect("/admin");
});

app.get("/delivered/:id", async (req, res) => {
    await pool.query(
        "UPDATE orders SET status='Delivered' WHERE id=$1",
        [req.params.id]
    );
    res.redirect("/admin");
});

/* =========================
        TRACK ORDER
========================= */

app.get("/track-order/:phone", async (req, res) => {

    const phone = req.params.phone;

    const result = await pool.query(
        "SELECT * FROM orders WHERE phone=$1 ORDER BY id DESC LIMIT 1",
        [phone]
    );

    if (result.rows.length > 0) {
        res.json({
            found: true,
            food: result.rows[0].food_item,
            status: result.rows[0].status
        });
    } else {
        res.json({ found: false });
    }
});

/* =========================
        MENU API
========================= */

app.get('/menu', async (req, res) => {
    const result = await pool.query('SELECT * FROM menu ORDER BY id ASC');
    res.json(result.rows);
});

/* =========================
        SERVER
========================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server started on port " + PORT);
});
```
