const lib = require('../lib/lib.js')
const statusCode = 200
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
}

exports.handler = async (event, context) => {
  // We only care to do anything if this is our POST request.
  if (event.httpMethod !== 'POST') {
    return {
      statusCode,
      headers,
      body: 'This was not a POST request!'
    }
  }

  const pageNo = event.queryStringParameters.pageno || 1
  const pageSize = event.queryStringParameters.pagesize || 10

  // 1. Fetch the ERP Data
  let erpData = await lib.equipmentFetch(pageNo, pageSize)
  console.log('erpData fetched')
  // 2. Delete records removed from ERP
  let equipmentDeletes = await lib.deleteEquipment(erpData)
  console.log('equipment inventory items deleted')
  // 3. Trigger a new Netlify build
  await lib.triggerBuild()

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: 'Expired documents have been successfully deleted'
  }
}
