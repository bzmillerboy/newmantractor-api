const Sentry = require('@sentry/serverless')
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0
})

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
  const payload = JSON.parse(event.body)
  Sentry.setContext('character', {
    payload: payload,
    debug: true
  })
  console.log(event)
  return {
    statusCode: 200,
    body: `Webhook received`
  }
})
