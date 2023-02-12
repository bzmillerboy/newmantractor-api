const crmLib = require("../lib/crm-lib.js");

exports.handler = async (event, context) => {
  const payload = JSON.parse(event.body);
  const dataType =
    payload.BusinessPartners?.length > 0 ? "businessPartner" : "contact";

  if (dataType === "businessPartner") {
    const company = payload.BusinessPartners[0];
    const address = company.AddressInfo[0];
    if (!company.LongName) {
      return { statusCode: 400, body: "No company name provided" };
    }
    const companyData = {
      name: company.LongName,
      phone: company.Telephone || company.Telephone2 || company.Fax || "",
      erp_id: company.BusinessPartnerId,
      source: "ERP",
      lifecyclestage: "customer",
      address: address.Address,
      city: address.City,
      state: address.State,
      zip: address.ZipCode,
      country: address.Country,
      county: address.County,
    };
    const crmCompanyId = await crmLib.doesCompanyExist(
      company.BusinessPartnerId
    );
    if (crmCompanyId) {
      console.log("updating company");
      await crmLib.updateCompany(companyData, crmCompanyId);
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
    const companyId = await crmLib.doesCompanyExist(businessPartnerId);

    const contactData = {
      email: contact.Email,
      firstName: contact.FirstName || "",
      lastName: contact.LastName || "",
      phone:
        contact.CellNumber || contact.Telephone || contact.DirectDial || "",
      source: "ERP",
      lifecyclestage: "customer",
      companyId: businessPartnerId ? companyId : "",
      // BirthDate - excluding since records have a value
      // Business - will include this if one exist that matches the ERP business partner id
    };
    await crmLib.createContact(contactData, null);
  }
};
