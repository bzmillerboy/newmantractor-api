const {
  HUBSPOT_PRIVATE_APP_TOKEN,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_FORM_DEMO_REQUEST,
  TERRITORIES_FILE,
} = process.env;
const territories = require("../data/territories.json");
const territoriesDev = require(`../data/territories-dev.json`);

const Hubspot = require("hubspot");
const hubspot = new Hubspot({
  accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
  checkLimit: false,
});

exports.handler = async (event) => {
  const payload = JSON.parse(event.body);
  const { url, contact, hs_context } = payload;
  const firstName = contact.firstName;
  const lastName = contact.lastName;
  const ipAddress = event.headers["x-forwarded-for"].split(",")[0];

  const defaultSalesContact = {
    contactName: "Unassigned",
    contactEmail: "marketing@newmantractor.com",
    hubSpotOwnerId: 91564072,
  };
  const territories =
    TERRITORIES_FILE === "territoriesDev" ? territoriesDev : territoriesProd;
  const salesContact =
    territories.find((c) => c.countyName === contact.county) ||
    defaultSalesContact;

  // console.log(salesContact)

  const data = {
    fields: [
      {
        name: "email",
        value: contact.email,
      },
      {
        name: "firstname",
        value: firstName,
      },
      {
        name: "lastname",
        value: lastName,
      },
      {
        name: "phone",
        value: contact.phone,
      },
      {
        name: "county",
        value: contact.county,
      },
      {
        name: "demo_request_url",
        value: url,
      },
      {
        name: "sales_owner_name",
        value: salesContact.contactName,
      },
      {
        name: "sales_owner_email",
        value: salesContact.contactEmail,
      },
    ],
    context: {
      hutk: hs_context?.hutk,
      ipAddress: ipAddress,
      pageUri: hs_context?.pageUrl || event.headers.referer || "",
      pageName: hs_context?.pageName,
    },
  };

  const contactOwnerData = {
    properties: [
      {
        property: "hubspot_owner_id",
        value: salesContact.hubSpotOwnerId,
      },
    ],
  };

  // const wait = (timeToDelay) => new Promise((resolve) => setTimeout(resolve, timeToDelay))

  try {
    await hubspot.forms.submit(
      HUBSPOT_PORTAL_ID,
      HUBSPOT_FORM_DEMO_REQUEST,
      data
    );
    await hubspot.contacts.createOrUpdate(contact.email, contactOwnerData);
    // await wait(3000)

    return {
      statusCode: 200,
      body: `Demo request sent: ${JSON.stringify(data)}`,
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
