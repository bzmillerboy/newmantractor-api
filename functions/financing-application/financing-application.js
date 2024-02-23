const {
  HUBSPOT_PORTAL_ID,
  HUBSPOT_PRIVATE_APP_TOKEN,
  HUBSPOT_FORM_APPLY_FOR_FINANCING,
  SUPABASE_URL,
  SUPABASE_KEY_SERVICE_KEY,
  PORTAL_URL,
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
  console.log("payload", payload);

  const referring_url = event.headers.referer;
  const { email, firstName, lastName, phone, type, hs_context } = payload;
  const ipAddress = event.headers["x-forwarded-for"].split(",")[0];

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
      hutk: hs_context?.hutk,
      ipAddress: ipAddress,
      pageUri: hs_context?.pageUrl || event.headers.referer || "",
      pageName: hs_context?.pageName,
    },
  };

  const phoneNumber = parsePhoneNumber(phone, "US").number;

  // Check if user already exists and send login link instead of signup link
  const { data: contact, error: userError } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", email)
    .single();
  console.log("contact", contact);

  const { data: generateLinkData, error } =
    await supabase.auth.admin.generateLink({
      type: contact ? "magiclink" : "signup",
      email: email.toLowerCase(),
      options: {
        password: "nt" + email.toLowerCase() + firstName + lastName,
        redirectTo: PORTAL_URL,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phoneNumber,
        },
      },
    });

  // console.log("generateLinkData", generateLinkData);

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

  if (generateLinkData) {
    const applicationData = await lib.createFinanceApplication({
      referring_url,
      contactId: contact?.id || generateLinkData.user.id,
      type: type,
      ...generateLinkData,
    });
    console.log("applicationData", applicationData);

    await lib.createFinanceApplicationActivity(
      applicationData?.id,
      contact?.id || generateLinkData.user.id
    );

    await hubspot.forms.submit(
      HUBSPOT_PORTAL_ID,
      HUBSPOT_FORM_APPLY_FOR_FINANCING,
      hubSpotFormData
    );

    return {
      statusCode: 200,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({ message: "success" }),
    };
  }
};
