const sgMail = require("@sendgrid/mail");
const Sentry = require("@sentry/serverless");
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  SALES_FALLBACK,
  ENV_NAME,
  SENTRY_CLIENT_KEY,
} = process.env;
const crmLib = require("../lib/crm-lib.js");
const lib = require("../lib/lib.js");
const dayjs = require("dayjs");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/4506876114698240`,
  tracesSampleRate: 0.5,
  environment: ENV_NAME,
  ignoreSentryErrors: true,
});

function titleCase(str) {
  str = str.toLowerCase().split(" ");
  for (let i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  }
  return str.join(" ");
}

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    sgMail.setApiKey(SENDGRID_API_KEY);
    const payload = JSON.parse(event.body);
    Sentry.setContext("character", {
      payload: payload,
    });
    // console.log("payload:", payload);
    const { cart, contact, cartType } = payload;
    const data = dayjs(contact.startDate).format("ddd, MMM D, YYYY h:mm A");
    // set condition only if Sales Quote and base it off the first item in the cart.
    // if cart has a mix of conditions, we'll just use the first one and the sales rep can adjust as needed.
    const condition = cartType === "rental" ? null : cart[0].condition;
    // set categoryType only if Sales Quote and base it off the first item in the cart.
    const categoryType =
      cartType === "rental" ? "rental" : cart[0].categoryType;

    const source =
      cartType === "rental"
        ? "Rental Tool- NT.com"
        : "Sales Quote Tool- NT.com";

    const salesContact = lib.salesContact(
      contact.county,
      contact.state,
      cartType,
      condition,
      categoryType
    );
    // console.log("salesContact:", salesContact);

    const notification = {
      // If the contact is not in the salesContact list, send to the fallback email
      to: salesContact.contactEmail,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      bcc: ["brian+ntbcc@newmantractor.com"],
      replyTo: contact.email,
      templateId: "d-348a8c69b7a04007a48c29c650eab991",
      dynamic_template_data: {
        cart: cart,
        contact: contact,
        data: data,
        itemCount: cart.length,
        cartType: titleCase(cartType),
        mapLink: `https://www.google.com/maps/place/?q=place_id:${contact.placeId}`,
      },
    };

    const confirmation = {
      to: contact.email,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      replyTo: salesContact.contactEmail,
      templateId: "d-323aec4e28d4421f8b315b23f7fadde9",
      dynamic_template_data: {
        cart: cart,
        contact: contact,
        data: data,
        itemCount: cart.length,
        cartType: titleCase(cartType),
        mapLink: `https://www.google.com/maps/place/?q=place_id:${contact.placeId}`,
      },
    };

    // console.log("notification:", JSON.stringify(notification, null, 2));
    // console.log("confirmation:", JSON.stringify(confirmation, null, 2));

    try {
      // 1) Send notification message
      await sgMail
        .send(notification)
        .then((res) => console.log("Notification sent"));
      await sgMail
        .send(confirmation)
        .then((res) => console.log("Confirmation sent"));
      // 2) Send data to CRM
      contact.ownerId = salesContact?.hubSpotOwnerId;
      const contactID = await crmLib.createContact({
        ...contact,
        source: source,
        lifecyclestage: "lead",
      });
      await crmLib.createDeal(payload, salesContact, contactID);

      Sentry.captureMessage("Quote/Rental request successful");

      return {
        statusCode: 200,
        body: "Message sent",
      };
    } catch (e) {
      console.error(e);
      Sentry.captureException(new Error("Quote/Rental request failed."), {
        tags: {
          section: "function",
        },
      });
      return {
        statusCode: e.code,
        body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
      };
    }
  },
  {
    ignoreSentryErrors: true,
  }
);
