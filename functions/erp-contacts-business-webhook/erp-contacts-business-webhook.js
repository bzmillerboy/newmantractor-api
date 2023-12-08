const Sentry = require("@sentry/serverless");
const { SENTRY_CLIENT_KEY, ENV_NAME } = process.env;
// const sgMail = require("@sendgrid/mail");
const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, EEMPHASYS_WEBHOOK_APIKEY } =
  process.env;
const crmLib = require("../lib/crm-lib.js");
const lib = require("../lib/lib.js");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/5499762`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = JSON.parse(event.body);
    // console.log("event:", event);

    // const apiKey = JSON.parse(event.headers["x-api-key"]);
    // if ( !headers.hasOwnProperty('x-api-key') || (headers.hasOwnProperty('x-api-key') && headers['x-api-key'][0].value!="mykey")) {

    // console.log("apiKey:", event?.headers?.authorization);
    // console.log("EEMPHASYS_WEBHOOK_APIKEY:", EEMPHASYS_WEBHOOK_APIKEY);

    if (event?.headers?.authorization !== EEMPHASYS_WEBHOOK_APIKEY) {
      return { statusCode: 401, body: "Not authorized." };
    }

    const dataType =
      payload.BusinessPartners?.length > 0 ? "businessPartner" : "contact";

    if (
      payload.BusinessPartners?.length == 0 &&
      payload.Contacts?.length == 0
    ) {
      return { statusCode: 400, body: "No data provided" };
    }

    console.log(`Syncing ${dataType} data`);

    if (dataType === "businessPartner") {
      const company = payload.BusinessPartners[0];
      const address = company.AddressInfo[0];
      const fullAddress = `${address.Address} ${address.City}, ${address.State} ${address.ZipCode}`;

      if (!company.LongName) {
        return { statusCode: 400, body: "No company name provided" };
      }

      const geocode = await lib.geocodeAddress(fullAddress);
      const county =
        geocode?.results[0]?.address_components?.find(
          (res) => res.types[0] === "administrative_area_level_2"
        )?.long_name || "";
      const state =
        geocode?.results[0]?.address_components?.find(
          (res) => res.types[0] === "administrative_area_level_1"
        )?.long_name || "";

      const salesContact = lib.salesContact(county, state, "", true) || "";
      console.log("salesContact:", salesContact);

      const crmCompanyId = await crmLib.doesCompanyExist(
        company.BusinessPartnerId
      );
      console.log("crmCompanyId:", JSON.stringify(crmCompanyId?.id, null, 2));

      const companyData = {
        name: company.LongName,
        phone: address.Telephone || address.Telephone2 || address.Fax || "",
        erp_id: company.BusinessPartnerId,
        source: "ERP",
        lifecyclestage: "customer",
        address: address.Address,
        city: address.City,
        state: address.State,
        zip: address.ZipCode,
        country: address.Country,
        county: county,
        latitude: geocode?.results[0]?.geometry?.location?.lat || "",
        longitude: geocode?.results[0]?.geometry?.location?.lng || "",
        ownerId: salesContact?.hubSpotOwnerId || "",
      };

      console.log("companyData: ", JSON.stringify(companyData, null, 2));

      if (crmCompanyId) {
        console.log("updating company");
        await crmLib.updateCompany(companyData, crmCompanyId?.id);
      } else {
        console.log("creating company");
        await crmLib.createCompany(companyData);
      }
    }

    if (dataType === "contact") {
      const contact = payload.Contacts[0];
      if (!contact.Email) {
        return { statusCode: 400, body: "No email address provided" };
      }
      console.log("creating or updating contact:", contact);

      const businessPartnerId =
        contact.RelatedBussinessPartnerIDs[0].BussinessPartner;
      const companyInfo = await crmLib.doesCompanyExist(businessPartnerId);

      const salesContactOwnerId =
        businessPartnerId && companyInfo
          ? companyInfo?.properties?.hubspot_owner_id || ""
          : "";
      console.log("salesContactOwnerId:", salesContactOwnerId);

      const contactData = {
        email: contact.Email,
        firstName: contact.FirstName || "",
        lastName: contact.LastName || "",
        phone:
          contact.CellNumber || contact.Telephone || contact.DirectDial || "",
        source: "ERP",
        lifecyclestage: "customer",
        companyId: businessPartnerId && companyInfo ? companyInfo?.id : "",
        erp_id: contact.ContactCode,
        ownerId: salesContactOwnerId,
      };

      console.log("contactData:", JSON.stringify(contactData, null, 2));
      console.log("creating/updating contact");

      await crmLib.createContact(contactData);
    }

    // sgMail.setApiKey(SENDGRID_API_KEY);

    // const msg = {
    //   to: "bzmiller82@gmail.com",
    //   from: {
    //     email: SENDGRID_FROM_EMAIL,
    //     name: "Notifications",
    //   },
    //   subject: "ERP Webhook Event",
    //   templateId: "d-c110cc501843478596c4e1c2ed47195d",
    //   dynamic_template_data: {
    //     payloadString: JSON.stringify(payload),
    //     payload: payload,
    //   },
    // };

    try {
      // await sgMail.send(msg);
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
