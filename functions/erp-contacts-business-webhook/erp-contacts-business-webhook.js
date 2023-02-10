const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
const sgMail = require("@sendgrid/mail");
const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } = process.env;

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = JSON.parse(event);
    console.log(event);
    Sentry.setContext("character", {
      payload: payload,
      debug: true,
    });

    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: "bzmiller82@gmail.com",
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: "Notifications",
      },
      subject: "ERP Webhook Event",
      templateId: "d-c110cc501843478596c4e1c2ed47195d",
      dynamic_template_data: {
        payloadString: JSON.stringify(payload),
        payload: payload,
      },
    };
    try {
      await sgMail.send(msg);
      return {
        statusCode: 200,
        body: `Webhook received`,
      };
    } catch (error) {
      console.log(error);
      Sentry.captureException(error);
      return {
        statusCode: 500,
        body: JSON.stringify(error),
      };
    }
  }
);
