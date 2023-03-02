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
const dayjs = require("dayjs");

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
  const query = `count(*[_type == 'inventory' && status == "stock"  && !defined(mainImage) && !defined(imageGallery) && (equipmentCategories->categoryType == $type) && (!(deliveryDate > now()) || deliveryDate == "") && location->slug.current == $location])`;

  bartowCountAttachment = await client.fetch(query, {
    location: "bartow",
    type: "attachment",
  });
  bartowCountModel = await client.fetch(query, {
    location: "bartow",
    type: "model",
  });
  apopkaCountAttachment = await client.fetch(query, {
    location: "apopka",
    type: "attachment",
  });
  apopkaCountModel = await client.fetch(query, {
    location: "apopka",
    type: "model",
  });
  veronaCountAttachment = await client.fetch(query, {
    location: "verona",
    type: "attachment",
  });
  veronaCountModel = await client.fetch(query, {
    location: "verona",
    type: "model",
  });
  warsawCountAttachment = await client.fetch(query, {
    location: "warsaw",
    type: "attachment",
  });
  warsawCountModel = await client.fetch(query, {
    location: "warsaw",
    type: "model",
  });
  richwoodCountAttachment = await client.fetch(query, {
    location: "richwood",
    type: "attachment",
  });
  richwoodCountModel = await client.fetch(query, {
    location: "richwood",
    type: "model",
  });
  stClairsvilleCountAttachment = await client.fetch(query, {
    location: "st-clairsville",
    type: "attachment",
  });
  stClairsvilleCountModel = await client.fetch(query, {
    location: "st-clairsville",
    type: "model",
  });

  const counts = {
    bartowAttachment: bartowCountAttachment,
    bartowModel: bartowCountModel,
    apopkaAttachment: apopkaCountAttachment,
    apopkaModel: apopkaCountModel,
    veronaAttachment: veronaCountAttachment,
    veronaModel: veronaCountModel,
    warsawAttachment: warsawCountAttachment,
    warsawModel: warsawCountModel,
    richwoodAttachment: richwoodCountAttachment,
    richwoodModel: richwoodCountModel,
    stClairsvilleCountAttachment: stClairsvilleCountAttachment,
    stClairsvilleCountModel: stClairsvilleCountModel,
  };
  const subject = `Missing Photo Report - ${dayjs(
    new Date().toLocaleString()
  ).format("MM/DD/YYYY")} | newmantractor.com`;

  const notification = {
    to: "bzmiller82+mpr@gmail.com",
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME,
    },
    bcc: SENDGRID_PHOTO_REPORT_RECIPIENTS.split(","),
    templateId: "d-002a7d99993c4224a8cff1e962e7a7c6",
    subject: subject,
    dynamic_template_data: {
      counts: counts,
    },
  };

  try {
    mailSend = await sgMail.send(notification);
    console.log("mailSend", mailSend);
    console.log("counts", counts);
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(counts),
    };
  } catch (e) {
    console.log("error", e);
    return {
      statusCode: e.code,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
