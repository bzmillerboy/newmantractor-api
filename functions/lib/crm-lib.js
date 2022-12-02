const { HUBSPOT_API_KEY, HUBSPOT_DEVELOPER_API_KEY } = process.env;
const hubspot = require("@hubspot/api-client");
const hubSpotProd = true;
const hubSpotApiData = hubSpotProd
  ? {
      apiKey: HUBSPOT_API_KEY,
      quoteDealstageId: 20352802,
      rentalDealstageId: 23503170,
      rentalPipelineId: "494104",
      quotePipelineId: "default",
    }
  : {
      apiKey: HUBSPOT_DEVELOPER_API_KEY,
      quoteDealstageId: 20352802,
      rentalDealstageId: 23503170,
      rentalPipelineId: "494104",
      quotePipelineId: "default",
    };

const hubspotClient = new hubspot.Client({
  apiKey: hubSpotApiData.apiKey,
  developerApiKey: HUBSPOT_DEVELOPER_API_KEY,
  useLimiter: false,
});
// const fs = require('fs')

const createContact = async (contact, salesContactOwnerId) => {
  // console.log('createContact:', contact, salesContactOwnerId)
  const PublicObjectSearchRequest = {
    filterGroups: [
      {
        filters: [
          {
            operator: "EQ",
            propertyName: "email",
            value: contact.email,
          },
        ],
      },
    ],
  };

  try {
    const apiResponse = await hubspotClient.crm.contacts.searchApi.doSearch(
      PublicObjectSearchRequest
    );
    // console.log(
    //   'hubspotClient.crm.contacts.searchApi.doSearch:',
    //   JSON.stringify(apiResponse, null, 2)
    // )
    if (apiResponse.total === 0) {
      const contactId = await createNewContact(contact, salesContactOwnerId);
      return contactId;
    } else {
      const contactId = apiResponse.results[0].id;
      await updateContact(contact, contactId, salesContactOwnerId);
      return contactId;
    }
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createNewContact = async (contact, salesContactOwnerId) => {
  // console.log('createContact contact:', contact)
  const addressComponents = JSON.parse(contact.addressComponents);
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    phone: contact.phone || "",
    county: contact.county,
    hubspot_owner_id: salesContactOwnerId,
    address: addressComponents.streetAddress || contact.addressPoBoxStreet,
    city: addressComponents.city || contact.addressPoBoxCity,
    state: addressComponents.stateAbbr || contact.addressPoBoxState,
    zip: addressComponents.postalCode || contact.addressPoBoxZip,
  };
  const SimplePublicObjectInput = { properties };
  // console.log('createContact SimplePublicObjectInput:', SimplePublicObjectInput)
  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.create(
      SimplePublicObjectInput
    );
    // console.log('hubspotClient.crm.contacts.basicApi.create:', JSON.stringify(apiResponse, null, 2));
    return apiResponse.id;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const updateContact = async (contact, contactId, salesContactOwnerId) => {
  const addressComponents = JSON.parse(contact.addressComponents || "{}");
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    phone: contact.phone || "",
    county: contact.county,
    hubspot_owner_id: salesContactOwnerId,
    address: addressComponents.streetAddress || contact.addressPoBoxStreet,
    city: addressComponents.city || contact.addressPoBoxCity,
    state: addressComponents.stateAbbr || contact.addressPoBoxState,
    zip: addressComponents.postalCode || contact.addressPoBoxZip,
  };
  const SimplePublicObjectInput = { properties };
  // console.log('updateContact SimplePublicObjectInput:', SimplePublicObjectInput)
  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.update(
      contactId,
      SimplePublicObjectInput
    );
    // console.log('hubspotClient.crm.contacts.basicApi.update:', JSON.stringify(apiResponse, null, 2));
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createDeal = async (payload, salesContact, contactID) => {
  const { contact, cart, cartType } = payload;
  const { firstName, lastName, startDate, duration, wantDelivery, location } =
    contact;
  const properties = {
    dealname: `${firstName} ${lastName} ${cart[0].subCategoryTitle}`,
    dealstage:
      cartType === "quote"
        ? hubSpotApiData.quoteDealstageId
        : hubSpotApiData.rentalDealstageId,
    hubspot_owner_id: hubSpotProd
      ? salesContact.hubSpotOwnerId || "91564072"
      : "183417865", // check env, falls back to stephanie@newmantractor.com,
    closedate: startDate || null,
    rental_duration: duration || "",
    delivery_: wantDelivery,
    job_location: location || "",
    pipeline:
      cartType === "quote"
        ? hubSpotApiData.quotePipelineId
        : hubSpotApiData.rentalPipelineId,
  };
  const SimplePublicObjectInput = { properties };

  try {
    const apiResponse = await hubspotClient.crm.deals.basicApi.create(
      SimplePublicObjectInput
    );
    console.log(
      "hubspotClient.crm.deals.basicApi.create:",
      JSON.stringify(apiResponse, null, 2)
    );
    await createDealContactAssociation(contactID, apiResponse.id);
    await createDealLineItems(cart, apiResponse.id);
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e, null, 2))
      : console.error(e);
  }
};

const getProductIds = async (cart) => {
  const inputValues = cart.map((item) => {
    return { id: item._id };
  });

  const batchReadObjectId = {
    properties: ["cms_id", "name"],
    idProperty: "cms_id",
    inputs: inputValues,
  };
  const archived = false;

  try {
    const apiResponse = await hubspotClient.crm.products.batchApi.read(
      batchReadObjectId,
      archived
    );
    console.log(
      "hubspotClient.crm.products.batchApi.read:",
      JSON.stringify(apiResponse.results)
    );
    return apiResponse.results;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createDealLineItems = async (cart, deal) => {
  console.log("createDealLineItems cart:", cart);
  console.log("createDealLineItems deal:", deal);

  const producIds = await getProductIds(cart);

  const cartArr = cart.map(async (item) => {
    // Map rental options
    if (item.options && item.options.length > 0) {
      createDealLineItems(item.options, deal);
    }

    return {
      properties: {
        hs_product_id: producIds.find(
          (product) => product?.properties?.cms_id === item._id
        ).id,
        quantity: item.quantity || 1,
        price: item.price || 0,
      },
    };
  });
  const cartItems = await Promise.all(cartArr);

  console.log("cartItems:", cartItems);

  const BatchInputSimplePublicObjectInput = { inputs: cartItems };

  try {
    const apiResponse = await hubspotClient.crm.lineItems.batchApi.create(
      BatchInputSimplePublicObjectInput
    );
    console.log(
      "hubspotClient.crm.lineItems.batchApi.create:",
      JSON.stringify(apiResponse, null, 2)
    );
    await createDealLineItemAssociation(apiResponse.results, deal);
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createDealLineItemAssociation = async (lineItems, deal) => {
  console.log("createDealLineItemAssociation:", lineItems);
  await Promise.all(
    lineItems.map(async (item) => {
      console.log("creating association for line item: ", item.id);
      await createDealLineItemAssociations(item.id, deal);
      return "all associations are complete";
    })
  );
  return lineItems;
};

const createDealLineItemAssociations = async (id, deal) => {
  const lineItemId = id;
  const toObjectType = "deals";
  const toObjectId = deal;
  const associationType = "line_item_to_deal";

  try {
    const apiResponse =
      await hubspotClient.crm.lineItems.associationsApi.create(
        lineItemId,
        toObjectType,
        toObjectId,
        associationType
      );
    console.log("createAssociation", JSON.stringify(apiResponse, null, 2));
    return "createAssociation complete";
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createDealContactAssociation = async (contactId, deal) => {
  // const contactId = contactId;
  const toObjectType = "deals";
  const toObjectId = deal;
  const associationType = "contact_to_deal";

  try {
    const apiResponse = await hubspotClient.crm.contacts.associationsApi.create(
      contactId,
      toObjectType,
      toObjectId,
      associationType
    );
    console.log(
      "hubspotClient.crm.contacts.associationsApi.create:",
      JSON.stringify(apiResponse.body, null, 2)
    );
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const get100ProductIds = async (next) => {
  const limit = 100;
  const after = next || undefined;
  const properties = ["hs_product_id", "cms_id", "name"];
  const propertiesWithHistory = undefined;
  const associations = undefined;
  const archived = false;

  try {
    const apiResponse = await hubspotClient.crm.products.basicApi.getPage(
      limit,
      after,
      properties,
      propertiesWithHistory,
      associations,
      archived
    );
    // console.log(JSON.stringify(apiResponse.results, null, 2))
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const getAllProducts = async (products) => {
  let paging = true;
  const allHubSpotProducts = [];
  let productBatch = [];

  do {
    productBatch = await get100ProductIds(
      productBatch?.paging?.next?.after || null
    );
    if (productBatch.results.length > 0 && productBatch?.paging?.next?.after) {
      allHubSpotProducts.push(...productBatch.results);
      paging = true;
    } else {
      paging = false;
    }
  } while (paging);

  console.log("HubSpot Product Count: ", allHubSpotProducts.length);
  return allHubSpotProducts;
};

const deleteProducts = async (allCmsProducts, allCrmProducts) => {
  const productDeleteBatch = allCrmProducts.filter((product) => {
    if (
      !allCmsProducts.some((p) => p._id === product.properties.cms_id) &&
      product.properties.cms_id
    ) {
      console.log(
        `Product ${product.properties.cms_id} - ${product.id} - ${product.properties.name} needs deleted`
      );
      return true;
    } else {
      return false;
    }
  });

  console.log(`${productDeleteBatch.length} deleted`);

  const batchToDelete = { inputs: productDeleteBatch };
  if (batchToDelete.inputs.length > 0) {
    try {
      const apiResponse = await hubspotClient.crm.products.batchApi.archive(
        batchToDelete
      );
      console.log(JSON.stringify(apiResponse, null, 2));
    } catch (e) {
      e.message === "HTTP request failed"
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
    }
  }
};

const getProductsWithNoFolder = async () => {
  const PublicObjectSearchRequest = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "hs_folder_id",
            operator: "NOT_HAS_PROPERTY",
          },
        ],
      },
    ],
    properties: ["cms_id", "hs_sku", "hs_folder_id"],
    limit: 100,
  };

  try {
    const apiResponse = await hubspotClient.crm.products.searchApi.doSearch(
      PublicObjectSearchRequest
    );
    console.log(
      "getProductsWithNoFolder:",
      JSON.stringify(apiResponse.body, null, 2)
    );
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const updateBatchProductFolder = async (products, folderId) => {
  const inputsArr = products.map((p) => {
    return {
      id: p.id,
      properties: {
        hs_folder_id: folderId,
      },
    };
  });

  const BatchInputSimplePublicObjectBatchInput = {
    inputs: inputsArr,
  };

  // console.log(JSON.stringify(BatchInputSimplePublicObjectBatchInput));

  try {
    const apiResponse = await hubspotClient.crm.products.batchApi.update(
      BatchInputSimplePublicObjectBatchInput
    );
    console.log(JSON.stringify(apiResponse.body, null, 2));
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

module.exports = {
  createDeal,
  createContact,
  getAllProducts,
  deleteProducts,
  getProductsWithNoFolder,
  updateBatchProductFolder,
};
