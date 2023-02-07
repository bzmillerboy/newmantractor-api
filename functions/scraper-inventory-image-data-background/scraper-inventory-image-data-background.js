// This script was used during a data loss incident. It will scrape a URL and recover inventory dat from a Gatsby build.
// It will then write the data to a JSON file. This file was then used to update the inventory in the database.

const fetch = require("node-fetch");
const lib = require("../lib/lib.js");
const fs = require("fs");

const wait = (timeToDelay) =>
  new Promise((resolve) => setTimeout(resolve, timeToDelay));

exports.handler = async (event) => {
  // 1. get every inventory item (with category slug and inventory slug)
  // 2. compile URL
  // 3. loop through URLS and get image data
  // 4. filter out those without mainImage or imageGallery
  // 5. return image data

  const inventory = await lib.fetchEquipmentInventory2(6001, 7000);
  // console.log(inventory);

  try {
    // const data = await lib.getInventoryImageData(url);
    const data =
      inventory &&
      (await Promise.all(
        inventory.map(async (i) => {
          await wait(125);
          const urlPageData = `http://www.newmantractor.com/page-data/equipment/${i.equipmentCategories.slug.current}/${i.slug.current}/page-data.json`;
          const url = `https://www.newmantractor.com/equipment/${i.equipmentCategories.slug.current}/${i.slug.current}`;
          return await lib.getInventoryImageData(urlPageData, i._id, url);
        })
      ));
    // console.log("image data: ", data);
    fs.writeFile("inventory-image-data.json", JSON.stringify(data), (err) => {
      if (err) {
        console.error(err);
        return;
      }
      //file written successfully
    });

    return {
      statusCode: 200,
      // body: JSON.stringify(data),
      // headers: { "content-type": "application/json" },
    };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  }
};
