// Use this function to delete ALL products from HubSpot
// NOTE: this function only runs locally, it will timeout on Netlify

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
    const allCrmProducts = await crmLib.getAllProducts();

    const allCrmProductsFromCms = allCrmProducts.filter(
      (p) => p.properties.cms_id
    );

    try {
      console.log(`CRM product count: ${allCrmProductsFromCms.length}`);
      await crmLib.deleteProducts(allCrmProductsFromCms);
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
