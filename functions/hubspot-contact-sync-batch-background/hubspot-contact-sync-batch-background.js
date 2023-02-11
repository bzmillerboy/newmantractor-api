const lib = require("../lib/lib.js");

exports.handler = async (event, context) => {
  const dataType = "CRMGetContact";
  const lastSyncDate = "2023-01-01T00:00:00";

  // 1. Fetch the ERP Contact Data
  const erpContactData = await lib.erpContactFetch(dataType, lastSyncDate);
  console.log("# contacts to sync:", erpContactData?.Contacts.length);

  // 2. Check if contact existing or new in Hubspot

  // 2. Create new contacts in Hubspot
  const hubspotContactData = await lib.createContactsBatch(erpContactData);
  console.log("contacts created:", hubspotContactData);

  // 4. Update existing contacts in Hubspot

  // 3. Create association to company in Hubspot
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
