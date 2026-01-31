import { Request, Response } from 'express'
import { DBProvider } from '../DBProvider'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '../../prisma/generated/db'
import axios from 'axios'
import { config } from 'dotenv'

config()

class PaymentController {
    async create(req: Request, res: Response) {
        try {
            const { userId, amount } = req.body

            const paymentData = await DBProvider.$transaction(async (tx) => {
                await tx.paymentLock.create({
                    data: { userId },
                })

                return tx.payment.create({
                    data: {
                        userId: Number(userId),
                        amount: new Prisma.Decimal(amount),
                        idempotencyKey: uuidv4(),
                    },
                })
            })

            const yooKassaRequest = {
                amount: {
                    value: paymentData.amount,
                    currency: paymentData.currency,
                },
                capture: true,
                confirmation: {
                    type: 'redirect',
                    return_url: 'https://www.example.com/return_url',
                },
                description: 'Заказ №1',
                metadata: {
                    userId: userId,
                    paymentId: paymentData.id,
                },
            }

            const yooKassaResponse: any = await axios.post(
                'https://api.yookassa.ru/v3/payments',
                yooKassaRequest,
                {
                    auth: {
                        username: process.env.YOOKASSA_SHOP_ID!,
                        password: process.env.YOOKASSA_SECRET_KEY!,
                    },
                    headers: {
                        'Idempotence-Key': paymentData.idempotencyKey,
                        'Content-Type': 'application/json',
                    },
                }
            )

            await DBProvider.payment.update({
                where: {
                    id: paymentData.id,
                },
                data: {
                    externalPaymentId: yooKassaResponse.data.id,
                },
            })

            return res.status(200).json({
                status: 'Ok',
                data: {
                    paymentId: paymentData.id,
                    confirmationUrl:
                        yooKassaResponse.data.confirmation.confirmation_url,
                },
            })
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                return res.status(409).json({
                    status: 'Fail',
                    message: 'Payment already in progress',
                })
            }

            if (axios.isAxiosError(e)) {
                const errorData = e.response?.data

                return res.status(e.response?.status || 500).json({
                    status: 'Fail',
                    externalPaymentId: errorData?.id,
                    message: errorData?.description || 'YooKassa API error',
                    code: errorData?.code,
                })
            }

            return res.status(500).json({
                status: 'Fail',
                message: 'Internal server error',
                e,
            })
        }
    }

    async webhook(req: Request, res: Response) {
        try {
            const { object } = req.body

            if (!object || !object.id || !object.metadata) {
                return res.status(200).json({
                    status: 'Ok',
                    message: 'Invalid webhook data',
                })
            }

            const paymentData = await DBProvider.payment.findFirst({
                where: {
                    externalPaymentId: object.id,
                },
            })

            if (!paymentData) {
                console.error('Payment not found for webhook:', {
                    externalId: object.id,
                    metadata: object.metadata,
                })

                return res.status(200).json({
                    status: 'Ok',
                    message: 'Payment not found',
                })
            }

            const updatePaymentData = await DBProvider.$transaction(
                async (tx) => {
                    const updated = await tx.payment.update({
                        where: { id: paymentData.id },
                        data: { status: object.status },
                    })
                    await tx.paymentLock.delete({
                        where: { userId: updated.userId },
                    })

                    return updated
                }
            )

            return res.status(200).json({
                status: 'Ok',
                data: {
                    paymentId: updatePaymentData.id,
                    status: updatePaymentData.status,
                },
            })
        } catch (e) {
            return res.status(500).json({
                status: 'Fail',
                message: 'Internal server error',
                e,
            })
        }
    }
}

export default new PaymentController()
