const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion } = require("mongodb");
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



    

    /* ------------------------------------------------------- */
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
