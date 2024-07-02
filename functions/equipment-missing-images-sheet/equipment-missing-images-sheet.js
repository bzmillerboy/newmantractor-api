const {
  SANITY_TOKEN_ETL,
  SANITY_PROJECT_ID,
  SANITY_DATASET,
  SANITY_API_VERSION,
  WEBSITE_URL,
  CMS_URL,
} = process.env;
const { promises: fs } = require("fs");
const createObjectCsvStringifier =
  require("csv-writer").createObjectCsvStringifier;
const dayjs = require("dayjs");

const sanityClient = require("@sanity/client");
const client = sanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN_ETL,
  useCdn: false, // `false` if you want to ensure fresh data
  apiVersion: SANITY_API_VERSION,
});

exports.handler = async (event, context) => {
  const query = `*[_type == 'inventory' && status == "stock" && !defined(mainImage) && !defined(imageGallery) && (!(deliveryDate > now()) || deliveryDate == "" || deliveryDate == null)]{_id, _createdAt, deliveryDate, stockNumber, title, 'slug': slug.current, 'location': location->title, 'type': equipmentCategories->categoryType, 'categorySlug': equipmentCategories->slug.current } | order(location asc)`;

  const data = await client.fetch(query);

  const formattedData = data.map((item) => {
    const format = "MM/DD/YYYY hh:mm:ss A";
    return {
      ...item,
      link: `${WEBSITE_URL}/equipment/${item.categorySlug}/${item.slug}`,
      cmsLink: `${CMS_URL}/desk/equipment;inventory;${item._id}`,
      deliveryDate: item.deliveryDate
        ? dayjs(item.deliveryDate).format(format)
        : "",
      _createdAt: item._createdAt ? dayjs(item._createdAt).format(format) : "",
    };
  });

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: "title", title: "Title" },
      { id: "stockNumber", title: "EQ" },
      { id: "location", title: "Location" },
      { id: "type", title: "Type" },
      { id: "deliveryDate", title: "Delivery Date" },
      { id: "_createdAt", title: "Create Date" },
      { id: "cmsLink", title: "CMS Link" },
      { id: "link", title: "Website Link" },
    ],
  });

  try {
    const csv = csvStringifier.stringifyRecords(formattedData);
    const headers = csvStringifier.getHeaderString();
    return {
      statusCode: 200,
      headers: { "content-type": "text/csv" },
      body: headers + csv,
      csv,
    };
  } catch (e) {
    console.log("error", e);
    return {
      statusCode: e.code,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
