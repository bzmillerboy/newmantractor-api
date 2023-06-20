const {
  HUBSPOT_PORTAL_ID,
  HUBSPOT_PRIVATE_APP_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  PORTAL_URL,
  SUPABASE_URL,
} = process.env;
const { createClient } = require("@supabase/supabase-js");
const Hubspot = require("hubspot");
const sgMail = require("@sendgrid/mail");
const hubspot = new Hubspot({
  accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
  checkLimit: false,
});
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  // const payload = JSON.parse(event);
  console.log("finapp-notifications payload:", payload);
  // sgMail.setApiKey(SENDGRID_API_KEY);

  // const { data: applications, error: applicationsError } = await supabase
  //   .from("applications")
  //   .select("*")
  //   .eq("id", payload.record.id)
  //   .single();

  try {
    // sgMail.setApiKey(SENDGRID_API_KEY);

    return {
      statusCode: 200,
      body: `Finapp notification sent`,
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
