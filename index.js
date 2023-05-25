const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app=express();
const port= process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())


//MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nvsxjlv.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    const menuCollection= client.db('bistroDb').collection('menu')
    const reviewCollection= client.db('bistroDb').collection('reviews')

    app.get('/menu', async(req, res)=> {
        const result= await menuCollection.find().toArray()
        res.send(result)
    })

    app.get('/reviews', async(req, res)=> {
        const result= await reviewCollection.find().toArray()
        res.send(result)
    })



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  
  finally {}
}
run().catch(console.dir);


app.get('/', (req, res)=> {
    res.send('Bistro boss is running')
})

app.listen(port, ()=> {
    console.log(`bistro boss server is running on port: ${port}`)
})