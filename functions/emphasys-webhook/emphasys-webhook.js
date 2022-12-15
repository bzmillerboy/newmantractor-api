const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const sgMail = require("@sendgrid/mail");
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  HUBSPOT_API_KEY,
  HUBSPOT_PORTAL_ID,
  URL,
} = process.env;

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = JSON.parse(event.body);
    console.log(event);
    Sentry.setContext("character", {
      payload: payload,
      debug: true,
    });

    const msg = {
      to: "bzmiller82@gmail.com",
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: fromNameValue,
      },
      subject: "ERP Webhook Event",
      templateId: "d-c110cc501843478596c4e1c2ed47195d",
      dynamic_template_data: {
        payloadString: JSON.stringify(payload),
        payload: payload,
      },
    };

    return {
      statusCode: 200,
      body: `Webhook received`,
    };
  }
);
