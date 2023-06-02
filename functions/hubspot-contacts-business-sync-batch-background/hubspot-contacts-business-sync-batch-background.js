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

    for (
      let i = 0, len = filteredUsableBusinessPartners.length;
      i < len / 100;
      i++
    ) {
      let sliceStart = i * 100;
      let sliceEnd = i * 100 + 100;

      console.log(`sliceStart: ${sliceStart}, sliceEnd: ${sliceEnd}`);

      const companyData = await Promise.all(
        //TODO: remove the slice to use all data
        filteredUsableBusinessPartners
          .slice(sliceStart, sliceEnd)
          .map(async (company) => {
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
              phone:
                address.Telephone || address.Telephone2 || address.Fax || "",
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

      console.log("# of companies being created:", companyData.length);

      await crmLib.createCompanyBatch(companyData);

      console.log(`${i + 1} batch complete, waiting 10 seconds...`);
      lib.wait(10000);
    }
    console.log(`All batches complete.`);
  }

  if (dataType === "contact") {
    console.log("# of contact:", payload.Contacts.length);

    const filterDuplicateEmailContacts = lib.uniqueBy(
      payload.Contacts,
      "Email"
    );
    console.log("# of unique contact:", filterDuplicateEmailContacts.length);

    const filteredUsableContacts = filterDuplicateEmailContacts.filter((c) => {
      return (
        (c.CellNumber !== "" || c.Telephone !== "" || c.Email !== "") &&
        (c.FirstName !== "" || c.LastName !== "")
      );
    });

    console.log("# of usable contact:", filteredUsableContacts.length);

    // const emailChecker = filteredUsableContacts.map((c) => c.Email);
    // console.log("emailChecker:", JSON.stringify(emailChecker));

    // return;

    for (let i = 0, len = filteredUsableContacts.length; i < len / 100; i++) {
      let sliceStart = i * 100;
      let sliceEnd = i * 100 + 100;

      console.log(`sliceStart: ${sliceStart}, sliceEnd: ${sliceEnd}`);

      const existingCompanies = await crmLib.doesCompanyExistBatch(
        filteredUsableContacts.slice(sliceStart, sliceEnd)
      );
      console.log("# of existing contact companies:", existingCompanies.length);

      const contactData = await Promise.all(
        filteredUsableContacts
          .slice(sliceStart, sliceEnd)
          .map(async (contact) => {
            const ownerId = existingCompanies.find(
              (ec) =>
                ec.properties.erp_id ===
                contact.RelatedBussinessPartnerIDs[0].BussinessPartner
            )?.properties?.hubspot_owner_id;
            return {
              email: contact.Email ? contact.Email.toLowerCase() : "",
              firstName: contact.FirstName || "",
              lastName: contact.LastName || "",
              phone:
                contact.CellNumber ||
                contact.Telephone ||
                contact.DirectDial ||
                "",
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
      const existingContacts = await crmLib.doesContactExistBatch(
        contactDataWithEmails
      );
      console.log("# of existing contacts:", existingContacts.length);
      console.log("existing contacts:", JSON.stringify(existingContacts));

      const contactDataExisting = contactData
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

      const contactDataNew = contactData.filter(
        (c) => !existingContacts.some((ex) => ex.properties.email === c.email)
      );

      console.log("# of contactDataNew:", contactDataNew.length);

      const updateContactBatchRes = await crmLib.updateContactBatch(
        contactDataExisting
      );
      // const creatContactBatchRes = await crmLib.createContactBatch(
      //   contactDataNew
      // );

      const combinedContactResponses = [
        // ...creatContactBatchRes.results,
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
            companyId: hubSpotCompanyId ? hubSpotCompanyId?.id : "",
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

      console.log(`${i + 1} batch complete, waiting 10 seconds...`);
      lib.wait(10000);
    }

    console.log(`All batches complete.`);
  }
};
