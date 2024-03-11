// Use this function to delete ALL products from HubSpot
// NOTE: this function only runs locally, it will timeout on Netlify

const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const crmLib = require("../lib/crm-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/4506876114698240`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
  ignoreSentryErrors: true,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = event.body && JSON.parse(event.body);
    if (!payload) {
      return {
        statusCode: 400,
        body: "No data was provided in the body.",
      };
    }
    // console.log("payload", payload);
    // transform data and convert to an array to reuse deletedProducts function
    const deletedProducts = [{ id: payload.hubSpotProductId }];
    // console.log("deletedProducts", deletedProducts);

    try {
      console.log(`CRM product count: ${deletedProducts.length}`);
      await crmLib.deleteProducts(deletedProducts);
      return {
        statusCode: 200,
        body: `Webhook received`,
      };
    } catch (e) {
      console.error(e);
      return { statusCode: 500, body: e.toString() };
    }
  }
);
