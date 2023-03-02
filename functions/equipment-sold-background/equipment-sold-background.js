const lib = require("../lib/lib.js");
const statusCode = 200;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event, context) => {
  // We only care to do anything if this is our POST request.
  if (event.httpMethod !== "POST") {
    return {
      statusCode,
      headers,
      body: "This was not a POST request!",
    };
  }

  const pageNo = event.queryStringParameters.pageno || 1;
  const pageSize = event.queryStringParameters.pagesize || 10;

  // 1. Fetch the ERP Data
  let erpData = await lib.equipmentFetchSold(pageNo, pageSize);

  console.log("erpData fetched");

  // 2. Update records to sold
  await lib.updateSoldEquipment(erpData);

  console.log("equipment inventory items updated to sold");

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: "Expired documents have been successfully deleted",
  };
};
