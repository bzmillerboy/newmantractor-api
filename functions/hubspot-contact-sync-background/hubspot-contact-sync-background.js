const crmLib = require("../lib/crm-lib.js");

exports.handler = async (event, context) => {
  const payload = JSON.parse(event.body);
  const dataType = "CRMGetContact";
  const lastSyncDate = "2023-01-01T00:00:00";

  // 0. Check if it's for contact or business partners
  // todo: add business partner sync & fetch company id from Hubspot to be used in contact sync

  const contact = payload.Contacts[0];
  if (!contact.Email) {
    return { statusCode: 400, body: "No email address provided" };
  }
  const contactData = {
    email: contact.Email,
    firstName: contact.FirstName || "",
    lastName: contact.LastName || "",
    phone: contact.CellNumber || contact.Telephone || contact.DirectDial || "",
    source: "ERP",
    lifecyclestage: "customer",
    // BirthDate - excluding since records have a value
    // Business - will include this if one exist that matches the ERP business partner id
  };
  const hubspotContactData = await crmLib.createContact(contactData, null);
};
