const { HUBSPOT_PRIVATE_APP_TOKEN, HUBSPOT_DEVELOPER_PRIVATE_APP_TOKEN } =
  process.env;
const hubspot = require("@hubspot/api-client");
const hubSpotProd = true;
const hubSpotApiData = hubSpotProd
  ? {
      accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
      quoteDealstageId: 20352802,
      rentalDealstageId: 23503170,
      rentalPipelineId: "494104",
      quotePipelineId: "default",
    }
  : {
      accessToken: HUBSPOT_DEVELOPER_PRIVATE_APP_TOKEN,
      quoteDealstageId: 20352802,
      rentalDealstageId: 23503170,
      rentalPipelineId: "494104",
      quotePipelineId: "default",
    };

const hubspotClient = new hubspot.Client({
  accessToken: hubSpotApiData.accessToken,
  useLimiter: false,
});
const lib = require("../lib/lib");
const cmsLib = require("../lib/cms-lib");

// const fs = require('fs')

const createContact = async (contact, salesContactOwnerId) => {
  // console.log('createContact contact:', contact)
  const addressComponents =
    contact.addressComponents && JSON.parse(contact.addressComponents);
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    phone: contact.phone || "",
    ...(contact.county && { county: contact.county }),
    ...(salesContactOwnerId && { hubspot_owner_id: salesContactOwnerId }),
    ...(addressComponents && {
      address: addressComponents.streetAddress || contact.addressPoBoxStreet,
    }),
    ...(addressComponents && {
      city: addressComponents.city || contact.addressPoBoxCity,
    }),
    ...(addressComponents && {
      state: addressComponents.stateAbbr || contact.addressPoBoxState,
    }),
    ...(addressComponents && {
      zip: addressComponents.postalCode || contact.addressPoBoxZip,
    }),
    lifecyclestage: contact.lifecyclestage || "lead",
    source_attribution: contact.source || "Website",
  };
  const input = { properties };
  // console.log("createContact input:", input);
  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.create(input);
    console.log(
      "hubspotClient.crm.contacts.basicApi.create:",
      JSON.stringify(apiResponse, null, 2)
    );
    const contactId = apiResponse.results[0].id;
    return contactId;
  } catch (e) {
    if (e.code === 409) {
      console.log("Contact already exists");
      const contactIdSplit = e.body.message.split("Existing ID: ");
      const contactId = contactIdSplit[1];
      // console.log("contactId:", contactId[1]);
      return await updateContact(contact, contactId, salesContactOwnerId);
    } else {
      // console.log("e:", JSON.stringify(e));
      e.message === "HTTP request failed"
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
    }
  }
};

const updateContact = async (contact, contactId, salesContactOwnerId) => {
  const addressComponents =
    contact.addressComponents && JSON.parse(contact.addressComponents);
  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    phone: contact.phone || "",
    ...(contact.county && { county: contact.county }),
    ...(salesContactOwnerId && { hubspot_owner_id: salesContactOwnerId }),
    ...(addressComponents && {
      address: addressComponents.streetAddress || contact.addressPoBoxStreet,
    }),
    ...(addressComponents && {
      city: addressComponents.city || contact.addressPoBoxCity,
    }),
    ...(addressComponents && {
      state: addressComponents.stateAbbr || contact.addressPoBoxState,
    }),
    ...(addressComponents && {
      zip: addressComponents.postalCode || contact.addressPoBoxZip,
    }),
  };
  const SimplePublicObjectInput = { properties };
  // console.log('updateContact SimplePublicObjectInput:', SimplePublicObjectInput)
  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.update(
      contactId,
      SimplePublicObjectInput
    );
    // console.log('hubspotClient.crm.contacts.basicApi.update:', JSON.stringify(apiResponse, null, 2));
    console.log("Contact updated");
    return contactId;
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
  const AssociationSpec = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: 20, //lineItemToDeal
    },
  ];

  try {
    const apiResponse =
      await hubspotClient.crm.lineItems.associationsApi.create(
        lineItemId,
        toObjectType,
        toObjectId,
        AssociationSpec
      );
    console.log("createAssociation", JSON.stringify(apiResponse, null, 2));
    return "createAssociation complete";
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const createDealContactAssociation = async (contactId, dealId) => {
  // console.log("createDealContactAssociation:", contactId, dealId);
  // contactId
  const toObjectType = "deals";
  const toObjectId = dealId;
  const AssociationSpec = [
    {
      associationCategory: "HUBSPOT_DEFINED",
      associationTypeId: 4, //contactToDeal
    },
  ];

  try {
    const apiResponse = await hubspotClient.crm.contacts.associationsApi.create(
      contactId,
      toObjectType,
      toObjectId,
      AssociationSpec
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
  const archived = false;
  const propertiesWithHistory = undefined;
  const associations = undefined;

  console.log("get100ProductIds after: ", after);

  try {
    const apiResponse = await hubspotClient.crm.products.basicApi.getPage(
      limit,
      after,
      properties,
      propertiesWithHistory,
      associations,
      archived
    );
    // console.log("get100ProductIds res: ", JSON.stringify(apiResponse, null, 2));
    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
};

const getAllProducts = async () => {
  let paging = true;
  const allHubSpotProducts = [];
  let productBatch = [];

  while (paging) {
    productBatch = await get100ProductIds(
      productBatch?.paging?.next?.after || null
    );
    // console.log("productBatch: ", JSON.stringify(productBatch));
    if (productBatch.results.length > 0) {
      console.log(
        "products found, pushing to allHubSpotProducts: ",
        productBatch.results.length
      );
      allHubSpotProducts.push(...productBatch.results);
    }
    if (productBatch?.paging?.next?.after) {
      paging = true;
    } else {
      paging = false;
    }
  }

  // console.log("getAllProducts Count: ", allHubSpotProducts.length);
  return allHubSpotProducts;
};

const deleteProducts = async (allCrmProducts) => {
  const productDeleteBatch = allCrmProducts.map((product) => {
    return { id: product.id };
  });

  console.log(`${productDeleteBatch.length} to delete`);

  const limit = 100;
  let batchStart = 0;
  let batchEnd = limit;

  do {
    const batch = productDeleteBatch.slice(batchStart, batchEnd);
    const batchToDelete = { inputs: batch };
    // console.log("batchStart:", batchStart);
    // console.log("batchEnd:", batchEnd);
    // console.log("batchToDelete:", JSON.stringify(batchToDelete));
    console.log("Batch of products to delete:", batch.length);

    try {
      const apiResponse = await hubspotClient.crm.products.batchApi.archive(
        batchToDelete
      );
      console.log(`Loop ran through ${batchStart} - ${batchEnd} products`);
      batchStart = batchStart + limit;
      batchEnd = batchEnd + limit;
      console.log(`Loop ended on ${batchStart} - ${batchEnd} products`);
    } catch (e) {
      e.message === "HTTP request failed"
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
      break;
    }
  } while (productDeleteBatch.length >= batchEnd - limit);

  return;
};

// Create a delete products function that removes items from HubSpot that are not in the CMS

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
    return;
  }
};

async function createProducts(products) {
  const limit = 100;
  let batchStart = 0;
  let batchEnd = limit;

  do {
    const batch = products.slice(batchStart, batchEnd);
    const batchToCreate = {
      inputs: batch,
    };
    console.log("Batch to create:", batch.length);
    try {
      const apiResponse = await hubspotClient.crm.products.batchApi.create(
        batchToCreate
      );
      // console.log("createProducts res:", JSON.stringify(apiResponse, null, 2));
      console.log("Batch created:", apiResponse.results.length);
      console.log(
        `Create loop ran through ${batchStart} - ${batchEnd} products`
      );
      cmsLib.writeHubSpotProductIds(apiResponse.results);
      batchStart = batchStart + limit;
      batchEnd = batchEnd + limit;
    } catch (e) {
      // TODO: handle if product already exists
      e.message === "HTTP request failed"
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
      return;
    }
  } while (products.length >= batchEnd - limit);

  return;
}

async function updateProducts(products) {
  const limit = 100;
  let batchStart = 0;
  let batchEnd = limit;

  do {
    const batch = products.slice(batchStart, batchEnd);
    const batchToUpdate = {
      inputs: batch,
    };
    console.log("Batch to update:", batch.length);
    try {
      const apiResponse = await hubspotClient.crm.products.batchApi.update(
        batchToUpdate
      );
      // console.log("updateProducts res:", JSON.stringify(apiResponse, null, 2));
      console.log("Batch updated:", apiResponse.results.length);
      console.log(
        `Create loop ran through ${batchStart} - ${batchEnd} products`
      );
      batchStart = batchStart + limit;
      batchEnd = batchEnd + limit;
    } catch (e) {
      // TODO: handle if product id is in CMS but does not exist in HubSpot
      e.message === "HTTP request failed"
        ? console.error(JSON.stringify(e.response, null, 2))
        : console.error(e);
      return e;
    }
  } while (products.length >= batchEnd - limit);
}

module.exports = {
  createDeal,
  createContact,
  getAllProducts,
  deleteProducts,
  getProductsWithNoFolder,
  updateBatchProductFolder,
  updateProducts,
  createProducts,
};
