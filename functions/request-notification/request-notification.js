const sgMail = require("@sendgrid/mail");
const Sentry = require("@sentry/serverless");
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  SALES_FALLBACK_FL,
  SALES_FALLBACK_KY,
  SALES_FALLBACK,
  RENTAL_FALLBACK,
  TERRITORIES_FILE,
} = process.env;
const crmLib = require("../lib/crm-lib.js");
const dayjs = require("dayjs");
const territoriesProd = require(`../data/territories.json`);
const territoriesDev = require(`../data/territories-dev.json`);
Sentry.AWSLambda.init({
  dsn: "https://5b66d0cf46fe489bbcc7bbe1a03ba78a@o469784.ingest.sentry.io/5499762",
  tracesSampleRate: 1.0,
  debug: true,
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
    // console.log('payload:', payload)
    const { cart, contact, cartType } = payload;
    const data = dayjs(contact.startDate).format("ddd, MMM D, YYYY h:mm A");

    const source =
      cartType === "rental"
        ? "Rental Tool- NT.com"
        : "Sales Quote Tool- NT.com";

    const territories =
      TERRITORIES_FILE === "territoriesDev" ? territoriesDev : territoriesProd;
    console.log("territories:", JSON.stringify(territories));

    const salesContact = () => {
      const salesPersonMatch =
        contact.county &&
        territories.find(
          (c) => c.countyName === contact.county && c.state === contact.state
        );
      if (salesPersonMatch) {
        return salesPersonMatch;
      } else if (cartType === "rental") {
        return JSON.parse(RENTAL_FALLBACK);
      } else if (
        contact.addressComponents.state &&
        contact.addressComponents.state === "Florida"
      ) {
        return JSON.parse(SALES_FALLBACK_FL);
      } else if (
        contact.addressComponents.state &&
        contact.addressComponents.state === "Kentucky"
      ) {
        return JSON.parse(SALES_FALLBACK_KY);
      } else {
        return JSON.parse(SALES_FALLBACK);
      }
    };

    const notification = {
      to: salesContact().contactEmail,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      bcc: ["bzmiller82+ntbcc@gmail.com"],
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
      replyTo: salesContact().contactEmail,
      bcc: ["bzmiller82+ntbcc@gmail.com"],
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

    // console.log("request salesContact:", salesContact());
    // console.log('request notification:', notification)

    try {
      // 1) Send notification message
      await sgMail.send(notification);
      await sgMail.send(confirmation);
      // 2) Send data to CRM
      const contactID = await crmLib.createContact(
        { ...contact, source: source, lifecyclestage: "lead" },
        salesContact().hubSpotOwnerId
      );
      // console.log("request-notification createContact contactID:", contactID);
      await crmLib.createDeal(payload, salesContact(), contactID);

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
  }
);
