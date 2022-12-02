const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const ecommLib = require("../lib/ecomm-lib");
const crmLib = require("../lib/crm-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    // #1 Get products with no folder
    console.log("request received, fetching products...");
    const products = await crmLib.getProductsWithNoFolder();

    // #2 Update products with folder
    console.log("got products, making update...");
    const update = await crmLib.updateBatchProductFolder(
      products.results,
      8530281
    );

    return {
      statusCode: 200,
      body: JSON.stringify(products),
    };
  }
);
