import express from 'express'
import cors from 'cors'
import paymentRouter from './routers/payment.router'
import { config } from 'dotenv'

config()

const app = express()


app.use(cors())
app.use(express.json())

app.use('/api/payment', paymentRouter)

app.listen(process.env.SERVER_PORT, () =>
    console.log(`Start on 127.0.0.1:${process.env.SERVER_PORT as string}`)
)
