// This script was used during a data loss incident.
// It will consume a JSON file (from scraper-inventory-image-data-background.js) and update the inventory in the database.

const fetch = require("node-fetch");
const lib = require("../lib/lib.js");
const fs = require("fs");
const cmsLib = require("../lib/cms-lib");

const wait = (timeToDelay) =>
  new Promise((resolve) => setTimeout(resolve, timeToDelay));

exports.handler = async (event) => {
  // 1. read inventory-image-data.json
  // 2. loop through and get image data
  // 3. save data to sanity

  fs.readFile("inventory-image-data-6000.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    if (data) {
      const jsonData = JSON.parse(data);
      // const inventoryWithImageData = jsonData.filter(i => i.mainImage);
      const inventoryWithMainImageData = jsonData.filter((i) => i.mainImage);
      console.log(
        "inventoryWithMainImageData: ",
        inventoryWithMainImageData.length
      );

      const inventoryWithImageGalleryOnlyData = jsonData.filter(
        (i) => i.imageGallery && !i.mainImage
      );
      console.log(
        "inventoryWithImageGalleryOnlyData: ",
        inventoryWithImageGalleryOnlyData
      );
      cmsLib.addInventoryPhotos(inventoryWithMainImageData);
    }
  });
};
