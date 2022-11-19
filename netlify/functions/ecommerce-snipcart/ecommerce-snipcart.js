const Sentry = require('@sentry/serverless')
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env
Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
})

const ecommLib = require('../lib/ecomm-lib.js')

exports.handler = Sentry.AWSLambda.wrapHandler(async (event) => {
  const payload = JSON.parse(event.body)
  Sentry.setContext('character', {
    payload: payload,
    debug: true,
  })

  const orderTypes = [
    'order.completed',
    'order.status.changed',
    'order.paymentStatus.changed',
    'order.trackingNumber.changed',
    'order.refund.created',
  ]

  if (orderTypes.some((event) => event === payload.eventName)) {
    try {
      const syncContacts = await ecommLib.syncContacts(payload)
      const syncProducts = await ecommLib.syncProducts(payload.content.items)
      const syncDeals = await ecommLib.syncDeals(payload)
      const syncLineItems = await ecommLib.syncLineItems(payload)

      return {
        statusCode: 200,
        body: JSON.stringify({ syncProducts, syncDeals, syncContacts, syncLineItems }),
      }
    } catch (e) {
      console.error(e)
      return { statusCode: 500, body: e.toString() }
    }
  } else {
    return {
      statusCode: 200,
      body: 'No action taken.',
    }
  }
})
