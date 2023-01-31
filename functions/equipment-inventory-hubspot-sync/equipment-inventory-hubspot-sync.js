const Sentry = require("@sentry/serverless");
const {
  SENTRY_CLIENT_KEY,
  ENV_NAME,
  HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_INVENTORY,
} = process.env;
const crmLib = require("../lib/crm-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    process.on("warning", (warning) => {
      console.warn("warning stacktrace - " + warning.stack);
    });

    const inventory = await lib.inventoryProductFetch();

    try {
      await crmLib.syncProducts(
        inventory,
        HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_INVENTORY
      );
      return {
        statusCode: 200,
        body: `Request to sync inventory equipment received.`,
      };
    } catch (e) {
      console.error(e);
      return { statusCode: 500, body: e.toString() };
    }
  }
);
