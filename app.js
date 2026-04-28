const express = require("express");
const app = express();
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const Menu = require("./models/menu.js");
const dineInOrder = require("./models/dineInOrder.js");
const deliveryOrder = require("./models/deliveryOrder.js");
const path = require("path");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const passport = require("passport");
const LocalStategy = require("passport-local");
const Chef = require("./models/chef.js");
const flash = require('connect-flash');
const checkChefAuth = require('./middleware/checkChefAuth');
const QRCode = require("qrcode");
require("dotenv").config();

// const MONGO_URL = "mongodb://127.0.0.1:27017/d_dine_resto";
  const dbUrl = process.env.ATLASDB_URL;

main()
.then(() => {
    console.log("connected to DB");
})
.catch((err) => {
    console.log(err);
})
 
async function main() {
    await mongoose.connect(dbUrl);
};

const store = MongoStore.create({
    mongoUrl : dbUrl,
    crypto: {
    secret: process.env.SECRET,
  },
  touchAfter : 1 * 60 * 60
});

store.on("error", (err) => {
    console.log("ERROR IN MONGO SESSION STORE", err);
})

const sessionOptions = {
    store,
    secret : process.env.SECRET,
    resave : false,
    saveUninitialized : true,
    cookie : {
        expires : Date.now() + 1 * 60 * 60 * 1000,
        maxAge : 1 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionOptions));
app.use(express.json()); 
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
passport.use(new LocalStategy(Chef.authenticate()));

passport.serializeUser(Chef.serializeUser());
passport.deserializeUser(Chef.deserializeUser());

app.use((req, res, next) => {
    res.locals.cart = req.session.cart || [];
    next();
});

app.use((req, res, next) => {
    res.locals.orderId = req.session.orderId;
    res.locals.orderType = req.session.orderType;
    next();
});



app.get("/", (req, res) => {
    res.render("menus/dDine.ejs");
})


app.get("/dDine", (req, res) => {
    res.render("menus/dDine.ejs");
})

app.get("/dineIn", (req, res) => {
    res.render("menus/dineIn.ejs");
})

app.get("/delivery", (req, res) => {
    res.render("menus/delivery.ejs");
})

app.get("/dineIn/appetizers", async(req, res) => {
    const appetizers = await Menu.find({category : "appetizers"});
    res.render("menus/appetizers.ejs", {appetizers});
});
app.get("/dineIn/beverages", async(req, res) => {
    const beverages = await Menu.find({category : "beverages"});
    res.render("menus/beverages.ejs", {beverages});
});
app.get("/dineIn/desserts", async(req, res) => {
    const desserts = await Menu.find({category : "desserts"});
    res.render("menus/desserts.ejs", {desserts});
});
app.get("/dineIn/mainCourses", async(req, res) => {
    const mainCourses = await Menu.find({category : "mainCourses"});
    res.render("menus/mainCourses.ejs", {mainCourses});
});
app.get("/dineIn/mandis", async(req, res) => {
    const mandis = await Menu.find({category : "mandis"});
    res.render("menus/mandis.ejs", {mandis});
});


app.get("/delivery/appetizers", async(req, res) => {
    const appetizers = await Menu.find({category : "appetizers"});
    res.render("menus/appetizers.ejs", {appetizers});
});
app.get("/delivery/beverages", async(req, res) => {
    const beverages = await Menu.find({category : "beverages"});
    res.render("menus/beverages.ejs", {beverages});
});
app.get("/delivery/desserts", async(req, res) => {
    const desserts = await Menu.find({category : "desserts"});
    res.render("menus/desserts.ejs", {desserts});
});
app.get("/delivery/mainCourses", async(req, res) => {
    const mainCourses = await Menu.find({category : "mainCourses"});
    res.render("menus/mainCourses.ejs", {mainCourses});
});
app.get("/delivery/mandis", async(req, res) => {
    const mandis = await Menu.find({category : "mandis"});
    res.render("menus/mandis.ejs", {mandis});
});

app.post("/session", (req, res) => {
    const {id, quantity} = req.body;

    if(!req.session.cart) {
        req.session.cart = [];
    }

    let item = req.session.cart.find(item => item.id === id);

    if(item) {
        if(quantity > 0) {
            item.quantity = quantity;
        }
        else {
            req.session.cart = req.session.cart.filter(item => item.id !== id);
        }
    }
    else if (quantity > 0){
        req.session.cart.push({id, quantity});
    }
    console.log(req.session.cart);
    res.json({success : true, cart : req.session.cart});
});

app.get("/cartCount", (req, res) => {
    const cart = req.session.cart || [];
    const totalItems = cart.reduce((total, item) => {
        return total + item.quantity;
    }, 0);
    res.json({totalItems});
});

app.get("/dineIn/viewCart", async(req, res) => {
    const cart = req.session.cart || [];

    const itemIds = cart.map(item => item.id);

    const menuItems = await Menu.find({_id : { $in: itemIds}});

    const cartDetails = cart.map(cartItem => {
        const menuItem = menuItems.find(item => item._id.toString() === cartItem.id);

        if (!menuItem) return null;

        console.log(menuItem);

        return{
            name: menuItem.name,
            price: menuItem.price,
            quantity: cartItem.quantity,
            image: menuItem.image?.url || "",
            total: menuItem.price * cartItem.quantity,
            category: menuItem.category,
            type: menuItem.type,
            id : menuItem.id,
        }
    }).filter(item => item !== null);

    const grandTotal = cartDetails.reduce((sum, item) => sum + item.total, 0);
    const gstPercentage = 5;  // Example GST percentage
    const gstAmount = (grandTotal * gstPercentage) / 100;
    const finalAmount = grandTotal + gstAmount;

    res.render("menus/dineInCheckout", {
        cartDetails,
        grandTotal,
        gstAmount,
        finalAmount,
    });
});

app.get("/delivery/viewcart", async (req, res) => {
    const cart = req.session.cart || [];

    // Use item.id directly if it is already a valid ObjectId string
    const itemIds = cart.map(item => item.id);

    // Fetch menu items matching the itemIds
    const menuItems = await Menu.find({ _id: { $in: itemIds } });

    // Map cart items to menu items
    const cartDetails = cart.map(cartItem => {
        const menuItem = menuItems.find(item => item._id.toString() === cartItem.id);
        
        // If no menuItem found, skip this cart item
        if (!menuItem) return null;

        return {
            name: menuItem.name,
            price: menuItem.price,
            quantity: cartItem.quantity,
            image: menuItem.image?.url || "",
            total: menuItem.price * cartItem.quantity,
            category: menuItem.category,
            type: menuItem.type,
            id : menuItem.id,
        };
    }).filter(item => item !== null);  // Filter out nulls

    // Calculate grand total, GST, and final amount
    const grandTotal = cartDetails.reduce((sum, item) => sum + item.total, 0);
    const gstPercentage = 5;  // Example GST percentage
    const gstAmount = (grandTotal * gstPercentage) / 100;

    const deliveryCharges = (cartDetails.length * 5) + 10;

    const finalAmount = grandTotal + gstAmount + deliveryCharges;

    // Render the checkout page with calculated totals
    res.render("menus/deliveryCheckout", {
        cartDetails,
        grandTotal,
        gstAmount,
        finalAmount,
        deliveryCharges,
    });
});


app.post("/dineInSave", (req, res) => {
    let { finalAmount, orderType, tableNumber, orderText, itemTotal, gstAmount } = req.body;
    let cartItems = req.session.cart;

    const items = cartItems.map(item => {
        return {
            id : item.id,
            quantity : item.quantity,
        }
    });

    const orderDetails = {
        finalAmount,
        orderType,
        tableNumber,
        orderText,
        items,
        itemTotal,
        gstAmount
    }

    const order = new dineInOrder(orderDetails);

    order.save()
    .then(savedOrder => {
        console.log("order saved :", savedOrder);

        req.session.orderType = "dineIn";

        req.session.orderId = savedOrder._id.toString();;

        // Update totalAmount in session
        if (req.session.totalAmount) {
            req.session.totalAmount += Number(finalAmount);  // ensure it's a number
        } else {
            req.session.totalAmount = Number(finalAmount);
        }

        console.log("Session orderId:", req.session.orderId); // Print order ID from session
    console.log("Session totalAmount:", req.session.totalAmount);

        // Clear cart after saving order
        req.session.cart = [];
        

        res.json({ 
            redirectTo : "/dineIn", 
        });

    })
    .catch(err => {
        console.error("Error saving order:", err);
        res.status(500).send("Error saving order.");
    });
});

app.post("/deliverySave", (req, res) => {

    let {finalAmount, orderType, orderText, itemTotal, gstAmount, deliveryCharges, customerName, houseNumber, street, city, state, pincode, contactNumber, nearby} = req.body;
    let cartItems = req.session.cart;

    const items = cartItems.map(item => {
        return {
            id : item.id,
            quantity : item.quantity,
        }
    });

    const address = {
        customerName, houseNumber, street, city, state, pincode, contactNumber, nearby,
    };
    

    const orderDetails = {
        finalAmount,
        orderType,
        orderText,
        address,
        items,
       itemTotal,
      gstAmount,
      deliveryCharges
    }

    const order = new deliveryOrder(orderDetails);
    order.save()
    .then(savedOrder => {
        console.log("order saved :", savedOrder);

        req.session.orderType = "delivery";
        req.session.orderId = savedOrder._id.toString();;

            req.session.totalAmount = Number(finalAmount);
       
        console.log("Session orderId:", req.session.orderId); // Print order ID from session
    console.log("Session totalAmount:", req.session.totalAmount);

        req.session.cart = [];
        
            res.json({redirectTo : "/delivery"});
        
    })
    .catch(err => {
        console.error("Error saving order:", err);
        res.status(500).send("Error saving order.");
    });
});

app.get("/showDineInOrderPage", async(req, res) => {

    const id = req.session.orderId;

    const viewDineInOrder = await dineInOrder.findById(id);

    if (!viewDineInOrder) {
        return res.status(404).send("Order not found");
    }
    
    const { orderType, tableNumber, orderText, createdAt, items, finalAmount, gstAmount, itemTotal} = viewDineInOrder;


    let orderItems = [];

    for(const element of items) {
        const menuItem = await Menu.findById(element.id);

        if(menuItem) {
            orderItems.push({
                Name: menuItem.name,
                Price: menuItem.price,
                Quantity : element.quantity,
            });
        }
    }

    const sendOrderItems = {id, orderItems, orderType, tableNumber, orderText, orderedAt : createdAt, finalAmount, gstAmount, itemTotal};

    res.render("menus/showDineInOrderPage.ejs", {sendOrderItems});

});

app.get("/showDeliveryOrderPage", async(req, res) => {

    const id = req.session.orderId;

     const viewDeliveryOrder = await deliveryOrder.findById(id);

    if (!viewDeliveryOrder) {
        return res.status(404).send("Order not found");
    }

    const { orderType, orderText, createdAt, items, address, deliveryNumber, finalAmount, gstAmount, itemTotal, deliveryCharges} = viewDeliveryOrder;


    let orderItems = [];

    for(const element of items) {
        const menuItem = await Menu.findById(element.id);

        if(menuItem) {
            orderItems.push({
                Name: menuItem.name,
                Price: menuItem.price,
                Quantity : element.quantity,
            });
        }
    }

    const sendOrderItems = {id, orderItems, orderType, address, orderText, orderedAt : createdAt, deliveryNumber, finalAmount, gstAmount, itemTotal, deliveryCharges};


    res.render("menus/showDeliveryOrderPage.ejs", {sendOrderItems});

});

app.get("/dineInOrders", checkChefAuth, async (req, res) => {
  try {
    let dineInOrders = await dineInOrder.find({});

    
    dineInOrders.sort((a, b) => new Date(a.created_on) - new Date(b.created_on));

   
    dineInOrders = dineInOrders.map(order => {
      const date = new Date(order.created_on);

      let formattedDate = "Invalid time";

      if (!isNaN(date)) {
        formattedDate = date.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
      }

      return {
        ...order._doc,
        formattedDate
      };
    });

    res.render("menus/dineInOrders.ejs", {
      dineInOrders,
      showCart: false
    });

  } catch (err) {
    console.log(err);
    res.send("Error loading orders");
  }
});
  

app.get("/dineInOrderCheck/:id", async(req, res) => {
    let {id} = req.params;
    
    const viewDineInOrder = await dineInOrder.findById(id);

    if (!viewDineInOrder) {
        return res.status(404).send("Order not found");
    }
    
    const { orderType, tableNumber, orderText, createdAt, items, finalAmount, gstAmount, itemTotal} = viewDineInOrder;


    let orderItems = [];

    for(const element of items) {
        const menuItem = await Menu.findById(element.id);

        if(menuItem) {
            orderItems.push({
                Name: menuItem.name,
                Price: menuItem.price,
                Quantity : element.quantity,
            });
        }
    }

    const sendOrderItems = {id, orderItems, orderType, tableNumber, orderText, orderedAt : createdAt, finalAmount, gstAmount, itemTotal};

    res.render("menus/viewDineInOrder.ejs", {sendOrderItems, showCart: false,});
});

app.get("/deleteDineInOrder/:id", async(req, res) => {

    let {id} = req.params;
  
    const deletedOrder = await dineInOrder.findByIdAndDelete(id);
    
    res.redirect("/dineInOrders");
});

app.get("/deliveryOrders", checkChefAuth, async (req, res) => {
  try {
    // ✅ Sort directly in MongoDB (old → new)
    let deliveryOrders = await deliveryOrder.find({}).sort({ created_on: 1 });

    // ✅ Safe time formatting (IST)
    deliveryOrders = deliveryOrders.map(order => {
      const date = new Date(order.created_on);

      return {
        ...order._doc,
        formattedDate: !isNaN(date)
          ? date.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })
          : "Invalid time"
      };
    });

    res.render("menus/deliveryOrders.ejs", {
      deliveryOrders,
      showCart: false,
    });

  } catch (err) {
    console.log(err);
    res.send("Error loading delivery orders");
  }
});

  
app.get("/deliveryOrderCheck/:id", async(req, res) => {
    let {id} = req.params;
    
    const viewDeliveryOrder = await deliveryOrder.findById(id);

    if (!viewDeliveryOrder) {
        return res.status(404).send("Order not found");
    }

    const { orderType, orderText, createdAt, items, address, deliveryNumber, finalAmount, gstAmount, itemTotal, deliveryCharges} = viewDeliveryOrder;


    let orderItems = [];

    for(const element of items) {
        const menuItem = await Menu.findById(element.id);

        if(menuItem) {
            orderItems.push({
                Name: menuItem.name,
                Price: menuItem.price,
                Quantity : element.quantity,
            });
        }
    }

    const sendOrderItems = {id, orderItems, orderType, address, orderText, orderedAt : createdAt, deliveryNumber, finalAmount, gstAmount, itemTotal, deliveryCharges};


    res.render("menus/viewDeliveryOrder.ejs", {sendOrderItems, showCart: false,});
});

app.get("/deleteDeliveryOrder/:id", async(req, res) => {

    let {id} = req.params;
  
    const deletedOrder = await deliveryOrder.findByIdAndDelete(id);
    
    res.redirect("/deliveryOrders");
});

app.get('/generateUPIQRCode', async (req, res) => {
  const amount = req.session.totalAmount;

  if (!amount) {
    return res.status(400).json({ error: "Amount not found in session" });
  }

  const upiId = "dineshmanju990@okhdfcbank";
  const name = "D-Dine";

  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;

  try {
    const qrImage = await QRCode.toDataURL(upiLink);
    res.json({ qrImage, amount });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

app.get("/signup", (req, res) => {
    res.render("menus/signupPage.ejs");
});

app.post("/signup", async (req, res) => {
    try {
        let { username, email, password, registrationKey } = req.body;

        if (registrationKey !== process.env.CHEF_REGISTRATION_KEY) {
            return res.status(400).json({ error: "Invalid registration key. Please enter the correct key." });
        }

        const nameRegex = /^[A-Za-z ]+$/;
        if (!nameRegex.test(username)) {
            return res.status(400).json({ error: "Username must contain only letters and spaces." });
        }

        const newChef = new Chef({ email, username });
        const registeredChef = await Chef.register(newChef, password);
        console.log(registeredChef);
        res.status(200).json({ message: "Registration successful" });
    } catch (err) {
        console.error("signup error:", err.message);

        if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
            return res.status(400).json({ error: "Email already registered. Please use a different email." });
        }

        res.status(400).json({ error: err.message });
    }
});

app.get("/login", (req, res) => {
    res.render("menus/loginPage.ejs");
})

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }),
  async (req, res) => {
    const { loginKey, orderType } = req.body;

    if (loginKey !== process.env.CHEF_LOGIN_KEY) {
      req.logout(() => {
        req.session.destroy();
        return res.status(401).json({
          error: "Invalid login key. Please contact the manager for today's key."
        });
      });
    } else {
      // ✅ Set session details here
      req.session.userType = 'chef';
      req.session.orderType = orderType;

      res.json({ success: true }); // Login success
    }
  }
);

app.get("/dineInOrDelivery",checkChefAuth, (req, res) => {
    res.render("menus/dineInOrDelivery.ejs");
});


app.post('/resetTotalAmount', (req, res) => {
  req.session.totalAmount = null;
  res.sendStatus(200);
});

app.post('/placeOrder', (req, res) => {
  const totalAmount = 210;
  req.session.totalAmount = totalAmount;
  res.send("Order placed");
});

app.get("/unauthorizedAccess", (req, res) => {
    const attemptedRoute = req.query.route || '/';
    res.render("menus/unauthorizedAccess.ejs", { attemptedRoute });
});

app.post("/clear-cart", (req, res) => {
    req.session.cart = [];
    res.json({ success: true });
});


app.use((req, res) => {
  res.status(404).render("menus/404", { path: req.originalUrl });
});

app.listen(8080, () => {
    console.log("app is listening");
});
