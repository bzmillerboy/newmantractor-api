const {
  SANITY_TOKEN_ETL,
  SANITY_PROJECT_ID,
  SANITY_DATASET,
  SANITY_API_VERSION,
} = process.env;
const sanityClient = require("@sanity/client");
const client = sanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN_ETL,
  useCdn: false,
  apiVersion: SANITY_API_VERSION,
});
console.log("Sanity Dataset:", SANITY_DATASET);

const fetchEquipmentInventory = async (pageNo, pageSize) => {
  const start = pageSize * pageNo - pageSize;
  const end = pageSize * pageNo - 1;
  console.log(`fetching from ${start} to ${end}`);
  currentInventory = await client.fetch(
    `*[_type == "inventory" && !(_id in path("drafts.**")) && !defined(imageGallery.images)] | order(_id asc) [${start}..${end}] {_id, title, serial, mainImage, imageGallery}`
  );
  return currentInventory;
};

const writeHubSpotProductIds = async (hubSpotProductIds) => {
  const createTransaction = (updatedInventory = []) =>
    updatedInventory.reduce(
      (tx, mod) =>
        tx.patch(mod.properties.cms_id, (p) =>
          p.set({ hubSpotProductId: mod.id })
        ),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(hubSpotProductIds);
  await commitTransaction(transaction);
  console.log(
    "HubSpot Product Ids written to Sanity",
    hubSpotProductIds.length
  );
  return transaction;
};

const clearHubSpotId = async () => {
  itemsWithHubSpotId = await client.fetch(
    `*[_type == "inventory" && defined(hubSpotProductId)] | order(_id asc) {_id, title, hubSpotProductId}`
    // `*[_type == "inventory" && hubSpotProductId == null] | order(_id asc) {_id, title, hubSpotProductId}`
  );

  const createTransaction = (items = []) =>
    items.reduce(
      (tx, mod) =>
        tx.patch(mod._id, {
          unset: ["hubSpotProductId"],
        }),

      // (tx, mod) => tx.patch(mod._id, (p) => p.set({ hubSpotProductId: "" })),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(itemsWithHubSpotId);
  await commitTransaction(transaction);
  console.log(
    "HubSpot Product Ids removed from Sanity",
    itemsWithHubSpotId.length
  );
  return transaction;
};

module.exports = {
  fetchEquipmentInventory,
  writeHubSpotProductIds,
  clearHubSpotId,
};
