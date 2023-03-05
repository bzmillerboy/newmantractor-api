const crmLib = require("../lib/crm-lib.js");
const lib = require("../lib/lib.js");
const fs = require("fs");

exports.handler = async (event, context) => {
  const payload = JSON.parse(event.body);
  const dataType =
    payload.BusinessPartners?.length > 0 ? "businessPartner" : "contact";

  if (dataType === "businessPartner") {
    console.log("# of business partners:", payload.BusinessPartners.length);
    const filteredUsableBusinessPartners = payload.BusinessPartners.map(
      (bp) => {
        const filteredAddress = bp.AddressInfo.filter(
          (address) =>
            address.Telephone2 !== "" ||
            address.Telephone !== "" ||
            address.Email !== ""
        );
        // if (filteredAddress.length > 0) {
        //   return { ...bp, AddressInfo: filteredAddress };
        // }
        return { ...bp, AddressInfo: filteredAddress };
      }
    ).filter((bp) => bp.AddressInfo.length > 0 && bp.LongName !== "");

    console.log(
      "# of usable business partners:",
      filteredUsableBusinessPartners.length
    );

    const companyData = await Promise.all(
      //TODO: remove the slice to use all data
      filteredUsableBusinessPartners.slice(0, 4).map(async (company) => {
        const address = company.AddressInfo.reduce((a, b) =>
          a.LastModifiedDate > b.LastModifiedDate ? a : b
        );
        const fullAddress = `${address.Address} ${address.City}, ${address.State} ${address.ZipCode}`;
        const geocode = await lib.geocodeAddress(fullAddress);
        const county =
          geocode?.results[0]?.address_components?.find(
            (res) => res.types[0] === "administrative_area_level_2"
          )?.long_name || "";
        const state =
          geocode?.results[0]?.address_components?.find(
            (res) => res.types[0] === "administrative_area_level_1"
          )?.long_name || "";

        const salesContact = lib.salesContact(county, state) || "";
        // console.log("salesContact:", salesContact);

        return {
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
      })
    );

    // console.log("companyData:", companyData);

    await crmLib.createCompanyBatch(companyData);
  }

  if (dataType === "contact") {
    console.log("# of contact:", payload.Contacts.length);

    const filterDuplicateEmailContacts = lib.uniqueBy(
      payload.Contacts,
      "Email"
    );
    console.log("# of unique contact:", filterDuplicateEmailContacts.length);
    // console.log(
    //   "filterDuplicateEmailContacts:",
    //   JSON.stringify(filterDuplicateEmailContacts, null, 2)
    // );

    const filteredUsableContacts = filterDuplicateEmailContacts
      .filter((c) => {
        return (
          (c.CellNumber !== "" || c.Telephone !== "" || c.Email !== "") &&
          (c.FirstName !== "" || c.LastName !== "")
        );
      })
      .slice(0, 5);

    console.log("# of usable contact:", filteredUsableContacts.length);
    // console.log(
    //   "filteredUsableContacts:",
    //   JSON.stringify(filteredUsableContacts)
    // );

    const existingCompanies = await crmLib.doesCompanyExistBatch(
      filteredUsableContacts
    );
    console.log("# of existing contact companies:", existingCompanies.length);
    // console.log(
    //   "existingCompanies:",
    //   JSON.stringify(existingCompanies, null, 2)
    // );

    const contactData = await Promise.all(
      filteredUsableContacts.map(async (contact) => {
        const ownerId = existingCompanies.find(
          (ec) =>
            ec.properties.erp_id ===
            contact.RelatedBussinessPartnerIDs[0].BussinessPartner
        )?.properties?.hubspot_owner_id;

        // console.log(
        //   `${contact.FirstName} ${contact.LastName} has company ${contact.RelatedBussinessPartnerIDs[0].BussinessPartner} and owner ${ownerId}`
        // );

        return {
          email: contact.Email,
          firstName: contact.FirstName || "",
          lastName: contact.LastName || "",
          phone:
            contact.CellNumber || contact.Telephone || contact.DirectDial || "",
          erp_id: contact.ContactCode,
          source: "ERP",
          lifecyclestage: "customer",
          ownerId: ownerId || "",
        };
      })
    );

    // Filter to contacts with only emails and use to create new contacts array
    const contactDataWithEmails = contactData.filter((c) => c.email !== "");
    console.log("# of contact with emails:", contactDataWithEmails.length);
    // const uniqueContacts = lib.uniqueBy(contactDataWithEmails, "email");
    // console.log("# of unique contact:", uniqueContacts.length);
    const existingContacts = await crmLib.doesContactExistBatch(
      contactDataWithEmails
    );
    console.log("# of existing contacts:", existingContacts.length);

    const contactDataExisting = existingContacts
      .filter((c) =>
        existingContacts.some((ex) => ex.properties.email === c.email)
      )
      .map((c) => {
        const hubSpotContact = existingContacts.find(
          (ex) => ex.properties.email === c.email
        );
        return { ...c, hubSpotId: hubSpotContact?.id };
      });

    console.log("# of contactDataExisting:", contactDataExisting.length);
    // console.log("contactDataExisting:", contactDataExisting);

    const contactDataNew = contactData.filter(
      (c) => !existingContacts.some((ex) => ex.properties.email === c.email)
    );

    console.log("# of contactDataNew:", contactDataNew.length);

    const updateContactBatchRes = await crmLib.updateContactBatch(
      contactDataExisting
    );
    const creatContactBatchRes = await crmLib.createContactBatch(
      contactDataNew
    );
    // console.log("creatContactBatchRes:", creatContactBatchRes);
    // console.log("updateContactBatchRes:", updateContactBatchRes);

    const combinedContactResponses = [
      ...creatContactBatchRes.results,
      ...updateContactBatchRes.results,
    ];

    const contactsToCompanyAssociations = combinedContactResponses.map(
      (contact) => {
        // search existingCompanies & filteredUsableContacts and match bp id to hs erp_id

        const erpContact = filteredUsableContacts.find(
          (fc) => fc.ContactCode === contact.properties.erp_id
        );

        const hubSpotContactId = filteredUsableContacts.find(
          (fc) => fc.ContactCode === contact.properties.erp_id
        );

        const hubSpotCompanyId = existingCompanies.find(
          (ec) =>
            ec.properties.erp_id ===
            erpContact.RelatedBussinessPartnerIDs[0].BussinessPartner
        );

        return {
          companyId: hubSpotCompanyId.id,
          contactId: hubSpotContactId ? contact.id : "",
        };
      }
    );

    const createContactToCompanyBatchRes =
      await crmLib.createContactToCompanyBatch(contactsToCompanyAssociations);
    console.log(
      "# of createContactToCompanyBatchRes:",
      createContactToCompanyBatchRes.length
    );
  }
};
