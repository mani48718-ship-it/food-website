const session = require('express-session');
const express = require('express');
const app = express();
const path = require('path');
const pool = require('./db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
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

// LOGIN CHECK
app.post('/login', (req, res) => {

    const username = req.body.username;
    const password = req.body.password;

    // your admin account (you can change later)
    const ADMIN_USER = "admin";
    const ADMIN_PASS = "1234";

    if(username === ADMIN_USER && password === ADMIN_PASS){
        req.session.loggedIn = true;
        res.redirect('/admin');
    }else{
        res.send("<h2>Wrong username or password ❌</h2><a href='/login'>Try Again</a>");
    }
});

// LOGIN CHECK MIDDLEWARE
function checkAdmin(req, res, next){
    if(req.session.loggedIn){
        next();
    }else{
        res.redirect('/login');
    }
}

// ORDER API
app.post('/order', async (req, res) => {

    console.log("BODY DATA:", req.body);
    
    const foodItem = req.body.food;
    const name = req.body.name;
    const phone = req.body.phone;
    const address = req.body.address;

    try {
        await pool.query(
            'INSERT INTO orders (food_name, customer_name, phone, address) VALUES ($1,$2,$3,$4)',
            [foodItem, name, phone, address]
        );

        console.log("Saved to database:", foodItem);
        res.send(`Your ${foodItem} order placed successfully! 🍽️`);

    } catch (err) {
        console.error(err);
        res.send("Database error");
    }
});


// ADMIN PANEL
app.get('/admin', async (req, res) => {

    if(!req.session.loggedin){
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
<th>Name</th>
<th>Phone</th>
<th>Address</th>
<th>Time</th>
        <th>Action</th>
    </tr>`;

    result.rows.forEach(order => {
        html += `
        <tr>
            <td>${order.id}</td>
           <td>${order.food_name}</td>
<td>${order.customer_name}</td>
<td>${order.phone}</td>
<td>${order.address}</td>
<td>${order.order_time}</td>
            <td><a href="/delete/${order.id}">Done</a></td>
        </tr>`;
    });

    html += `
    </table>

    <script>
        setTimeout(function(){
            window.location.reload();
        }, 5000);
    </script>
    </table>

    <br><br>
    <a href="/logout">Logout</a>

    <script>
        setTimeout(function(){
            window.location.reload();
        }, 5000);
    </script>

    </body>
    </html>`;

    res.send(html);
});


// DELETE ORDER
app.get('/delete/:id', async (req, res) => {
    const orderId = req.params.id;
    await pool.query('DELETE FROM orders WHERE id=$1', [orderId]);
    res.redirect('/admin');
});

// MENU ADMIN PAGE
app.get('/admin/menu', async (req, res) => {

    if(!req.session.loggedin){
        return res.redirect('/login');
    }

    const result = await pool.query('SELECT * FROM menu ORDER BY id');

    let html = `
    <html>
    <head>
        <title>Manage Menu</title>
    </head>
    <body>
    <h1>Menu Management</h1>

    <h2>Add New Item</h2>
    <form method="POST" action="/admin/menu/add">
        <input name="item_name" placeholder="Item Name" required>
        <input name="price" placeholder="Price" type="number" required>
        <button type="submit">Add Item</button>
    </form>

    <h2>Current Menu</h2>
    <table border="1" cellpadding="10">
    <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Price</th>
        <th>Action</th>
    </tr>
    `;

    result.rows.forEach(item => {
        html += `
        <tr>
            <td>${item.id}</td>
            <td>${item.item_name}</td>
            <td>₹${item.price}</td>
            <td><a href="/admin/menu/delete/${item.id}">Delete</a></td>
        </tr>
        `;
    });

    html += `
    </table>
    </body>
    </html>
    `;

    res.send(html);
});

app.post('/admin/menu/add', async (req, res) => {

    const { item_name, price } = req.body;

    await pool.query(
        'INSERT INTO menu (item_name, price) VALUES ($1, $2)',
        [item_name, price]
    );

    res.redirect('/admin/menu');
});

app.get('/admin/menu/delete/:id', async (req, res) => {

    const id = req.params.id;

    await pool.query('DELETE FROM menu WHERE id=$1', [id]);

    res.redirect('/admin/menu');
});

// MENU API (send food items to website)
app.get('/menu', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM menu WHERE is_available=true ORDER BY id ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.log(err);
        res.send("Menu error");
    }
});

const PORT = process.env.PORT || 3000;

// LOGIN PAGE
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// LOGIN CHECK
app.post('/login', (req, res) => {

    const { username, password } = req.body;

    if(username === 'admin' && password === '1234'){
        req.session.loggedin = true;
        res.redirect('/admin');
    } else {
        res.send('Wrong username or password');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(()=>{
        res.redirect('/login');
    });
});

app.listen(PORT, () => {
    console.log("Server started on port " + PORT);
});
