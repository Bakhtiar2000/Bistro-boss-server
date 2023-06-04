const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  })
}


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
    const paymentCollection = client.db('bistroDb').collection('payments')

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }


    //users related apis
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
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

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/users/admin/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })

    //menu related apis
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })

    app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    })

    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    //reviews related apis
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })


    //carts related apis
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }

      const decodedEmail = req.decoded.email
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
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


    //Create payment intent
    app.post('/create-payment-intent',verifyJWT, async(req, res)=> {
      const {price}= req.body
      const amount = price*100 //Price is getting counted in cents. We are converting it into notes multiplying by 100
      // console.log(price, amount)
      const paymentIntent= await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    //Payment related API
    app.post('/payments', async(req, res)=> {
      const payment= req.body
      const insertResult= await paymentCollection.insertOne(payment)

      const query={_id: {$in: payment.cartItems.map(id=> new ObjectId(id))}}
      const deleteResult= await cartCollection.deleteMany(query)
      
      res.send({insertResult, deleteResult})
    })


    app.get('/admin-stats', verifyJWT, verifyAdmin, async(req, res)=> {
      const users= await usersCollection.estimatedDocumentCount()
      const products= await menuCollection.estimatedDocumentCount()
      const orders= await paymentCollection.estimatedDocumentCount()

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)
      res.send({
        users,
        products,
        orders,
        revenue
      })
    })

    app.get('/order-stats', verifyJWT, verifyAdmin, async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
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