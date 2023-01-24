const sgMail = require("@sendgrid/mail");
const Sentry = require("@sentry/serverless");
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  HUBSPOT_PRIVATE_APP_TOKEN,
  HUBSPOT_PORTAL_ID,
  URL,
} = process.env;
const Hubspot = require("hubspot");
const hubspot = new Hubspot({
  accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
  checkLimit: false,
});
Sentry.AWSLambda.init({
  dsn: "https://5b66d0cf46fe489bbcc7bbe1a03ba78a@o469784.ingest.sentry.io/5499762",
  tracesSampleRate: 1.0,
  debug: true,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = JSON.parse(event.body);
    Sentry.setContext("character", {
      payload: payload,
    });

    // console.log(payload)
    const {
      fromEmail,
      fromName,
      email,
      year,
      equipmentMakeTitle,
      equipmentCategoriesTitle,
      model,
      price,
      stockNumber,
      hoursCurrent,
      mainImage,
      descriptionBlock,
      closeout,
      videoURL,
      slug,
      imageGallery,
    } = payload;
    const imageGalleryArray = imageGallery.split(",");
    const priceFormatted = price
      ? price.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : null;
    const subject = `Newman Tractor Quote | ${year} ${equipmentMakeTitle} ${model} - ${stockNumber}`;
    const replyToEmailValue =
      fromEmail !== "" ? fromEmail : SENDGRID_FROM_EMAIL;
    const fromNameValue = fromName !== "" ? fromName : SENDGRID_FROM_NAME;
    const ccEmail = fromEmail !== "" ? fromEmail : "";

    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: fromNameValue,
      },
      replyTo: replyToEmailValue,
      bcc: [ccEmail],
      subject: subject,
      templateId: "d-d753ee5ef69a432c92f4cd26b37a8965",
      dynamic_template_data: {
        email: email,
        year: year,
        equipmentMakeTitle: equipmentMakeTitle,
        equipmentCategoriesTitle: equipmentCategoriesTitle,
        model: model,
        price: priceFormatted === "$0" ? null : priceFormatted,
        stockNumber: stockNumber,
        hoursCurrent: hoursCurrent,
        mainImage: mainImage,
        descriptionBlock: descriptionBlock,
        closeout: closeout,
        videoURL: videoURL,
        slug: slug,
        imageGallery: imageGalleryArray,
      },
    };

    const eventData = {
      email: email,
      eventName: "pe20095799_email_equipment_info",
      properties: {
        year: year,
        equipmentmaketitle: equipmentMakeTitle,
        equipmentcategoriestitle: equipmentCategoriesTitle,
        model: model,
        price: price,
        stocknumber: stockNumber,
        url: URL + slug,
        fromemail: replyToEmailValue,
      },
    };

    // const contact = { properties: [{ property: 'email', value: email }] }
    const data = {
      fields: [
        {
          name: "email",
          value: email,
        },
      ],
    };

    try {
      if (email === "bzmiller82+error@gmail.com") {
        throw {
          code: 500,
          message: "Failed because email is bzmiller82+error@gmail.com",
          response: { body: { errors: "" } },
        };
      } else {
        // Commenting out for now until we reolsve the GDPR settings in HubSpot. Users are not getting subscribed automatically through API, the only way to subscribe is through workflows.
        // await hubspot.contacts.create(contact)
        // await hubspot.subscriptions.subscribeToAll(email)
        await hubspot.forms.submit(
          HUBSPOT_PORTAL_ID,
          "d24af600-1186-4270-9560-2398ab01047c",
          data
        );
        await hubspot.apiRequest({
          method: "POST",
          path: `/events/v3/send/`,
          body: eventData,
        });
        await sgMail.send(msg);
        Sentry.captureMessage("Quote email sent successfully");
        return {
          statusCode: 200,
          body: `Message sent`,
          headers: {
            "access-control-allow-origin":
              "https://newmantractorcom.gatsbyjs.io/", // your CORS config here
            "cache-control": "public, max-age=0, must-revalidate",
          },
        };
      }
    } catch (e) {
      console.log(e);
      Sentry.captureException(new Error("Quote Email Failed To Send"), {
        tags: {
          section: "function",
        },
      });
      return {
        statusCode: e.statusCode || e.code,
        body: `${e.message || e.body.message} - ${JSON.stringify(
          e.response.body.errors
        )}`,
      };
    }
  }
);
