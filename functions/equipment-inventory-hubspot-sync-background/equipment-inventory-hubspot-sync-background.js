const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const ecommLib = require("../lib/ecomm-lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = JSON.parse(event.body);
    const { _id, price, title, slug, mainImage, equipmentCategories } = payload;

    const item = {
      id: _id,
      ...(price && { price: price }),
      name: title || "Unknown",
      description: title || "Unknown",
      image: mainImage?.asset?.url || "",
      url: `/equipment/${equipmentCategories.slug.current}/${slug.current}`,
      weight: "",
      cms_id: _id,
    };

    console.log("item:", item);

    Sentry.setContext("character", {
      payload: payload,
      debug: true,
    });
    try {
      await ecommLib.syncProducts([item, "8529636"]);
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
