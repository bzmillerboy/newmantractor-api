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
  const inventory = await lib.inventoryProductFetch()

  const items = inventory.map(item => {
    const { _id, price, title, slug, mainImage, equipmentCategories } = item

    return {
      id: _id,
      ...(price && { price: price }),
      name: title || 'Unknown',
      description: title || 'Unknown',
      image: mainImage?.asset?.url || '',
      url: `/equipment/${equipmentCategories.slug.current}/${slug.current}`,
      weight: '',
      cms_id: _id
    }
  })

  console.log('items:', items)

  try {
    await ecommLib.syncProducts(items, '')
    return {
      statusCode: 200,
      body: `Request to sync inventory equipment received.`
    }
  } catch (e) {
    console.error(e)
    return { statusCode: 500, body: e.toString() }
  }
})
