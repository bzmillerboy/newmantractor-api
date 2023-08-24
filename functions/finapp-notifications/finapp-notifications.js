const { NEWMANTRACTOR_APIKEY } = process.env;
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const emailLib = require("../lib/email-lib.js");

exports.handler = async (event) => {
  // console.log("event:", JSON.stringify(event));
  const { apikey } = event.queryStringParameters;
  const validApiKey = process.env.NEWMANTRACTOR_APIKEY;
  if (apikey !== validApiKey) {
    console.log("Not Authorized - Invalid API Key");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const payload = JSON.parse(event.body);
  const appId = payload.record.application_id;

  const { data: application, error: applicationsError } = await supabase
    .from("applications")
    .select(
      "contact:contact_id(email,first_name, last_name),company:company_id(business_name, business_dba), sales_rep:sales_rep_id(email, first_name, last_name), rental_rep:rental_rep_id(email, first_name, last_name), type:type_id(id, name, primary_contact:primary_contact_id(email, first_name, last_name)), *"
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

  // console.log("application:", JSON.stringify(application));

  try {
    await emailLib.compileFinanceApplicationEmail(payload.record, application);
    return { statusCode: 200 };
  } catch (e) {
    console.error(e);
    return {
      statusCode: e.code,
      body: `${e.message} - ${JSON.stringify(e?.response.body)}`,
    };
  }
};
