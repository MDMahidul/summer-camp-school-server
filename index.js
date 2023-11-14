const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require("jsonwebtoken");
const morgan = require('morgan');
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5005;

/* middlewares */
const corsOptions={
    origin:"*",
    credentials: true,
    optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

/* ------------------------------------------------------------- */
const uri =
`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0cmlqfw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
     client.connect();

     /* create db collections*/
     const userCollection = client.db("northernDB").collection("users");

     /* create jwt token */
     app.post('/jwt',(req,res)=>{
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1d'});
      res.send({token});
     })

     /* save users data in db */
     app.put('/users/:email',async(req,res)=>{
        const email = req.params.email;
        const user = req.body;
        const query = {email:email};
        const options = {upsert:true};
        const updateDoc = {$set : user}
        const result = await userCollection.updateOne(query,updateDoc,options);
        res.send(result);

     })

     app.get("/users",async (req, res) => {
       const result = await userCollection.find().toArray();
       res.send(result);
     });

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

app.get('/',(req,res)=>{
    res.send(`Northern is running on port: ${port}`);
})

app.listen(port,()=>{
    console.log('running successfully...');
})
