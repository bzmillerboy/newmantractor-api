const lib = require("../lib/lib.js");

exports.handler = async (event, context) => {
  const dataType = "CRMGetContact";
  const lastSyncDate = "2023-01-01T00:00:00";

  // 1. Fetch the ERP Contact Data
  const erpContactData = await lib.erpContactFetch(dataType, lastSyncDate);
  console.log("# contacts to sync:", erpContactData?.Contacts.length);

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

// {
//   "ContactCode": "CN0003531",
//   "Title": "",
//   "FirstName": "Jay",
//   "LastName": "Babb",
//   "BirthDate": "0000-00-00T00:00:00Z",
//   "CreationDate": "2022-07-18T01:19:49Z",
//   "LastModifiedDate": "2022-07-21T23:17:19Z",
//   "Telephone": "330.314.5502",
//   "CellNumber": "",
//   "DirectDial": "",
//   "Fax": "",
//   "Email": "",
//   "RelatedBussinessPartnerIDs": [
//     {
//       "BussinessPartner": "BP0002915"
//     }
//   ],
//   "Departments": [
//     {
//       "AvailableInParts": false,
//       "DefaultForParts": false,
//       "AvailableInEquipment": false,
//       "DefaultForEquipment": false,
//       "AvailableInService": false,
//       "DefaultForService": false,
//       "AvailableInRental": true,
//       "DefaultForRental": false
//     }
//   ]
// },
