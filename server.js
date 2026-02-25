const express = require('express');
const app = express();
const path = require('path');
const pool = require('./db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server started on port " + PORT);
});
