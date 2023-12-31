const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5005;

/* middlewares */
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

/* ------------------------------------------------------------- */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0cmlqfw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* verify jwt token */
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(403)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  /* token verify codes */
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    client.connect();

    /* create db collections*/
    const userCollection = client.db("northernDB").collection("users");
    const courseCollection = client.db("northernDB").collection("courses");
    const cartCollection = client.db("northernDB").collection("carts");
    const paymentCollection = client.db("northernDB").collection("payment");

    /* create jwt token */
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    /* checking user role as admin */
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "Admin") {
        return res
          .status(403)
          .send({ error: true, message: "Unauthorized Access" });
      }
      next();
    };

    /* check user role as instructor */
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "Instructor") {
        return res
          .status(403)
          .send({ error: true, message: "Unauthorized Access" });
      }
      next();
    };

    /* ------------------ user realted ---------------------- */
    /* save users data in db */
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);
      //console.log("existingUser:", existingUser);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    /* get all user data */
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      console.log("get all user data hitted");
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    /* get single user */
    app.get("/user/:email", async (req, res) => {
      console.log("get single user hitted");
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    /* check the user admin */
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "Admin" };
      res.send(result);
    });
    /* check the user instructor */
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "Instructor" };
      res.send(result);
    });
    /* check the user student */
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role === "Student" };
      res.send(result);
    });

    /* update user role */
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateRole = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateRole);
      res.send(result);
    });

    /* update user data */
    app.put("/user/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      console.log(data);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateInfo = {
        $set: data,
      };
      const result = await userCollection.updateOne(
        filter,
        updateInfo,
        options
      );
      res.send(result);
    });

    /* get all the instructor data */
    app.get("/instructors", async (req, res) => {
      console.log("get all the instructor data hitted");
      const result = await userCollection
        .find({ role: "Instructor" })
        .toArray();
      res.send(result);
    });

    /* ------------------------------------------------------- */
    /* ----------------course related api--------------------- */

    /* add course */
    app.post("/course", verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await courseCollection.insertOne(newItem);
      res.send(result);
    });

    /* get single user courses */
    app.get("/course/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email: email };
      const result = await courseCollection.find(query).toArray();
      res.send(result);
    });

    /* get single course */
    app.get("/course/details/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(filter);
      res.send(result);
    });
    /* get single course */
    app.get("/course/instructor/details/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(filter);
      res.send(result);
    });

    /* get all courses data */
    app.get("/courses/admin", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    /* get all approved courses data */
    app.get("/courses", async (req, res) => {
      const filter = { status: "Approved" };
      const sortOptions = { enrolled: -1 };
      const result = await courseCollection
        .find(filter)
        .sort(sortOptions)
        .toArray();
      res.send(result);
    });

    /* update course status */
    app.patch("/course/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status, feedback } = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateStatus = {
        $set: {
          status: status,
          feedback: feedback,
        },
      };
      const result = await courseCollection.updateOne(
        filter,
        updateStatus,
        options
      );
      res.send(result);
    });

    /* update single course data */
    app.put("/course/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      console.log(data);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateInfo = {
        $set: data,
      };
      const result = await courseCollection.updateOne(
        filter,
        updateInfo,
        options
      );
      res.send(result);
    });

    /* delete course */
    app.delete("/course/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.deleteOne(query);
      res.send(result);
    });

    /* ------------------------------------------------------- */

    /*-----------------------cart related Api-------------------- */
    /* add data to cart */
    app.post("/carts", async (req, res) => {
      const data = req.body;
      const result = await cartCollection.insertOne(data);
      res.send(result);
    });

    /* get cart data */
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    /* delete cart data */
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    /* ----------------------------------------------------------- */

    /* ---------- payment related ---------------- */

    /* create payment intent */
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { totalprice } = req.body;
      const amount = parseInt(totalprice * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    /* add payment data to db */
    app.post("/payment", verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      // Update the enrolled count for each course in courseItemsID concurrently
      const updateEnrolledPromises = [];

      for (const courseIdObject of payment.items.map(
        (item) => new ObjectId(item.courseItemID)
      )) {
        const updatePromise = courseCollection.updateOne(
          { _id: courseIdObject },
          { $inc: { enrolled: 1 } }
        );

        updateEnrolledPromises.push(updatePromise);
      }

      await Promise.all(updateEnrolledPromises);

      const insertCart = await paymentCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItemID.map((id) => new ObjectId(id)) },
      };
      const deleteCart = await cartCollection.deleteMany(query);

      res.send({ insertCart, deleteCart, updateEnrolledPromises }); 
    });

    /* get payments data */
    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const query = { "userInfo.email": email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    /* get enrolled student data course wise */
    app.get("/course/enrolled/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const query ={ "items.courseItemID": id }

      //get the enrolled studetsdata
      const result = await paymentCollection
        .find(query, {
          projection: {
            _id: 0,
            userInfo: 1,
          },
        })
        .toArray();

      //make an array of enrolled students
      const userInfoArray = result.map((item) => item.userInfo).flat();

      res.send(userInfoArray);
    });
    /* ------------------------------------------- */

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    /* await client.close(); */
  }
}
run().catch(console.dir);
/* -------------------------------------------------------------------- */

app.get("/", (req, res) => {
  res.send(`Northern is running on port: ${port}`);
});

app.listen(port, () => {
  console.log("running successfully...");
});
