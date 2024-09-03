const Sentry = require("@sentry/serverless");

const {
  SENTRY_CLIENT_KEY,
  ENV_NAME,
  HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_INVENTORY,
  HUBSPOT_PRODUCT_FOLDER_PRODUCT,
  HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_RENTAL,
  HUBSPOT_PRODUCT_FOLDER_MODEL,
  WEBSITE_URL,
} = process.env;
const crmLib = require("../lib/crm-lib");
const lib = require("../lib/lib");

Sentry.AWSLambda.init({
  dsn: `https://${SENTRY_CLIENT_KEY}.ingest.sentry.io/4506876114698240`,
  environment: ENV_NAME,
  tracesSampleRate: 1.0,
  ignoreSentryErrors: true,
});

function buildHubSpotProductObject(items) {
  return items.map((p) => {
    let url = "";
    let sku = "";
    let type = "";
    let folder = "";
    let price = "";
    let image = "";
    let description = "";
    let name = "";
    if (p._type === "inventory") {
      sku = p.sku;
      name = p.title || "Unknown";
      type = "inventory";
      folder = HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_INVENTORY;
      price = p.price;
      image = p.mainImage?.asset?.url || "";
      url = `${WEBSITE_URL}/equipment/${p.equipmentCategories?.slug?.current}/${p.slug?.current}`;
      description = `${p.equipmentCategories?.title} | ${
        lib.toPlainText(p.descriptionBlock || []) || ""
      }`;
    } else if (p._type === "equipmentSubCategory") {
      sku = p.sku;
      name = `${p.title || "Unknown"} ${p.equipmentCategories?.title}`;
      type = "rental";
      folder = HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_RENTAL;
      price = p.price;
      image = p.mainImage?.asset?.url || "";
      url = `${WEBSITE_URL}/rentals/${p.equipmentCategories?.slug?.current}/${p.slug?.current}`;
      description = `Rental | ${p.equipmentCategories?.title}`;
    } else if (p._type === "equipmentOptions") {
      sku = p.sku;
      name = p.title || "Unknown";
      type = "rental-option";
      folder = HUBSPOT_PRODUCT_FOLDER_EQUIPMENT_RENTAL;
      price = p.price;
      image = p.mainImage?.asset?.url || "";
      url = "";
      description = `Rental Option | ${p.equipmentCategories?.title}`;
    } else if (p._type === "ecommerceProduct") {
      sku = p.defaultProductVariant?.sku;
      name = p.title || "Unknown";
      type = "product";
      folder = HUBSPOT_PRODUCT_FOLDER_PRODUCT;
      price = p.defaultProductVariant?.price;
      image = p.productImage?.image?.asset?.url || "";
    } else if (p._type === "models") {
      sku = p.sku;
      name = p.title || "Unknown";
      type = "model";
      folder = HUBSPOT_PRODUCT_FOLDER_MODEL;
      price = p.price;
      image = p.mainImage?.asset?.url || "";
      description = `${p.make?.name} ${p.equipmentCategories?.title} ${
        lib.toPlainText(p.descriptionBlock || []) || ""
      }`;
      url = `${WEBSITE_URL}/${p.make?.slug?.current}/${p.equipmentCategories?.slug?.current}/${p.slug?.current}`;
    } else {
      sku = p.sku;
      name = p.title || "Unknown";
      type = "";
      folder = "";
      price = "";
      image = "";
      url = "";
    }
    // const sku = p.defaultProductVariant.sku || p.sku;
    return {
      id: p.hubSpotProductId,
      properties: {
        ...(price && { price: price }),
        name: name,
        description: description,
        hs_images: image,
        hs_url: url,
        hs_sku: sku,
        cms_id: p._id,
        hs_folder_id: folder,
        hs_product_type: type,
      },
    };
  });
}

exports.handler = Sentry.AWSLambda.wrapHandler(
  async (event, context, callback) => {
    const payload = event.body && JSON.parse(event.body);

    // Check if data is passed, otherwise fetch all products. Note: this will fetch all products, you may want to
    // limit this to only those without a hubSpotProductId or those that have been updated since the last sync.
    const allProducts = payload ? [payload] : await lib.productFetch();
    const existingProducts = allProducts.filter((p) => p.hubSpotProductId);
    const newProducts = allProducts.filter((p) => !p.hubSpotProductId);
    console.log("newProducts to create:", newProducts.length);
    console.log("existingProducts to update:", existingProducts.length);

    try {
      newProducts.length > 0 &&
        (await crmLib.createProducts(buildHubSpotProductObject(newProducts)));
      existingProducts.length > 0 &&
        (await crmLib.updateProducts(
          buildHubSpotProductObject(existingProducts)
        ));
      return {
        statusCode: 200,
        body: `Request to sync inventory equipment received.`,
      };
    } catch (e) {
      // console.error(e);
      return { statusCode: 500 }; //body: e.toString()
    }
  }
);
