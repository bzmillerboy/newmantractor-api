const { NEWMANTRACTOR_APIKEY } = process.env;
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const emailLib = require("../lib/email-lib.js");

exports.handler = async (event) => {
  console.log("event:", event);
  // reject if apikey is not present or incorrect
  console.log("apikey:", event.queryStringParameters.apiKey);
  console.log("apikey env var:", event.queryStringParameters.apiKey);
  if (event.queryStringParameters.apiKey !== process.env.NEWMANTRACTOR_APIKEY) {
    console.log("Not Authorized - Invalid API Key");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const payload = JSON.parse(event.body);
  const appId = payload.record.application_id;
  const activityMetaData = payload.record.metadata;
  const activityName = payload.record.name;

  const { data: application, error: applicationsError } = await supabase
    .from("applications")
    .select(
      "contact:contact_id(email, first_name, last_name), type:type_id(id, name), *"
    )
    .eq("id", appId)
    .single();
  if (applicationsError) {
    console.log("applicationsError:", applicationsError);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error retrieving application data" }),
    };
  }

  console.log("application:", JSON.stringify(application));

  try {
    await emailLib.sendFinanceApplicationEmail(
      activityName,
      application,
      activityMetaData
    );
    return { statusCode: 200 };
  } catch (e) {
    console.error(e);
    return {
      statusCode: e.code,
      body: `${e.message} - ${JSON.stringify(e?.response.body)}`,
    };
  }
};
