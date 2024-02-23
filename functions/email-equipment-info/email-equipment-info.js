const sgMail = require("@sendgrid/mail");
const Sentry = require("@sentry/serverless");
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  HUBSPOT_PRIVATE_APP_TOKEN,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_FORM_EQUIPMENT_INFO,
  WEBSITE_URL,
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
  ignoreSentryErrors: true,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    // console.log(JSON.stringify(event, null, 2));

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
      image,
      description: descriptionBlock,
      closeout,
      videoURL,
      slug,
      imageGallery,
      categorySlug,
      hs_context,
    } = payload;
    const priceFormatted = price
      ? price.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : null;
    const subject = `Info on ${year} ${equipmentMakeTitle} ${model} - ${stockNumber} | Newman Tractor`;
    const replyToEmailValue =
      fromEmail !== "" ? fromEmail : SENDGRID_FROM_EMAIL;
    const fromNameValue = fromName !== "" ? fromName : SENDGRID_FROM_NAME;
    const ccEmail = fromEmail !== "" ? fromEmail : "";
    const slugPath = `${slug}`;
    console.log("x-forwarded-for", slugPath);
    console.log("event.headers[client - ip]", event.headers["client-ip"]);
    const ipAddress = event.headers["x-forwarded-for"]; //|| event.headers[client - ip]

    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: fromNameValue || SENDGRID_FROM_NAME,
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
        mainImage: mainImage || image,
        descriptionBlock: descriptionBlock,
        closeout: closeout,
        videoURL: videoURL,
        slug: slugPath,
        imageGallery: imageGallery,
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
      context: {
        hutk: hs_context?.hutk,
        ipAddress: ipAddress,
        pageUri: hs_context?.pageUrl,
        pageName: hs_context?.pageName,
      },
    };

    console.log("HubSpot Form Data:", JSON.stringify(data, null, 2));

    try {
      if (email === "bzmiller82+error@gmail.com") {
        throw {
          code: 500,
          message: "Failed because email is bzmiller82+error@gmail.com",
          response: { body: { errors: "" } },
        };
      } else {
        await sgMail.send(msg);
        await hubspot.forms.submit(
          HUBSPOT_PORTAL_ID,
          HUBSPOT_FORM_EQUIPMENT_INFO,
          data
        );
        // Sentry.captureMessage("Quote email sent successfully");
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
  },
  {
    ignoreSentryErrors: true,
  }
);
