const express = require('express');
const cors = require("cors");
const session = require('express-session');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'smkrestaurantsecret',
  resave: false,
  saveUninitialized: false
}));

/* =====================
   CREATE TABLE
===================== */
async function initializeDatabase() {
  try {

    // Orders table
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

    // Menu table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id SERIAL PRIMARY KEY,
        item_name TEXT,
        price INT,
        is_available BOOLEAN DEFAULT true
      );
    `);
    console.log("Menu table ready");

    // Insert default menu if empty
    const check = await pool.query("SELECT COUNT(*) FROM menu");

    if (check.rows[0].count == 0) {
      await pool.query(`
        INSERT INTO menu (item_name, price) VALUES
        ('Chicken Biryani',259),
        ('Mutton Biryani',349),
        ('Fried Rice',129),
        ('Shawarma',99),
        ('Meals',120),
        ('Chicken 65',179),
        ('Egg Biryani',199),
        ('Paneer Biryani',229),
        ('Butter Chicken',279),
        ('Tandoori Chicken',299),
        ('Veg Noodles',139),
        ('Chicken Rice',170),
        ('Raggi Mudda',80),
        ('Chicken Noodles',150);
      `);

      console.log("Default menu inserted");
    }

  } catch (err) {
    console.log("Database init error:", err);
  }
}


/* =====================
   LOGIN
===================== */

app.get('/login', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','login.html'));
});

app.post('/login',(req,res)=>{
  const {username,password} = req.body;

  if(username==='admin' && password==='1234'){
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('Wrong credentials');
  }
});

app.get('/logout',(req,res)=>{
  req.session.destroy(()=>{
    res.redirect('/login');
  });
});

/* =====================
   PLACE ORDER
===================== */

app.post('/place-order', async (req,res)=>{
  try{
    const { customer_name, phone, address, food_item, quantity, total_price } = req.body;

    await pool.query(
      `INSERT INTO orders 
       (customer_name, phone, address, food_item, quantity, total_price)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [customer_name, phone, address, food_item, quantity, total_price]
    );

    res.json({message:"Order placed successfully"});
  }catch(err){
    console.log(err);
    res.status(500).json({error:"Order failed"});
  }
});

/* =====================
   ADMIN PANEL
===================== */

app.get('/admin', async (req,res)=>{

  if(!req.session.loggedIn){
    return res.redirect('/login');
  }

  const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');

  let html = `
  <html>
  <body>
  <h1>Restaurant Orders</h1>

  <br>
<a href="/admin/menu" style="
background:#28a745;
color:white;
padding:10px 18px;
text-decoration:none;
border-radius:6px;
font-weight:bold;
">
🍽 Manage Menu
</a>
<br><br>

  <table border="1" cellpadding="10">
  <tr>
    <th>ID</th>
    <th>Food</th>
    <th>Name</th>
    <th>Phone</th>
    <th>Address</th>
    <th>Qty</th>
    <th>Price</th>
    <th>Status</th>
    <th>Action</th>
  </tr>
  `;

  result.rows.forEach(order=>{
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
  <a href="/out/${order.id}">Out</a> |
  <a href="/delivered/${order.id}">Delivered</a>
  </td>
    </tr>
    `;
  });

  html += `
  </table>

  <br>
  <a href="/logout">Logout</a>

  </body>
  </html>
  `;

  res.send(html);
});

/* =====================
MENU MANAGEMENT (ADMIN)
===================== */

app.get('/admin/menu', async (req,res)=>{

if(!req.session.loggedIn){
return res.redirect('/login');
}

const result = await pool.query("SELECT * FROM menu ORDER BY id");

let html = `

  <html>
  <body>
  <h1>Menu Management</h1>

  <h2>Add New Item</h2>
  <form method="POST" action="/admin/menu/add">
    <input name="item_name" placeholder="Food name" required>
    <input name="price" type="number" placeholder="Price" required>
    <button type="submit">Add Item</button>
  </form>

<br><br>

  <table border="1" cellpadding="10">
  <tr>
    <th>ID</th>
    <th>Name</th>
    <th>Price</th>
    <th>Available</th>
    <th>Action</th>
  </tr>
  `;

result.rows.forEach(item=>{
html += `     <tr>       <td>${item.id}</td>       <td>${item.item_name}</td>       <td>₹${item.price}</td>       <td>${item.is_available}</td>       <td>         <a href="/admin/menu/toggle/${item.id}">Hide/Show</a> |         <a href="/admin/menu/delete/${item.id}">Delete</a>       </td>     </tr>
    `;
});

html += `

  </table>

  <br>
  <a href="/admin">⬅ Back to Orders</a>

  </body>
  </html>
  `;

res.send(html);
});

app.post('/admin/menu/add', async (req,res)=>{
const { item_name, price } = req.body;

await pool.query(
"INSERT INTO menu (item_name, price) VALUES ($1,$2)",
[item_name, price]
);

res.redirect('/admin/menu');
});

/* =====================
   STATUS UPDATE
===================== */

app.get('/ready/:id', async (req,res)=>{
  await pool.query("UPDATE orders SET status='Ready' WHERE id=$1",[req.params.id]);
  res.redirect('/admin');
});

app.get('/out/:id', async (req,res)=>{
  await pool.query(
    "UPDATE orders SET status='Out for Delivery' WHERE id=$1",
    [req.params.id]
  );
  res.redirect('/admin');
});

app.get('/delivered/:id', async (req,res)=>{
  await pool.query("UPDATE orders SET status='Delivered' WHERE id=$1",[req.params.id]);
  res.redirect('/admin');
});

/* =====================
   TRACK ORDER
===================== */

app.get('/track-order/:phone', async (req,res)=>{
  const result = await pool.query(
    "SELECT * FROM orders WHERE phone=$1 ORDER BY id DESC LIMIT 1",
    [req.params.phone]
  );

  if(result.rows.length>0){
    res.json({
      found:true,
      food: result.rows[0].food_item,
      status: result.rows[0].status
    });
  } else {
    res.json({found:false});
  }
});

/* =====================
   MENU API
===================== */

app.get("/menu", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM menu ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Menu load failed" });
    }
});

/* =====================
   SERVER
===================== */
app.get('/admin/menu/delete/:id', async (req,res)=>{
await pool.query(
"DELETE FROM menu WHERE id=$1",
[req.params.id]
);
res.redirect('/admin/menu');
});

app.get('/admin/menu/toggle/:id', async (req,res)=>{
  await pool.query(
    `UPDATE menu
     SET is_available = NOT is_available
     WHERE id=$1`,
    [req.params.id]
  );
  res.redirect('/admin/menu');
});

// ---------------- ADMIN ORDERS ----------------

// get all orders
app.get("/admin/orders", async (req, res) => {
    try{
        const result = await pool.query(
            "SELECT * FROM orders ORDER BY id DESC"
        );
        res.json(result.rows);
    }catch(err){
        console.log(err);
        res.status(500).send("Error loading orders");
    }
});

// update order status
app.post("/admin/update-status/:id/:status", async (req, res) => {
    try{
        const { id, status } = req.params;

        await pool.query(
            "UPDATE orders SET status=$1 WHERE id=$2",
            [status, id]
        );

        res.json({success:true});
    }catch(err){
        console.log(err);
        res.status(500).send("Status update failed");
    }
});

// customer tracking
app.get("/track-order/:phone", async (req,res)=>{
    try{
        const phone=req.params.phone;

        const result=await pool.query(
            "SELECT * FROM orders WHERE phone=$1 ORDER BY id DESC LIMIT 1",
            [phone]
        );

        res.json(result.rows[0]);
    }catch(err){
        console.log(err);
        res.status(500).send("Tracking error");
    }
});

const PORT = process.env.PORT || 3000;

// 1️⃣ Start server immediately (VERY IMPORTANT for Render)
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// 2️⃣ Then connect database in background
initializeDatabase()
  .then(() => console.log("Database initialized"))
  .catch(err => console.log("Database init error:", err));