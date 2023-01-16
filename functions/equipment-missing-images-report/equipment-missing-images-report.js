const {
  SANITY_TOKEN_ETL,
  SANITY_PROJECT_ID,
  SANITY_DATASET,
  SANITY_API_VERSION,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  SENDGRID_PHOTO_REPORT_RECIPIENTS,
} = process.env;
const sgMail = require("@sendgrid/mail");

const sanityClient = require("@sanity/client");
const client = sanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN_ETL,
  useCdn: false, // `false` if you want to ensure fresh data
  apiVersion: SANITY_API_VERSION,
});

exports.handler = async (event, context) => {
  sgMail.setApiKey(SENDGRID_API_KEY);
  const query = `count(*[_type == 'inventory'  && !defined(mainImage) && !defined(imageGallery) && location->slug.current == $location])`;

  bartowCount = await client.fetch(query, { location: "bartow" });
  veronaCount = await client.fetch(query, { location: "verona" });
  warsawCount = await client.fetch(query, { location: "warsaw" });
  richwoodCount = await client.fetch(query, { location: "richwood" });
  const counts = {
    bartow: bartowCount,
    verona: veronaCount,
    warsaw: warsawCount,
    richwood: richwoodCount,
  };
  const notification = {
    to: "bzmiller82+mpr@gmail.com",
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME,
    },
    bcc: SENDGRID_PHOTO_REPORT_RECIPIENTS.split(","),
    templateId: "d-002a7d99993c4224a8cff1e962e7a7c6",
    dynamic_template_data: {
      counts: counts,
    },
  };

  try {
    mailSend = await sgMail.send(notification);
    console.log("mailSend", mailSend);
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: "Report sent",
    };
  } catch (e) {
    console.log("error", e);
    return {
      statusCode: e.code,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
