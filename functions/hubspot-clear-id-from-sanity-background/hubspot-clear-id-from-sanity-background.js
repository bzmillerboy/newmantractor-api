// Use this function to delete ALL product IDs from Sanity
// NOTE: this function only runs locally, it will timeout on Netlify

const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const cmsLib = require("../lib/cms-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    try {
      const allCrmProducts = await cmsLib.clearHubSpotId();
      return {
        statusCode: 200,
        body: `HubSpot IDs cleared`,
      };
    } catch (e) {
      console.error(e);
      return { statusCode: 500, body: e.toString() };
    }
  }
);
