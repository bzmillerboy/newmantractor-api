const lib = require('../lib/lib.js')
const statusCode = 200
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

exports.handler = async (event, context) => {
  /*
    1. fetch erp equipment data
    2. create categories & make docs
    3. create model docs
    4. create inventory docs
  */

  // We only care to do anything if this is our POST request.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode,
      headers,
      body: 'This was not a POST request!',
    }
  }

  const pageNo = event.queryStringParameters.pageno || 1
  const pageSize = event.queryStringParameters.pagesize || 10

  // 1. Fetch the ERP Data
  const erpData = await lib.equipmentFetch(pageNo, pageSize)
  console.log('erpData fetched')
  // 2. Create categories & makes
  await Promise.all([
    lib.createCategories(erpData),
    lib.createMakes(erpData),
    lib.createLocations(erpData),
  ])
  console.log('categories and makes created')
  // 3. Create model docs
  let equipmentModels = await lib.createModels(erpData)
  console.log('models created')
  // 4. Create equipment inventory items
  let equipmentInventory = await lib.createEquipment(erpData)
  console.log('equipment inventory items created')

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: 'All documents have been successfully imported',
  }
}
