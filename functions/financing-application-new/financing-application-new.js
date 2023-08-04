const {
  HUBSPOT_PORTAL_ID,
  HUBSPOT_PRIVATE_APP_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY_SERVICE_KEY,
} = process.env;
const lib = require("../lib/finance-application-lib.js");
const Hubspot = require("hubspot");
const hubspot = new Hubspot({
  accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
  checkLimit: false,
});

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const parsePhoneNumber = require("libphonenumber-js").parsePhoneNumber;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Successful preflight call." }),
    };
  }

  const payload = JSON.parse(event.body);
  const referring_url = event.headers.referer;
  const { email, firstName, lastName, phone, type, hutk } = payload;

  const hubSpotFormData = {
    fields: [
      {
        name: "email",
        value: email,
      },
      {
        name: "firstname",
        value: firstName,
      },
      {
        name: "lastname",
        value: lastName,
      },
      {
        name: "phone",
        value: phone,
      },
      {
        name: "finance_application_url",
        value: event.headers.referer || "",
      },
    ],
    context: {
      hutk: hutk && hutk, // include this parameter and set it to the hubspotutk cookie value to enable cookie tracking on your submission
      pageUri: event.headers.referer || "",
    },
  };

  const phoneNumber = parsePhoneNumber(phone, "US").number;

  // Check if user already exists and send login link instead of signup link
  const { data: contact, error: userError } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", email)
    .single();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: contact ? "magiclink" : "signup",
    email: email.toLowerCase(),
    options: {
      password: "password",
      redirectTo: "https://portal.newmantractor.com",
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phoneNumber,
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
    // console.log("generateLink data: ", data);
    const applicationData = await lib.createFinanceApplication({
      referring_url,
      type: type,
      ...data,
    });
    await lib.sendFinanceApplicationEmail({
      user: data,
      application: applicationData,
      existingUser: contact ? true : false,
    });

    hutk &&
      (await hubspot.forms.submit(
        HUBSPOT_PORTAL_ID,
        "3f9e682b-bb9a-40bf-9b9b-69ee97c82960",
        hubSpotFormData
      ));

    return {
      statusCode: 200,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({ message: "success" }),
    };
  }
};
