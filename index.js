const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

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

    const menuCollection = client.db('bistroDb').collection('menu')
    const usersCollection = client.db('bistroDb').collection('users')
    const reviewCollection = client.db('bistroDb').collection('reviews')
    const cartCollection = client.db('bistroDb').collection('carts')

    //users related apis
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body
      console.log(user)
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      console.log('existing user', existingUser)
      if (existingUser) {
        return res.send({ message: 'User already exists' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(query)
    })

    app.patch('/users/admin/:id', async(req, res)=> {
      const id= req.params.id
      const filter={ _id: new ObjectId(id)}
      const updatedDoc={
        $set: {
          role: 'admin'
        }
      }
      const result= await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    //menu related apis
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })


    //reviews related apis
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })


    //carts related apis
    app.get('/carts', async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/carts', async (req, res) => {
      const item = req.body
      // console.log(item)
      const result = await cartCollection.insertOne(item)
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  }

  finally { }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Bistro boss is running')
})

app.listen(port, () => {
  console.log(`bistro boss server is running on port: ${port}`)
})