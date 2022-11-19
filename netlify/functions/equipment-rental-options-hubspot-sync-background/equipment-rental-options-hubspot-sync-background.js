const Sentry = require('@sentry/serverless')
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env
const ecommLib = require('../lib/ecomm-lib')

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0
})

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
  const payload = JSON.parse(event.body)
  console.log('payload:', payload)
  const { _id, title, equipmentCategories } = payload

  const item = {
    id: _id,
    name: `${title || 'Unknown'} for ${equipmentCategories.title || 'Unknown'} | Rental Option`,
    cms_id: _id
  }

  console.log('item:', item)

  Sentry.setContext('character', {
    payload: payload,
    debug: true
  })
  try {
    await ecommLib.syncProducts([item], '6800260')
    return {
      statusCode: 200,
      body: `Webhook received`
    }
  } catch (e) {
    console.error(e)
    return { statusCode: 500, body: e.toString() }
  }
})
