const express = require('express');
const session = require('express-session');
const path = require('path');
const pool = require('./db');

const app = express();

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
   STATUS UPDATE
===================== */

app.get('/ready/:id', async (req,res)=>{
  await pool.query("UPDATE orders SET status='Ready' WHERE id=$1",[req.params.id]);
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
   SERVER
===================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log("Server running on port "+PORT);
});