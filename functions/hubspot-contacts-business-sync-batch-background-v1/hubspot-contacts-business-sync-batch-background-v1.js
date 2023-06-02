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
    const filteredUsableContacts = payload.Contacts.filter((c) => {
      return (
        (c.CellNumber !== "" || c.Telephone !== "" || c.Email !== "") &&
        (c.FirstName !== "" || c.LastName !== "")
      );
    }).slice(0, 5);

    console.log("# of usable contact:", filteredUsableContacts.length);
    // console.log("usable contacts:", JSON.stringify(filteredUsableContacts));

    // **** Left off here *****/
    const existingCompanies = await crmLib.doesCompanyExistBatch(
      filteredUsableContacts
    );
    console.log("existingCompanies:", existingCompanies);

    const contactData = await Promise.all(
      filteredUsableContacts.map(async (contact) => {
        const businessPartnerId =
          contact.RelatedBussinessPartnerIDs[0].BussinessPartner;

        //TODO: this will likely fail due to api limits, improve this
        // const companyInfo = await crmLib.doesCompanyExist(businessPartnerId);
        // const salesContactOwnerId =
        //   businessPartnerId && companyInfo
        //     ? companyInfo?.properties?.hubspot_owner_id || ""
        //     : "";

        return {
          email: contact.Email,
          firstName: contact.FirstName || "",
          lastName: contact.LastName || "",
          phone:
            contact.CellNumber || contact.Telephone || contact.DirectDial || "",
          erp_id: contact.ContactCode,
          source: "ERP",
          lifecyclestage: "customer",
          // companyId: businessPartnerId && companyInfo ? companyInfo?.id : "",
          // ownerId: salesContactOwnerId || "",
        };
      })
    );

    // console.log("contactData:", contactData);

    const contactDataWithEmails = contactData.filter((c) => c.email !== "");
    const existingContacts = await crmLib.doesContactExistBatch(
      contactDataWithEmails
    );

    const contactDataExisting = contactDataWithEmails
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

    // Use existingCompanies response:
    // [
    //   SimplePublicObject {
    //     id: '14916419400',
    //     properties: {
    //       createdate: '2023-03-01T15:39:15.253Z',
    //       erp_id: 'BP0001440',
    //       hs_lastmodifieddate: '2023-03-01T15:42:19.265Z',
    //       hs_object_id: '14916419400'
    //     },
    //     createdAt: 2023-03-01T15:39:15.253Z,
    //     updatedAt: 2023-03-01T15:42:19.265Z,
    //     archived: false
    //   }
    // ]
    // Use creatContactBatchRes & updateContactBatchRes response:
    // {
    //   "id": "10301",
    //   "properties": {
    //     "closedate": "2023-03-01T18:01:42.577Z",
    //     "createdate": "2023-03-01T18:01:42.577Z",
    //     "days_to_close": "1",
    //     "erp_id": "CN0000004",
    //     "firstname": "MIKE",
    //     "hs_all_contact_vids": "10301",
    //     "hs_calculated_phone_number": "+15132271572",
    //     "hs_calculated_phone_number_country_code": "US",
    //     "hs_is_contact": "true",
    //     "hs_is_unworked": "true",
    //     "hs_lifecyclestage_customer_date": "2023-03-01T18:01:42.577Z",
    //     "hs_marketable_status": "false",
    //     "hs_marketable_until_renewal": "false",
    //     "hs_object_id": "10301",
    //     "hs_pipeline": "contacts-lifecycle-pipeline",
    //     "hs_searchable_calculated_phone_number": "5132271572",
    //     "hs_time_between_contact_creation_and_deal_close": "0",
    //     "lastmodifieddate": "2023-03-01T18:01:42.577Z",
    //     "lastname": "DEDDEN",
    //     "lifecyclestage": "customer",
    //     "phone": "513-227-1572",
    //     "source_attribution": "ERP"
    //   },
    //   "createdAt": "2023-03-01T18:01:42.577Z",
    //   "updatedAt": "2023-03-01T18:01:42.577Z",
    //   "archived": false
    // }
    // match contact by 'ERP CN ID', get HS ID
    // match company by 'ERP ID', get HS ID

    const combinedContactResponses = [
      ...creatContactBatchRes.results,
      ...updateContactBatchRes.results,
    ];
    console.log("combined responses", JSON.stringify(combinedContactResponses));

    const contactsToCompanyAssociations = combinedContactResponses.map(
      (contact) => {
        // search existingCompanies & filteredUsableContacts and match bp id to hs erp_id
        const hubSpotCompanyId = existingCompanies.find(
          (ec) => ec.properties.erp_id === contact.properties.erp_id
        ); //?.id;
        const hubSpotContactId = filteredUsableContacts.find(
          (fc) => fc.ContactCode === contact.properties.erp_id
        );

        return {
          companyId: hubSpotCompanyId,
          contactId: hubSpotContactId ? contact.id : "",
        };
      }
    );

    console.log(
      "contactsToCompanyAssociations:",
      contactsToCompanyAssociations
    );

    // await crmLib.createContactToCompanyBatch(contactIdsAndCompanyIds);
  }
};

// Used for testing
// fs.writeFile(
//   "filtered-contacts-data.json",
//   JSON.stringify(contactData),
//   (err) => {
//     if (err) {
//       console.error(err);
//       return;
//     }
//     //file written successfully
//   }
// );
