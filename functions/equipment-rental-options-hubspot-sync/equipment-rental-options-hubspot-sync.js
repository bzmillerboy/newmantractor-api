const Sentry = require('@sentry/serverless')
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env
const ecommLib = require('../lib/ecomm-lib')
const lib = require('../lib/lib')

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0
})

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
  // const data = JSON.parse(event.body)
  // console.log('data:', data)

  const rentalOptions = await lib.rentalOptionProductFetch()

  const items = rentalOptions.map(item => {
    const { _id, title, equipmentCategories } = item

    return {
      id: _id,
      name: `${title || 'Unknown'} ${equipmentCategories.title || 'Unknown'} | Rental Option`,
      cms_id: _id
    }
  })

  console.log('item:', items)

  try {
    await ecommLib.syncProducts(items, '6800260') // folder id for "Rental Equipment" 6800260
    return {
      statusCode: 200,
      body: `Webhook received`
    }
  } catch (e) {
    console.error(e)
    return { statusCode: 500, body: e.toString() }
  }
})
