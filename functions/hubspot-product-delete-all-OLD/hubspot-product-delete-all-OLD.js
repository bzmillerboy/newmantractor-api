// Use this function to delete products from HubSpot that no longer exist in Sanity(CMS)

const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const crmLib = require("../lib/crm-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    try {
      const allCmsProducts = await lib.productFetch();
      console.log(`CMS product count: ${allCmsProducts.length}`);
      const allCrmProducts = await crmLib.getAllProducts(allCmsProducts);
      console.log(`CRM product count: ${allCrmProducts.length}`);
      await crmLib.deleteProducts(allCmsProducts, allCrmProducts);
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
