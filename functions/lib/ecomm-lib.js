const { URL, HUBSPOT_API_KEY, HUBSPOT_DEVELOPER_API_KEY } = process.env;
const Hubspot = require("hubspot");
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
const hubspot = new Hubspot({
  apiKey: hubSpotApiData.apiKey,
  checkLimit: false,
});
const storeId = "newmantractor-dotcom-store";
const apiPath = "/extensions/ecomm/v2/sync/messages";

const toPlainText = (blocks = []) => {
  return (
    blocks
      // loop through each block
      .map((block) => {
        // if it's not a text block with children,
        // return nothing
        if (block._type !== "block" || !block.children) {
          return "";
        }
        // loop through the children spans, and join the
        // text strings
        return block.children.map((child) => child.text).join("");
      })
      // join the paragraphs leaving split by two linebreaks
      .join("\n\n")
  );
};

const syncContacts = async (payload) => {
  const {
    billingAddressName,
    billingAddressAddress1,
    billingAddressCity,
    billingAddressCountry,
    billingAddressProvince,
    billingAddressPostalCode,
    email,
  } = payload.content;
  const fullName = billingAddressName.split(" ");
  const firstName = fullName[0];
  const lastName = billingAddressName.substring(fullName[0].length).trim();
  const messages = [
    {
      action: "UPSERT",
      externalObjectId: email,
      properties: {
        firstname: firstName,
        lastname: lastName,
        email: email,
        // mobilephone: ???
        address1: billingAddressAddress1,
        city: billingAddressCity,
        country: billingAddressCountry,
        state: billingAddressProvince,
        postalCode: billingAddressPostalCode,
      },
    },
  ];

  const data = {
    storeId: storeId,
    objectType: "CONTACT",
    messages: messages,
  };

  await hubspot.apiRequest({
    method: "PUT",
    path: apiPath,
    body: data,
  });
  return data;
};

const syncProducts = async (items, folder) => {
  const messages = items.map((item) => {
    return {
      action: "UPSERT",
      externalObjectId: item.id,
      properties: {
        product_price: item.price,
        product_name: item.name,
        product_description: item.description,
        product_image: item.image,
        product_images: item.image,
        product_url: `${URL}${item.url}`,
        product_sku: item.id,
        product_weight: item.weight,
        product_cms_id: item.cms_id || "",
        ...(folder && { product_folder: folder }),
      },
    };
  });

  const data = {
    storeId: storeId,
    objectType: "PRODUCT",
    messages: messages,
  };

  console.log("syncProducts data: ", JSON.stringify(data));
  const hsResponse = await hubspot.apiRequest({
    method: "PUT",
    path: apiPath,
    body: data,
  });
  console.log("syncProducts hsResponse: ", JSON.stringify(hsResponse));

  return data;
};

const syncDeals = async (payload) => {
  const {
    creationDate,
    billingAddressName,
    invoiceNumber,
    grandTotal,
    email,
    shippingFees,
    discounts,
    totalWeight,
    trackingNumber,
    trackingUrl,
    creditCardLast4Digits,
    paymentMethod,
    cardType,
    taxesTotal,
    shippingAddressAddress1,
    shippingAddressCity,
    shippingAddressProvince,
    shippingAddressPostalCode,
    status,
  } = payload.content;

  const stage = (s) => {
    switch (s) {
      case "InProgress":
        return "checkout_pending";
      case "Processed":
        return "checkout_completed";
      case "Shipped":
        return "processed";
      case "Delivered":
        return "shipped";
      case "Cancelled":
        return "cancelled";
      case "Pending":
        return "checkout_pending";
      default:
        return "empty";
    }
  };

  const messages = [
    {
      action: "UPSERT",
      externalObjectId: invoiceNumber,
      properties: {
        order_date: Date.parse(creationDate) / 1000, //1634140384000
        order_name: `${invoiceNumber} | ${shippingAddressCity}, ${shippingAddressProvince} | ${billingAddressName}`,
        order_stage: stage(status),
        abandoned_cart_url: "",
        order_close_date: Date.parse(creationDate) / 1000,
        order_total: grandTotal,
        order_taxes_total: taxesTotal,
        order_shipping_total: shippingFees,
        order_shipping_weight: totalWeight,
        order_shipping_address: shippingAddressAddress1,
        order_shipping_city: shippingAddressCity,
        order_shipping_state: shippingAddressProvince,
        order_shipping_zip: shippingAddressPostalCode,
        order_discount_total: discounts.amountSaved ? discounts.amountSaved : 0,
        order_discount_code: discounts.code ? discounts.code : "",
        order_discount_name: discounts.name || "",
        order_shipping_tracking_number: trackingNumber ? trackingNumber : "",
        order_shipping_tracking_url: trackingUrl ? trackingUrl : "",
        order_payment_card_last4: creditCardLast4Digits,
        order_payment_method: paymentMethod,
        order_payment_card_typ: cardType,
      },
      associations: {
        CONTACT: [email],
      },
    },
  ];

  const data = {
    storeId: storeId,
    objectType: "DEAL",
    messages: messages,
  };

  await hubspot.apiRequest({
    method: "PUT",
    path: apiPath,
    body: data,
  });
  return data;
};

const syncLineItems = async (payload) => {
  const { invoiceNumber } = payload.content;
  const messages = payload.content.items.map((item) => {
    return {
      action: "UPSERT",
      externalObjectId: `${invoiceNumber}-${item.id}`,
      properties: {
        item_price: item.price,
        item_quantity: item.quantity,
      },
      associations: {
        DEAL: [invoiceNumber],
        PRODUCT: [item.id],
      },
    };
  });

  const data = {
    storeId: storeId,
    objectType: "LINE_ITEM",
    messages: messages,
  };

  await hubspot.apiRequest({
    method: "PUT",
    path: apiPath,
    body: data,
  });
  return data;
};

module.exports = {
  syncProducts,
  syncDeals,
  syncContacts,
  syncLineItems,
  toPlainText,
};
