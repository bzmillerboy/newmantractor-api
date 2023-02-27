const crmLib = require("../lib/crm-lib.js");
const lib = require("../lib/lib.js");

exports.handler = async (event, context) => {
  const payload = JSON.parse(event.body);
  const dataType =
    payload.BusinessPartners?.length > 0 ? "businessPartner" : "contact";

  if (payload.BusinessPartners?.length == 0 && payload.Contacts?.length == 0) {
    return { statusCode: 400, body: "No data provided" };
  }

  if (dataType === "businessPartner") {
    const company = payload.BusinessPartners[0];
    const address = company.AddressInfo[0];
    const fullAddress = `${address.Address} ${address.City}, ${address.State} ${address.ZipCode}`;

    if (!company.LongName) {
      return { statusCode: 400, body: "No company name provided" };
    }

    const geocode = await lib.geocodeAddress(fullAddress);
    // console.log(JSON.stringify(geocode));
    const county =
      geocode?.results[0]?.address_components?.find(
        (res) => res.types[0] === "administrative_area_level_2"
      )?.long_name || "";
    const state =
      geocode?.results[0]?.address_components?.find(
        (res) => res.types[0] === "administrative_area_level_1"
      )?.long_name || "";

    const salesContact = lib.salesContact(county, state) || "";
    console.log("salesContact:", salesContact);

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
    const companyInfo = await crmLib.doesCompanyExist(businessPartnerId);
    // console.log("companyInfo:", companyInfo);

    const salesContactOwnerId =
      businessPartnerId && companyInfo
        ? companyInfo?.properties?.hubspot_owner_id || ""
        : "";

    const contactData = {
      email: contact.Email,
      firstName: contact.FirstName || "",
      lastName: contact.LastName || "",
      phone:
        contact.CellNumber || contact.Telephone || contact.DirectDial || "",
      source: "ERP",
      lifecyclestage: "customer",
      companyId: businessPartnerId && companyInfo ? companyInfo?.id : "",
    };
    await crmLib.createContact(contactData, salesContactOwnerId);
  }
};
