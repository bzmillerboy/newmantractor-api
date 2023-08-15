const { SUPABASE_URL, SUPABASE_KEY_SERVICE_KEY, NEWMANTRACTOR_APIKEY } =
  process.env;

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  const { apikey } = event.queryStringParameters;
  const validApiKey = NEWMANTRACTOR_APIKEY;
  if (apikey !== validApiKey) {
    console.log("Not Authorized - Invalid API Key");
    return { statusCode: 401, body: "Unauthorized" };
  }
  const payload = JSON.parse(event.body);
  console.log("payload: ", payload);
  const referring_url = event.headers.referer;
  const { email, firstName, lastName } = payload;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: email.toLowerCase(),
    options: {
      password: "password",
      redirectTo: "https://staging-portal.newmantractor.com",
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    console.log("generateLink error: ", error);
    return {
      statusCode: error.status || 500,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify(error.message),
    };
  }

  if (data) {
    console.log("generateLink data: ", data);
    return {
      statusCode: 200,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify(data?.properties?.action_link),
    };
  }
};
