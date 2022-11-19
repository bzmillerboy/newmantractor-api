const lib = require('../lib/lib.js')
const statusCode = 200
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

exports.handler = async (event, context) => {
  // We only care to do anything if this is our POST request.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode,
      headers,
      body: 'This was not a POST request!',
    }
  }

  /*
  1. Loop inventory data and get ID (maybe: filter out those with mainImage && image gallery already)
  2. Use sanity/inventory to loop ID and fetch image URL (try ~15 )
  2a. Grab first image for mainImage
  3. Import asset and pass id to next step
  3. Build array of imageGallery to patch on an inventory item (check 24 images)
  3a. Build patch for mainImage
  4. Run patch for imageGallery and mainImage
   * mainImage & gallery are separate
  */

  const pageNo = event.queryStringParameters.pageNo || 0
  const pageSize = event.queryStringParameters.pageSize || 10

  // 1. Fetch inventory from Sanity
  const equipment = await lib.fetchEquipmentInventory(pageNo, pageSize)
  console.log('equipment records without photos fetched', equipment.length)
  // 2. Add image URL if available
  const equipmentPhotos = await lib.fetchEquipmentPhotos(equipment)
  console.log('equipment photos imported and matched to equipment:', equipmentPhotos.length)
  // 3. Upload image assets
  const imageAssets = await lib.uploadImages(equipmentPhotos)
  console.log('images have been uploaded')
  // 4. Add/Patch uploaded images to inventory docs
  const inventoryWithPhotos = await lib.addInventoryPhotos(imageAssets)
  console.log('images have been added to inventory records:', inventoryWithPhotos.results.length)

  const resBody = {
    equipmentPhotos: equipmentPhotos,
    imageAssets: imageAssets,
    inventoryWithPhotos: inventoryWithPhotos,
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(resBody),
  }
}
