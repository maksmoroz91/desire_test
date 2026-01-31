import { Router } from 'express'
import paymentController from '../controllers/payment.controller'

const router = Router()

router.post('/', paymentController.create)


export default router
